import { api } from './client';
import type { Topic, VersionContentItem } from '@lambda/shared';

export const topicsApi = {
  getByVersion: (versionId: string) =>
    api.get<Topic[]>(`/api/topics?version_id=${versionId}`),

  createTopic: (body: { version_id: string; title: string; description?: string; order_index: number }) =>
    api.post<Topic>('/api/topics', body),

  deleteTopic: (id: string) =>
    api.delete<void>(`/api/topics/${id}`),
};

export const contentApi = {
  listByVersion: (params: {
    version_id: string;
    topic_id?: string;
    type?: string;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    ).toString();
    return api.get<VersionContentItem[]>(`/api/content?${query}`);
  },

  updateItem: (id: string, body: {
    title?: string;
    content?: string;
    solution?: string;
    difficulty?: string;
    tags?: string[];
    metadata?: Record<string, string>;
  }) => api.put<void>(`/api/content/${id}`, body),

  deleteItem: (contentItemId: string, versionId: string) =>
    api.delete<void>(`/api/content/${contentItemId}/from/${versionId}`),

  createItem: (body: {
    version_id: string;
    topic_id?: string;
    type: string;
    title: string;
    content: string;
    solution?: string;
    difficulty?: string;
    tags?: string[];
    metadata?: Record<string, string>;
  }) => api.post<VersionContentItem>('/api/content', body),
};
