import { api } from './client';
import type { CourseTemplate, CourseVersion } from '@lambda/shared';

export const coursesApi = {
  subjects: () => api.get<string[]>('/api/courses/subjects'),

  list: (params?: { subject?: string; search?: string; sort?: string }) => {
    const query = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v) as [string, string][],
    ).toString();
    return api.get<CourseTemplate[]>(`/api/courses${query ? `?${query}` : ''}`);
  },

  get: (id: string) => api.get<CourseTemplate>(`/api/courses/${id}`),

  getVersions: (courseId: string) =>
    api.get<CourseVersion[]>(`/api/courses/${courseId}/versions`),

  getVersion: (versionId: string) =>
    api.get<CourseVersion>(`/api/courses/versions/${versionId}`),

  createCourse: (body: { title: string; subject: string; description?: string }) =>
    api.post<CourseTemplate>('/api/courses', body),

  updateCourse: (id: string, body: { title?: string; subject?: string; description?: string | null }) =>
    api.put<CourseTemplate>(`/api/courses/${id}`, body),

  updateVersion: (id: string, body: {
    institution?: string;
    year?: number;
    semester?: string;
    lecturer_name?: string;
    course_number?: string;
    description?: string;
    visibility?: string;
    content_types?: { label: string; value: string }[];
  }) => api.put<CourseVersion>(`/api/courses/versions/${id}`, body),

  deleteVersion: (id: string) => api.delete<void>(`/api/courses/versions/${id}`),

  deleteCourse: (id: string) => api.delete<void>(`/api/courses/${id}`),

  rateVersion: (id: string, rating: number) =>
    api.post<void>(`/api/courses/versions/${id}/rate`, { rating }),

  createVersion: (body: {
    template_id: string;
    title: string;
    institution?: string;
    year?: number;
    semester?: string;
    lecturer_name?: string;
    course_number?: string;
    description?: string;
    visibility?: string;
    based_on_version_id?: string;
  }) => api.post<CourseVersion>('/api/courses/versions', body),
};
