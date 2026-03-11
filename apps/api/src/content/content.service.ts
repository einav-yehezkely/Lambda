import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { getSupabaseClient } from '../common/supabase.client';
import { ContentItem, VersionContentItem } from '@lambda/shared';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { VoteContentDto } from './dto/vote-content.dto';

@Injectable()
export class ContentService {
  constructor(private readonly config: ConfigService) {}

  private get db() {
    return getSupabaseClient();
  }

  // ─── List content items for a version ───────────────────────────────────────

  async listByVersion(filters: {
    version_id: string;
    topic_id?: string;
    type?: string;
    difficulty?: string;
  }): Promise<VersionContentItem[]> {
    let query = this.db
      .from('version_content_items')
      .select('version_id, content_item_id, topic_id, content_item:content_items(*)')
      .eq('version_id', filters.version_id);

    if (filters.topic_id) {
      query = query.eq('topic_id', filters.topic_id);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    let results = data as unknown as VersionContentItem[];

    // Filter by type/difficulty in memory (simpler than joining + filtering in SQL)
    if (filters.type) {
      results = results.filter((r) => r.content_item.type === filters.type);
    }
    if (filters.difficulty) {
      results = results.filter((r) => r.content_item.difficulty === filters.difficulty);
    }

    return results;
  }

  // ─── Get single content item ─────────────────────────────────────────────────

  async getItem(id: string): Promise<ContentItem> {
    const { data, error } = await this.db
      .from('content_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Content item not found');
    return data as ContentItem;
  }

  // ─── Create content item + add to version (junction) ─────────────────────────

  async createItem(dto: CreateContentDto, userId: string): Promise<VersionContentItem> {
    const { version_id, topic_id, ...itemData } = dto;

    // 1. Insert the content item
    const { data: item, error: itemError } = await this.db
      .from('content_items')
      .insert({ ...itemData, author_id: userId, tags: itemData.tags ?? [] })
      .select()
      .single();

    if (itemError) throw new InternalServerErrorException(itemError.message);

    // 2. Insert junction row
    const { data: junction, error: junctionError } = await this.db
      .from('version_content_items')
      .insert({
        version_id,
        content_item_id: item.id,
        topic_id: topic_id ?? null,
      })
      .select('version_id, content_item_id, topic_id, content_item:content_items(*)')
      .single();

    if (junctionError) throw new InternalServerErrorException(junctionError.message);
    return junction as unknown as VersionContentItem;
  }

  // ─── Update content item (copy-on-write for shared items) ──────────────────

  async updateItem(id: string, dto: UpdateContentDto, userId: string): Promise<ContentItem> {
    const item = await this.getItem(id);
    const { version_id, topic_id, ...itemData } = dto;

    // Count how many versions reference this content item
    const { data: usages } = await this.db
      .from('version_content_items')
      .select('version_id')
      .eq('content_item_id', id);

    const isShared = (usages?.length ?? 0) > 1;

    if (!isShared && item.author_id === userId) {
      // Not shared + user is the author → update in-place
      const { data, error } = await this.db
        .from('content_items')
        .update(itemData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new InternalServerErrorException(error.message);

      if (topic_id !== undefined && version_id) {
        await this.db
          .from('version_content_items')
          .update({ topic_id })
          .eq('content_item_id', id)
          .eq('version_id', version_id);
      }

      return data as ContentItem;
    }

    // Shared or not the original author → copy-on-write
    if (!version_id) {
      throw new BadRequestException('version_id is required to edit a shared content item');
    }

    const { data: version } = await this.db
      .from('course_versions')
      .select('author_id')
      .eq('id', version_id)
      .single();

    if (!version || version.author_id !== userId) {
      throw new ForbiddenException('Only the version author can edit shared content items');
    }

    // Create a copy with edits applied, owned by the editor
    const { data: newItem, error: copyError } = await this.db
      .from('content_items')
      .insert({
        type: item.type,
        title: itemData.title ?? item.title,
        content: itemData.content ?? item.content,
        solution: 'solution' in itemData ? itemData.solution : item.solution,
        difficulty: 'difficulty' in itemData ? itemData.difficulty : item.difficulty,
        tags: itemData.tags ?? item.tags,
        metadata: itemData.metadata ?? item.metadata,
        is_published: itemData.is_published ?? item.is_published,
        author_id: userId,
      })
      .select()
      .single();

    if (copyError) throw new InternalServerErrorException(copyError.message);

    // Redirect this version's junction row to the new copy
    const { error: junctionError } = await this.db
      .from('version_content_items')
      .update({
        content_item_id: (newItem as ContentItem).id,
        ...(topic_id !== undefined ? { topic_id } : {}),
      })
      .eq('version_id', version_id)
      .eq('content_item_id', id);

    if (junctionError) throw new InternalServerErrorException(junctionError.message);

    return newItem as ContentItem;
  }

  // ─── Delete content item entirely (author only) ─────────────────────────────

  async deleteItem(id: string, userId: string): Promise<void> {
    const item = await this.getItem(id);
    if (item.author_id !== userId) {
      throw new ForbiddenException('Only the author can delete this content item');
    }

    const { error } = await this.db.from('content_items').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  // ─── Remove from version (junction only, item preserved) ────────────────────

  async removeFromVersion(contentItemId: string, versionId: string, userId: string): Promise<void> {
    await this.assertVersionAuthorOrItemAuthor(contentItemId, versionId, userId);

    const { error } = await this.db
      .from('version_content_items')
      .delete()
      .eq('content_item_id', contentItemId)
      .eq('version_id', versionId);

    if (error) throw new InternalServerErrorException(error.message);
  }

  // ─── Vote ────────────────────────────────────────────────────────────────────

  async vote(contentItemId: string, dto: VoteContentDto, userId: string): Promise<void> {
    await this.getItem(contentItemId); // throws if not found

    const { error } = await this.db
      .from('content_votes')
      .upsert(
        { user_id: userId, content_item_id: contentItemId, vote: dto.vote },
        { onConflict: 'user_id,content_item_id' },
      );

    if (error) throw new InternalServerErrorException(error.message);
  }

  // ─── Report error ────────────────────────────────────────────────────────────

  async reportError(contentItemId: string, errorText: string, reporterUsername?: string): Promise<void> {
    const { data: item } = await this.db
      .from('content_items')
      .select('title, author_id')
      .eq('id', contentItemId)
      .single();

    if (!item) throw new NotFoundException('Content item not found');

    // Find a version that contains this item to build a direct link
    const { data: junction } = await this.db
      .from('version_content_items')
      .select('version_id, course_version:course_versions!version_content_items_version_id_fkey(template_id)')
      .eq('content_item_id', contentItemId)
      .limit(1)
      .single();

    const templateId = (junction?.course_version as any)?.template_id;
    const versionId = junction?.version_id;
    const itemLink = templateId && versionId
      ? `https://lambda-site.vercel.app/courses/${templateId}/versions/${versionId}`
      : null;

    const { data: author } = await this.db
      .from('users')
      .select('email, username')
      .eq('id', item.author_id)
      .single();

    const smtpUser = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!smtpUser || !pass) throw new InternalServerErrorException('Email service not configured');

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass } });

    const reporterLine = reporterUsername
      ? `Reported by: ${reporterUsername} (https://lambda-site.vercel.app/profile/${reporterUsername})`
      : 'Reported by: Anonymous';

    const linkLine = itemLink ? `\nLink to question: ${itemLink}` : '';

    await transporter.sendMail({
      from: smtpUser,
      to: author?.email ?? smtpUser,
      subject: `Lambda – Mistake Report: "${item.title}"`,
      text: `${reporterLine}\n\nQuestion: "${item.title}"${linkLine}\n\nMistake description:\n${errorText}`,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async assertVersionAuthorOrItemAuthor(
    contentItemId: string,
    versionId: string,
    userId: string,
  ): Promise<void> {
    const [{ data: version }, { data: item }] = await Promise.all([
      this.db.from('course_versions').select('author_id').eq('id', versionId).single(),
      this.db.from('content_items').select('author_id').eq('id', contentItemId).single(),
    ]);

    const isVersionAuthor = version?.author_id === userId;
    const isItemAuthor = item?.author_id === userId;

    if (!isVersionAuthor && !isItemAuthor) {
      throw new ForbiddenException('Not authorized to remove this item from the version');
    }
  }
}
