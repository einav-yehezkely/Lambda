import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { PracticeMode, VersionContentItem, ProgressStatus } from '@lambda/shared';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

@Injectable()
export class PracticeService {
  private get db() {
    return getSupabaseClient();
  }

  // ─── Build Practice Session ─────────────────────────────────────────────────

  async getSession(params: {
    version_id: string;
    topic_id?: string;
    type?: string;
    mode: PracticeMode;
    userId: string;
    with_solution?: boolean;
  }): Promise<VersionContentItem[]> {
    // Load all items for this version (+ optional topic filter)
    let query = this.db
      .from('version_content_items')
      .select('version_id, content_item_id, topic_id, content_item:content_items(*)')
      .eq('version_id', params.version_id);

    if (params.topic_id) {
      query = query.eq('topic_id', params.topic_id);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    let items = data as unknown as VersionContentItem[];

    // Filter by content type if requested
    if (params.type) {
      items = items.filter((i) => i.content_item.type === params.type);
    }

    // Filter to only items with a solution (official or community)
    if (params.with_solution && items.length > 0) {
      const contentItemIds = items.map((i) => i.content_item_id);
      const { data: communityRows } = await this.db
        .from('solutions')
        .select('content_item_id')
        .in('content_item_id', contentItemIds);

      const communitySet = new Set((communityRows ?? []).map((r) => r.content_item_id));
      items = items.filter(
        (i) => i.content_item.solution?.trim() || communitySet.has(i.content_item_id),
      );
    }

    if (items.length === 0) return [];

    return this.applyMode(items, params.mode, params.userId, params.version_id);
  }

  // ─── Submit Attempt ─────────────────────────────────────────────────────────

  async submitAttempt(dto: SubmitAttemptDto, userId: string): Promise<void> {
    if (dto.is_correct === undefined && dto.status === undefined) {
      throw new BadRequestException('Either is_correct or status must be provided');
    }

    // Derive final progress status
    const status: ProgressStatus =
      dto.status ?? (dto.is_correct ? 'solved' : 'incorrect');

    // Upsert user_progress
    const { error: progressError } = await this.db
      .from('user_progress')
      .upsert(
        {
          user_id: userId,
          version_id: dto.version_id,
          content_item_id: dto.content_item_id,
          status,
          last_attempt_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,content_item_id,version_id' },
      );

    if (progressError) throw new InternalServerErrorException(progressError.message);

    // Insert attempt record
    const { error: attemptError } = await this.db.from('attempts').insert({
      user_id: userId,
      content_item_id: dto.content_item_id,
      answer: dto.answer ?? null,
      is_correct: dto.is_correct ?? null,
      time_spent_seconds: dto.time_spent_seconds ?? null,
    });

    if (attemptError) throw new InternalServerErrorException(attemptError.message);
  }

  // ─── Mode Strategies ────────────────────────────────────────────────────────

  private async applyMode(
    items: VersionContentItem[],
    mode: PracticeMode,
    userId: string,
    versionId: string,
  ): Promise<VersionContentItem[]> {
    switch (mode) {
      case 'random':
      case 'exam':
        return shuffle(items);

      case 'topic':
        // Already filtered by topic_id in getSession; just return as-is
        return items;

      case 'spaced_repetition':
        return this.applySpacedRepetition(items, userId, versionId);
    }
  }

  private async applySpacedRepetition(
    items: VersionContentItem[],
    userId: string,
    versionId: string,
  ): Promise<VersionContentItem[]> {
    const ids = items.map((i) => i.content_item_id);

    const { data: progressRows } = await this.db
      .from('user_progress')
      .select('content_item_id, status, last_attempt_at')
      .eq('user_id', userId)
      .eq('version_id', versionId)
      .in('content_item_id', ids);

    const progressMap = new Map(
      (progressRows ?? []).map((p) => [p.content_item_id, p]),
    );

    // Priority groups:
    //   1. needs_review or incorrect (most urgent)
    //   2. never attempted (unseen)
    //   3. solved (least urgent)
    const urgent: VersionContentItem[] = [];
    const unseen: VersionContentItem[] = [];
    const done: VersionContentItem[] = [];

    for (const item of items) {
      const progress = progressMap.get(item.content_item_id);
      if (!progress) {
        unseen.push(item);
      } else if (progress.status === 'needs_review' || progress.status === 'incorrect') {
        urgent.push(item);
      } else {
        done.push(item);
      }
    }

    return [...shuffle(urgent), ...shuffle(unseen), ...shuffle(done)];
  }
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
