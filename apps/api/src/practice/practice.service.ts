import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { PracticeMode, VersionContentItem, ProgressStatus } from '@lambda/shared';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

export interface ProgressCounts { unseen: number; incorrect: number; needs_review: number; solved: number; easy: number; }
export interface FormatCounts { flashcard: number; multiple_choice: number; open: number; }
export interface TopicCounts {
  total: number; exam_question: number; exercise_question: number;
  flashcard: number; multiple_choice: number; open: number;
  progress: ProgressCounts;
  format_by_type: { exam_question: FormatCounts; exercise_question: FormatCounts };
  progress_by_type: { exam_question: ProgressCounts; exercise_question: ProgressCounts };
}

@Injectable()
export class PracticeService {
  private get db() {
    return getSupabaseClient();
  }

  // ─── Build Practice Session ─────────────────────────────────────────────────

  async getOptions(versionId: string, userId: string, withSolution = false) {
    const [{ data: itemsRaw, error }, { data: topics }, { data: progressRows }] = await Promise.all([
      this.db
        .from('version_content_items')
        .select('content_item_id, topic_id, content_item:content_items(type, metadata, solution)')
        .eq('version_id', versionId),
      this.db
        .from('topics')
        .select('id, title')
        .eq('version_id', versionId)
        .order('order_index'),
      this.db
        .from('user_progress')
        .select('content_item_id, status')
        .eq('version_id', versionId)
        .eq('user_id', userId),
    ]);

    if (error) throw new InternalServerErrorException(error.message);

    // Optionally filter to only items that have a solution
    let items = itemsRaw ?? [];
    if (withSolution && items.length > 0) {
      const contentItemIds = items.map((i) => i.content_item_id);
      const { data: communityRows } = await this.db
        .from('solutions')
        .select('content_item_id')
        .in('content_item_id', contentItemIds);
      const communitySet = new Set((communityRows ?? []).map((r) => r.content_item_id));
      items = items.filter((i) => {
        const ci = i.content_item as any;
        if (ci.type !== 'exam_question' && ci.type !== 'exercise_question') return true;
        const fmt = ci.metadata?.question_format;
        if (fmt === 'flashcard' || fmt === 'multiple_choice') return true;
        const hasImageSolution = (ci.metadata?.sections?.slice(1) ?? []).some((s: any) => s.images?.length);
        return ci.solution?.trim() || hasImageSolution || communitySet.has(i.content_item_id);
      });
    }

    const emptyProgress = (): ProgressCounts => ({ unseen: 0, incorrect: 0, needs_review: 0, solved: 0, easy: 0 });
    const emptyFormatCounts = (): FormatCounts => ({ flashcard: 0, multiple_choice: 0, open: 0 });
    const emptyTopicCounts = (): TopicCounts => ({
      total: 0, exam_question: 0, exercise_question: 0, flashcard: 0, multiple_choice: 0, open: 0,
      progress: emptyProgress(),
      format_by_type: { exam_question: emptyFormatCounts(), exercise_question: emptyFormatCounts() },
      progress_by_type: { exam_question: emptyProgress(), exercise_question: emptyProgress() },
    });
    const incProgress = (p: ProgressCounts, status: string | undefined) => {
      if (!status || status === 'skipped') p.unseen++;
      else if (status === 'incorrect') p.incorrect++;
      else if (status === 'needs_review') p.needs_review++;
      else if (status === 'solved') p.solved++;
      else if (status === 'easy') p.easy++;
    };

    const topicCounts: Record<string, TopicCounts> = {};
    const progressByType: Record<string, ProgressCounts> = {
      exam_question: emptyProgress(),
      exercise_question: emptyProgress(),
      proof: emptyProgress(),
      algorithm: emptyProgress(),
    };
    const formatByType = {
      exam_question: emptyFormatCounts(),
      exercise_question: emptyFormatCounts(),
    };
    const progressByTypeFormat = {
      exam_question: { flashcard: emptyProgress(), multiple_choice: emptyProgress(), open: emptyProgress() },
      exercise_question: { flashcard: emptyProgress(), multiple_choice: emptyProgress(), open: emptyProgress() },
    };

    let exam_question = 0, exercise_question = 0, proof = 0, algorithm = 0;
    let flashcard = 0, multiple_choice = 0, open = 0;

    const progressMap = new Map((progressRows ?? []).map((p) => [p.content_item_id, p.status]));
    let p_unseen = 0, p_incorrect = 0, p_needs_review = 0, p_solved = 0, p_easy = 0;

    for (const row of items) {
      const ci = row.content_item as any;
      const status = progressMap.get(row.content_item_id);

      if (ci.type === 'exam_question') { exam_question++; incProgress(progressByType.exam_question, status); }
      if (ci.type === 'exercise_question') { exercise_question++; incProgress(progressByType.exercise_question, status); }
      if (ci.type === 'proof') { proof++; incProgress(progressByType.proof, status); }
      if (ci.type === 'algorithm') { algorithm++; incProgress(progressByType.algorithm, status); }
      const fmt = ci.metadata?.question_format;
      const isQuestion = ci.type === 'exam_question' || ci.type === 'exercise_question';
      if (fmt === 'flashcard') flashcard++;
      else if (fmt === 'multiple_choice') multiple_choice++;
      else if (isQuestion) open++;

      // Track format × type breakdown and progress × type × format
      if (isQuestion) {
        const fmtKey: 'flashcard' | 'multiple_choice' | 'open' =
          fmt === 'flashcard' ? 'flashcard' : fmt === 'multiple_choice' ? 'multiple_choice' : 'open';
        const typeKey = ci.type as 'exam_question' | 'exercise_question';
        formatByType[typeKey][fmtKey]++;
        incProgress(progressByTypeFormat[typeKey][fmtKey], status);
      }

      if (!status || status === 'skipped') p_unseen++;
      else if (status === 'incorrect') p_incorrect++;
      else if (status === 'needs_review') p_needs_review++;
      else if (status === 'solved') p_solved++;
      else if (status === 'easy') p_easy++;

      if (row.topic_id) {
        if (!topicCounts[row.topic_id]) topicCounts[row.topic_id] = emptyTopicCounts();
        const tc = topicCounts[row.topic_id];
        tc.total++;
        if (ci.type === 'exam_question') tc.exam_question++;
        if (ci.type === 'exercise_question') tc.exercise_question++;
        if (fmt === 'flashcard') tc.flashcard++;
        else if (fmt === 'multiple_choice') tc.multiple_choice++;
        else if (isQuestion) tc.open++;
        incProgress(tc.progress, status);

        // Per-topic: format × type and progress × type
        if (isQuestion) {
          const fmtKey: 'flashcard' | 'multiple_choice' | 'open' =
            fmt === 'flashcard' ? 'flashcard' : fmt === 'multiple_choice' ? 'multiple_choice' : 'open';
          const typeKey = ci.type as 'exam_question' | 'exercise_question';
          tc.format_by_type[typeKey][fmtKey]++;
          incProgress(tc.progress_by_type[typeKey], status);
        }
      }
    }

    const topicsOut = (topics ?? [])
      .map((t) => ({ id: t.id, title: t.title, counts: topicCounts[t.id] ?? emptyTopicCounts() }))
      .filter((t) => t.counts.total > 0);

    return {
      topics: topicsOut,
      counts: {
        total: items.length,
        exam_question, exercise_question, proof, algorithm,
        flashcard, multiple_choice, open,
        progress: { unseen: p_unseen, incorrect: p_incorrect, needs_review: p_needs_review, solved: p_solved, easy: p_easy },
        progress_by_type: progressByType,
        format_by_type: formatByType,
        progress_by_type_format: progressByTypeFormat,
      },
    };
  }

  async getSession(params: {
    version_id: string;
    topic_ids?: string[];
    no_topic?: boolean;
    type?: string;
    question_formats?: string[];
    mode: PracticeMode;
    userId: string;
    with_solution?: boolean;
    limit?: number;
    progress_filter?: string;
  }): Promise<VersionContentItem[]> {
    // Load all items for this version (+ optional topic filter)
    let query = this.db
      .from('version_content_items')
      .select('version_id, content_item_id, topic_id, content_item:content_items(*)')
      .eq('version_id', params.version_id);

    if (params.topic_ids?.length && params.no_topic) {
      query = query.or(`topic_id.in.(${params.topic_ids.join(',')}),topic_id.is.null`);
    } else if (params.topic_ids?.length) {
      query = query.in('topic_id', params.topic_ids);
    } else if (params.no_topic) {
      query = query.is('topic_id', null);
    }

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException(error.message);

    let items = data as unknown as VersionContentItem[];

    // Filter by content type if requested (supports comma-separated list)
    if (params.type) {
      const typeSet = new Set(params.type.split(','));
      items = items.filter((i) => typeSet.has(i.content_item.type));
    }

    // Filter by question format(s) if requested
    // 'open' means: exam/exercise question without flashcard or multiple_choice format
    if (params.question_formats?.length) {
      const fmtSet = new Set(params.question_formats);
      items = items.filter((i) => {
        const fmt = i.content_item.metadata?.question_format;
        const isQuestion = i.content_item.type === 'exam_question' || i.content_item.type === 'exercise_question';
        if (fmt === 'flashcard' && fmtSet.has('flashcard')) return true;
        if (fmt === 'multiple_choice' && fmtSet.has('multiple_choice')) return true;
        if (fmtSet.has('open') && isQuestion && fmt !== 'flashcard' && fmt !== 'multiple_choice') return true;
        return false;
      });
    }

    // Filter to only items with a solution (official or community)
    if (params.with_solution && items.length > 0) {
      const contentItemIds = items.map((i) => i.content_item_id);
      const { data: communityRows } = await this.db
        .from('solutions')
        .select('content_item_id')
        .in('content_item_id', contentItemIds);

      const communitySet = new Set((communityRows ?? []).map((r) => r.content_item_id));
      items = items.filter((i) => {
        if (i.content_item.type !== 'exam_question' && i.content_item.type !== 'exercise_question') return true;
        const fmt = i.content_item.metadata?.question_format;
        if (fmt === 'flashcard' || fmt === 'multiple_choice') return true;
        const hasImageSolution = (i.content_item.metadata?.sections?.slice(1) ?? []).some((s: any) => s.images?.length);
        return i.content_item.solution?.trim() || hasImageSolution || communitySet.has(i.content_item_id);
      });
    }

    if (items.length === 0) return [];

    // Fetch user progress once for all remaining items
    const ids = items.map((i) => i.content_item_id);
    const { data: progressRows } = await this.db
      .from('user_progress')
      .select('content_item_id, status, last_attempt_at')
      .eq('user_id', params.userId)
      .eq('version_id', params.version_id)
      .in('content_item_id', ids);

    const progressMap = new Map(
      (progressRows ?? []).map((p) => [p.content_item_id, p]),
    );

    // Filter by progress status if requested (comma-separated, OR logic)
    // 'ok'     = flashcard with status 'solved'
    // 'solved' = non-flashcard (open/MCQ) with status 'solved'
    if (params.progress_filter) {
      const filterSet = new Set(params.progress_filter.split(','));
      items = items.filter((i) => {
        const p = progressMap.get(i.content_item_id);
        const isFlashcard = i.content_item.metadata?.question_format === 'flashcard';
        if (filterSet.has('unseen') && (!p || p.status === 'skipped')) return true;
        if (!p || p.status === 'skipped') return false;
        if (filterSet.has('ok')           && isFlashcard  && p.status === 'solved') return true;
        if (filterSet.has('solved')       && !isFlashcard && p.status === 'solved') return true;
        if (filterSet.has('incorrect')    && p.status === 'incorrect')    return true;
        if (filterSet.has('needs_review') && p.status === 'needs_review') return true;
        if (filterSet.has('easy')         && p.status === 'easy')         return true;
        return false;
      });
      if (items.length === 0) return [];
    }

    // Attach user_progress to each item
    items = items.map((i) => {
      const p = progressMap.get(i.content_item_id);
      return {
        ...i,
        user_progress: p ? { status: p.status as ProgressStatus, last_attempt_at: p.last_attempt_at } : null,
      };
    }) as unknown as VersionContentItem[];

    const ordered = await this.applyMode(items, params.mode, progressMap);
    return params.limit ? ordered.slice(0, params.limit) : ordered;
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
    progressMap: Map<string, any>,
  ): Promise<VersionContentItem[]> {
    switch (mode) {
      case 'random':
      case 'exam':
        return shuffle(items);

      case 'topic':
        return items;

      case 'spaced_repetition':
        return this.applySpacedRepetition(items, progressMap);
    }
  }

  private applySpacedRepetition(
    items: VersionContentItem[],
    progressMap: Map<string, any>,
  ): VersionContentItem[] {
    // Priority groups:
    //   1. needs_review or incorrect (most urgent)
    //   2. never attempted (unseen)
    //   3. solved / ok
    //   4. easy (least urgent — well mastered)
    const urgent: VersionContentItem[] = [];
    const unseen: VersionContentItem[] = [];
    const done: VersionContentItem[] = [];
    const easy: VersionContentItem[] = [];

    for (const item of items) {
      const progress = progressMap.get(item.content_item_id);
      if (!progress) {
        unseen.push(item);
      } else if (progress.status === 'needs_review' || progress.status === 'incorrect') {
        urgent.push(item);
      } else if (progress.status === 'easy') {
        easy.push(item);
      } else {
        done.push(item);
      }
    }

    return [...shuffle(urgent), ...shuffle(unseen), ...shuffle(done), ...shuffle(easy)];
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
