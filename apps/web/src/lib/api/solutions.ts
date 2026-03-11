import { api } from './client';
import type { Solution } from '@lambda/shared';

export const solutionsApi = {
  listByItem: (contentItemId: string) =>
    api.get<Solution[]>(`/api/solutions?content_item_id=${contentItemId}`),

  create: (body: { content_item_id: string; content: string }) =>
    api.post<Solution>('/api/solutions', body),

  update: (id: string, body: { content: string }) =>
    api.put<Solution>(`/api/solutions/${id}`, body),

  remove: (id: string) =>
    api.delete<void>(`/api/solutions/${id}`),

  vote: (id: string, vote: 1 | -1) =>
    api.post<void>(`/api/solutions/${id}/vote`, { vote }),
};
