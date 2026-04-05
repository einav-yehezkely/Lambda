import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { getSupabaseClient } from '../common/supabase.client';
import { Solution } from '@lambda/shared';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { VoteSolutionDto } from './dto/vote-solution.dto';

@Injectable()
export class SolutionsService {
  constructor(private readonly config: ConfigService) {}

  private get db() {
    return getSupabaseClient();
  }

  // ─── List solutions for a content item ───────────────────────────────────────

  async listByItem(contentItemId: string, requestingUserId?: string): Promise<Solution[]> {
    const { data, error } = await this.db
      .from('solutions')
      .select('*, author:users!solutions_author_id_fkey(username, display_name, avatar_url), solution_votes(user_id, vote)')
      .eq('content_item_id', contentItemId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);

    return (data as any[]).map((row) => {
      const votes: { user_id: string; vote: number }[] = row.solution_votes ?? [];
      const vote_count = votes.reduce((sum: number, v) => sum + v.vote, 0);
      const user_vote = requestingUserId
        ? (votes.find((v) => v.user_id === requestingUserId)?.vote ?? null)
        : null;
      const { solution_votes: _sv, ...rest } = row;
      return { ...rest, vote_count, user_vote } as Solution;
    }).sort((a, b) => b.vote_count - a.vote_count);
  }

  // ─── Create solution ──────────────────────────────────────────────────────────

  async create(dto: CreateSolutionDto, userId: string): Promise<Solution> {
    const { data, error } = await this.db
      .from('solutions')
      .insert({ content_item_id: dto.content_item_id, author_id: userId, content: dto.content })
      .select('*, author:users!solutions_author_id_fkey(username, display_name, avatar_url)')
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    this.notifyAdminNewSolution(dto.content_item_id, (data as any).author?.username ?? null, dto.content).catch(() => null);

    return { ...(data as any), vote_count: 0, user_vote: null } as Solution;
  }

  // ─── Update solution (author only) ───────────────────────────────────────────

  async update(id: string, content: string, userId: string): Promise<Solution> {
    const solution = await this.getOrThrow(id);
    if (solution.author_id !== userId) {
      throw new ForbiddenException('Only the author can edit this solution');
    }

    const { data, error } = await this.db
      .from('solutions')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, author:users!solutions_author_id_fkey(username, display_name, avatar_url)')
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return { ...(data as any), vote_count: 0, user_vote: null } as Solution;
  }

  // ─── Delete solution (author only) ───────────────────────────────────────────

  async remove(id: string, userId: string): Promise<void> {
    const solution = await this.getOrThrow(id);
    if (solution.author_id !== userId) {
      throw new ForbiddenException('Only the author can delete this solution');
    }

    const { error } = await this.db.from('solutions').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  // ─── Vote ─────────────────────────────────────────────────────────────────────

  async vote(id: string, dto: VoteSolutionDto, userId: string): Promise<void> {
    await this.getOrThrow(id);

    const { error } = await this.db
      .from('solution_votes')
      .upsert(
        { user_id: userId, solution_id: id, vote: dto.vote },
        { onConflict: 'user_id,solution_id' },
      );

    if (error) throw new InternalServerErrorException(error.message);
  }

  // ─── Admin email notification ─────────────────────────────────────────────────

  private async notifyAdminNewSolution(contentItemId: string, authorUsername: string | null, content: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const adminEmail = this.config.get<string>('ADMIN_EMAIL');
    if (!apiKey || !adminEmail) return;

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://lambda-site.vercel.app';
    const from = this.config.get<string>('RESEND_FROM') ?? 'Lambda <noreply@lambda-learn.com>';

    const { data: item } = await this.db
      .from('content_items')
      .select('title')
      .eq('id', contentItemId)
      .single();

    const { data: junction } = await this.db
      .from('version_content_items')
      .select('version_id, course_version:course_versions!version_content_items_version_id_fkey(template_id)')
      .eq('content_item_id', contentItemId)
      .limit(1)
      .single();

    const templateId = (junction?.course_version as any)?.template_id;
    const versionId = junction?.version_id;
    const itemLink = templateId && versionId
      ? `${frontendUrl}/courses/${templateId}/versions/${versionId}`
      : null;

    const authorLine = authorUsername
      ? `By: ${authorUsername} (${frontendUrl}/profile/${authorUsername})`
      : 'By: Anonymous';
    const linkLine = itemLink ? `\nLink: ${itemLink}` : '';

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: adminEmail,
      subject: `Lambda – New Community Solution: "${item?.title ?? contentItemId}"`,
      text: `${authorLine}\nQuestion: "${item?.title ?? contentItemId}"${linkLine}\n\nSolution:\n${content}`,
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async getOrThrow(id: string): Promise<{ id: string; author_id: string }> {
    const { data, error } = await this.db
      .from('solutions')
      .select('id, author_id')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Solution not found');
    return data as { id: string; author_id: string };
  }
}
