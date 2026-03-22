import { api } from './client';
import type { CourseRequest, CourseTemplate } from '@lambda/shared';

export const courseRequestsApi = {
  create: (body: { course_name: string; subject?: string; description?: string; institution?: string; notes?: string }) =>
    api.post<CourseRequest>('/api/course-requests', body),

  list: () => api.get<CourseRequest[]>('/api/course-requests'),

  fulfill: (id: string, body: { title: string; subject: string; description?: string }) =>
    api.post<CourseTemplate>(`/api/course-requests/${id}/fulfill`, body),
};
