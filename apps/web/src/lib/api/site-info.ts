import { api } from './client';

export const siteInfoApi = {
  get: () => api.get<{ content: string }>('/api/site-info'),
  update: (content: string) => api.put<{ content: string }>('/api/site-info', { content }),
};
