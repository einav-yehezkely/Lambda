import { api } from './client';
import type { User, CourseVersionWithTemplate } from '@lambda/shared';

export const usersApi = {
  getProfile: (username: string) =>
    api.get<User>(`/api/users/${username}`),

  getVersions: (username: string) =>
    api.get<CourseVersionWithTemplate[]>(`/api/users/${username}/versions`),

  getProfileById: (id: string) =>
    api.get<User>(`/api/users/by-id/${id}`),
};
