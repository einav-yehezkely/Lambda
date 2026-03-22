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

  async updateItem(id: string, dto: UpdateContentDto, userId: string, isAdmin = false): Promise<ContentItem> {
    const item = await this.getItem(id);
    const { version_id, topic_id, ...itemData } = dto;

    // Count how many versions reference this content item
    const { data: usages } = await this.db
      .from('version_content_items')
      .select('version_id')
      .eq('content_item_id', id);

    const isShared = (usages?.length ?? 0) > 1;

    if (!isShared && (item.author_id === userId || isAdmin)) {
      // Not shared + user is the author (or admin) → update in-place
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

    if (!isAdmin && (!version || version.author_id !== userId)) {
      throw new ForbiddenException('Only the version author can edit shared content items');
    }

    // Create a copy with edits applied, owned by the editor
    const { data: newItem, error: copyError } = await this.db
      .from('content_items')
      .insert({
        type: itemData.type ?? item.type,
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

  async deleteItem(id: string, userId: string, isAdmin = false): Promise<void> {
    const item = await this.getItem(id);
    if (!isAdmin && item.author_id !== userId) {
      throw new ForbiddenException('Only the author can delete this content item');
    }

    // Clean up section images from storage
    const sectionImages = (item.metadata?.sections ?? []).flatMap((s) => s.images ?? []);
    if (sectionImages.length > 0) {
      const marker = '/content-images/';
      const paths = sectionImages
        .map((url) => { const idx = url.indexOf(marker); return idx !== -1 ? url.slice(idx + marker.length) : null; })
        .filter(Boolean) as string[];
      if (paths.length > 0) {
        await this.db.storage.from('content-images').remove(paths);
      }
    }

    const { error } = await this.db.from('content_items').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  // ─── Remove from version (junction only, item preserved) ────────────────────

  async removeFromVersion(contentItemId: string, versionId: string, userId: string, isAdmin = false): Promise<void> {
    if (!isAdmin) await this.assertVersionAuthorOrItemAuthor(contentItemId, versionId, userId);

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

  private buildReportErrorHtml(params: {
    authorName: string;
    itemTitle: string;
    errorText: string;
    itemLink: string | null;
    reporterUsername: string | null;
    appUrl: string;
  }): string {
    const { authorName, itemTitle, errorText, itemLink, reporterUsername, appUrl } = params;

    const inlineLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="44" viewBox="963 -194 979 1434" style="display:block;margin:0 auto 8px;"><path style="fill:#0f172a;fill-rule:evenodd" d="M1941.7986 938.2071L1905.7586 938.2071C1895.7486 1043.6671 1853.3686 1096.3871 1778.6186 1096.3871 1734.5686 1096.3871 1696.6886 1074.1971 1664.9886 1029.8171Q1617.4386 963.2371 1574.3886 766.0171L1503.3086 448.6681Q1428.2286 110.2941 1392.6886 2.6721C1368.9886-69.0729 1340.9586-119.7959 1308.5886-149.4969 1276.2186-179.195 1242.0186-194.0448 1205.9786-194.0462 1149.9186-194.0448 1103.1986-164.512 1065.8186-105.4479 1028.4486-46.3809 1008.7586 32.2061 1006.7586 130.3141L1042.7986 130.3141C1046.1386 69.5811 1061.9886 24.6981 1090.3486-4.3359 1118.7186-33.3669 1151.9186-47.8829 1189.9586-47.8839 1237.3486-47.8829 1277.0586-19.1839 1309.0886 38.2121Q1357.1486 124.3091 1391.1886 303.5061L962.7086 1226.5371 1151.9186 1226.5371 1450.2486 549.7801 1536.3486 938.2071C1567.0486 1076.3671 1601.7486 1161.2971 1640.4586 1192.9971 1679.1686 1224.6971 1719.5486 1240.5471 1761.5986 1240.5471 1812.9886 1240.5471 1855.8686 1216.5171 1890.2386 1168.4671 1924.6086 1120.4171 1941.7986 1043.6671 1941.7986 938.2071Z"/></svg>`;

    const reporterHtml = reporterUsername
      ? `<a href="${appUrl}/profile/${reporterUsername}" style="color:#1e3a8a;text-decoration:none;font-weight:600;">${reporterUsername}</a>`
      : 'Anonymous';

    const ctaButton = itemLink ? `
              <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
                <tr>
                  <td style="background:#1e3a8a;border-radius:8px;">
                    <a href="${itemLink}"
                      style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      View question →
                    </a>
                  </td>
                </tr>
              </table>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              ${inlineLogo}
              <span style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">Lambda</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:36px 36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
                Mistake report on your question
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
                Hi ${authorName},
              </p>

              <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.6;">
                ${reporterHtml} reported a possible mistake in your question:
                <strong style="color:#0f172a;">${itemTitle}</strong>
              </p>

              <!-- Error box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
                <tr>
                  <td style="background:#f8fafc;border-left:3px solid #e2e8f0;border-radius:4px;padding:14px 16px;">
                    <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;white-space:pre-wrap;">${errorText}</p>
                  </td>
                </tr>
              </table>
              ${ctaButton}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Lambda — the community learning platform<br />
                <a href="${appUrl}" style="color:#94a3b8;">${appUrl}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

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

    const appUrl = this.config.get<string>('APP_URL') ?? 'https://lambda-site.vercel.app';

    const reporterLine = reporterUsername
      ? `Reported by: ${reporterUsername} (${appUrl}/profile/${reporterUsername})`
      : 'Reported by: Anonymous';
    const linkLine = itemLink ? `\nLink to question: ${itemLink}` : '';
    const plainText = `${reporterLine}\n\nQuestion: "${item.title}"${linkLine}\n\nMistake description:\n${errorText}`;

    const html = this.buildReportErrorHtml({
      authorName: author?.username ?? 'there',
      itemTitle: item.title,
      errorText,
      itemLink,
      reporterUsername: reporterUsername ?? null,
      appUrl,
    });

    await transporter.sendMail({
      from: smtpUser,
      to: author?.email ?? smtpUser,
      cc: 'simplifye.solutions@gmail.com',
      subject: `Lambda – Mistake Report: "${item.title}"`,
      text: plainText,
      html,
    });
  }

  // ─── Upload image to storage (URL stored client-side in section metadata) ────

  async uploadImage(
    contentItemId: string,
    file: { buffer: Buffer; size: number; mimetype: string },
    userId: string,
    isAdmin = false,
  ): Promise<{ url: string }> {
    const item = await this.getItem(contentItemId);
    if (!isAdmin && item.author_id !== userId) {
      throw new ForbiddenException('Only the author can upload images');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Compressed image size exceeds 2 MB limit');
    }

    const imageId = crypto.randomUUID();
    const storagePath = `${contentItemId}/${imageId}.webp`;

    const { error: storageErr } = await this.db.storage
      .from('content-images')
      .upload(storagePath, file.buffer, { contentType: 'image/webp', upsert: false });

    if (storageErr) throw new InternalServerErrorException(storageErr.message);

    const { data: urlData } = this.db.storage.from('content-images').getPublicUrl(storagePath);
    return { url: urlData.publicUrl };
  }

  // ─── Delete a single image from storage ─────────────────────────────────────

  async deleteImage(contentItemId: string, imageUrl: string, userId: string, isAdmin = false): Promise<void> {
    const item = await this.getItem(contentItemId);
    if (!isAdmin && item.author_id !== userId) {
      throw new ForbiddenException('Only the author can delete images');
    }

    const marker = '/content-images/';
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) throw new BadRequestException('Invalid image URL');
    const storagePath = imageUrl.slice(idx + marker.length);

    await this.db.storage.from('content-images').remove([storagePath]);
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
