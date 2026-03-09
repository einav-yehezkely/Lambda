import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { ContentItem, VersionContentItem } from '@lambda/shared';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { VoteContentDto } from './dto/vote-content.dto';

@Injectable()
export class ContentService {
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
      .select('version_id, content_item_id, topic_id, content_items(*)')
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
      .select('version_id, content_item_id, topic_id, content_items(*)')
      .single();

    if (junctionError) throw new InternalServerErrorException(junctionError.message);
    return junction as unknown as VersionContentItem;
  }

  // ─── Update content item (author only) ──────────────────────────────────────

  async updateItem(id: string, dto: UpdateContentDto, userId: string): Promise<ContentItem> {
    const item = await this.getItem(id);
    if (item.author_id !== userId) {
      throw new ForbiddenException('Only the author can edit this content item');
    }

    const { topic_id, ...itemData } = dto;

    // Update content_items row
    const { data, error } = await this.db
      .from('content_items')
      .update(itemData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // If topic_id provided, update ALL junction rows for this item
    // (reassigns topic across all versions that reference it — only makes sense for the caller's version)
    // Callers should pass version_id explicitly if they want version-scoped reassignment.
    // For MVP: update junction rows where the user is version author.
    if (topic_id !== undefined) {
      await this.db
        .from('version_content_items')
        .update({ topic_id })
        .eq('content_item_id', id);
    }

    return data as ContentItem;
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
