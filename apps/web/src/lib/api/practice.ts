import { api } from './client';
import type { VersionContentItem, PracticeMode, ProgressStatus } from '@lambda/shared';

export interface ProgressCounts {
  unseen: number;
  incorrect: number;
  needs_review: number;
  solved: number;
  ok: number;
  easy: number;
}

export interface TopicCounts {
  total: number;
  exam_question: number;
  exercise_question: number;
  flashcard: number;
  multiple_choice: number;
  open: number;
  progress: ProgressCounts;
  format_by_type: {
    exam_question: { flashcard: number; multiple_choice: number; open: number };
    exercise_question: { flashcard: number; multiple_choice: number; open: number };
  };
  progress_by_type: {
    exam_question: ProgressCounts;
    exercise_question: ProgressCounts;
  };
}

export interface PracticeOptions {
  topics: { id: string; title: string; counts: TopicCounts }[];
  counts: {
    total: number;
    exam_question: number;
    exercise_question: number;
    proof: number;
    algorithm: number;
    flashcard: number;
    multiple_choice: number;
    open: number;
    progress: ProgressCounts;
    progress_by_type: {
      exam_question: ProgressCounts;
      exercise_question: ProgressCounts;
      proof: ProgressCounts;
      algorithm: ProgressCounts;
    };
    format_by_type: {
      exam_question: { flashcard: number; multiple_choice: number; open: number };
      exercise_question: { flashcard: number; multiple_choice: number; open: number };
    };
    progress_by_type_format: {
      exam_question: { flashcard: ProgressCounts; multiple_choice: ProgressCounts; open: ProgressCounts };
      exercise_question: { flashcard: ProgressCounts; multiple_choice: ProgressCounts; open: ProgressCounts };
    };
  };
}

export const practiceApi = {
  getOptions: (version_id: string, with_solution?: boolean) =>
    api.get<PracticeOptions>(`/api/practice/options?version_id=${version_id}${with_solution ? '&with_solution=true' : ''}`),

  getSession: (params: {
    version_id: string;
    mode: PracticeMode;
    topic_ids?: string[];
    no_topic?: boolean;
    type?: string;
    question_formats?: string[];
    with_solution?: boolean;
    limit?: number;
    progress_filter?: string;
  }) => {
    const { topic_ids, no_topic, question_formats, ...rest } = params;
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v) flat[k] = String(v);
    }
    if (topic_ids?.length) flat['topic_id'] = topic_ids.join(',');
    if (no_topic) flat['no_topic'] = 'true';
    if (question_formats?.length) flat['question_format'] = question_formats.join(',');
    const query = new URLSearchParams(flat).toString();
    return api.get<VersionContentItem[]>(`/api/practice/session?${query}`);
  },

  submitAttempt: (body: {
    version_id: string;
    content_item_id: string;
    is_correct?: boolean;
    status?: ProgressStatus;
    time_spent_seconds?: number;
  }) => api.post<void>('/api/practice/attempt', body),
};
