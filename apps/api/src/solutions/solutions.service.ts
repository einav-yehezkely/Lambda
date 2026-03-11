import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { Solution } from '@lambda/shared';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { VoteSolutionDto } from './dto/vote-solution.dto';

@Injectable()
export class SolutionsService {
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
