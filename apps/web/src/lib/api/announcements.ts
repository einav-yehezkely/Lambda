import { api } from './client';
import type { Announcement } from '@lambda/shared';

export const announcementsApi = {
  list: () => api.get<Announcement[]>('/api/announcements'),

  create: (body: { title: string; content?: string }) =>
    api.post<Announcement>('/api/announcements', body),

  delete: (id: string) => api.delete<void>(`/api/announcements/${id}`),

  markAllRead: () => api.post<void>('/api/announcements/mark-all-read', {}),
};
