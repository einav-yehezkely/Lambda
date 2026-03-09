import { api } from './client';
import type { CourseTemplate, CourseVersion } from '@lambda/shared';

export const coursesApi = {
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

  updateVersion: (id: string, body: {
    institution?: string;
    year?: number;
    semester?: string;
    description?: string;
    visibility?: string;
  }) => api.put<CourseVersion>(`/api/courses/versions/${id}`, body),

  deleteVersion: (id: string) => api.delete<void>(`/api/courses/versions/${id}`),

  deleteCourse: (id: string) => api.delete<void>(`/api/courses/${id}`),

  createVersion: (body: {
    template_id: string;
    title: string;
    institution?: string;
    year?: number;
    semester?: string;
    description?: string;
    visibility?: string;
    based_on_version_id?: string;
  }) => api.post<CourseVersion>('/api/courses/versions', body),
};
