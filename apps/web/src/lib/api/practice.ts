import { api } from './client';
import type { VersionContentItem, PracticeMode, ProgressStatus } from '@lambda/shared';

export const practiceApi = {
  getSession: (params: {
    version_id: string;
    mode: PracticeMode;
    topic_id?: string;
    type?: string;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ).toString();
    return api.get<VersionContentItem[]>(`/api/practice/session?${query}`);
  },

  submitAttempt: (body: {
    content_item_id: string;
    is_correct?: boolean;
    status?: ProgressStatus;
    time_spent_seconds?: number;
  }) => api.post<void>('/api/practice/attempt', body),
};
