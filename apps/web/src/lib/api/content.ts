import { api } from './client';
import type { Topic, VersionContentItem, AlgorithmMetadata } from '@lambda/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function uploadContentImage(contentItemId: string, file: File): Promise<{ url: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API_URL}/api/content/${contentItemId}/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Upload failed');
  }
  return res.json();
}

export const topicsApi = {
  getByVersion: (versionId: string) =>
    api.get<Topic[]>(`/api/topics?version_id=${versionId}`),

  createTopic: (body: { version_id: string; title: string; description?: string; order_index: number }) =>
    api.post<Topic>('/api/topics', body),

  updateTopic: (id: string, body: { title?: string; order_index?: number }) =>
    api.put<void>(`/api/topics/${id}`, body),

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
    version_id?: string;
    type?: string;
    title?: string;
    content?: string;
    solution?: string | null;
    difficulty?: string | null;
    tags?: string[];
    metadata?: AlgorithmMetadata;
    topic_id?: string | null;
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
    metadata?: AlgorithmMetadata;
  }) => api.post<VersionContentItem>('/api/content', body),

  uploadImage: uploadContentImage,

  searchTitles: (courseId: string, q: string) =>
    api.get<string[]>(`/api/content/search?course_id=${encodeURIComponent(courseId)}&q=${encodeURIComponent(q)}`),

  deleteImage: async (contentItemId: string, url: string): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    await fetch(`${API_URL}/api/content/${contentItemId}/images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ url }),
    });
  },
};
