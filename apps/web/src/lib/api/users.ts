import { api } from './client';
import type { User, CourseVersionWithTemplate } from '@lambda/shared';

export interface LeaderboardEntry {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  version_count: number;
}

export const usersApi = {
  getProfile: (username: string) =>
    api.get<User>(`/api/users/${username}`),

  getVersions: (username: string) =>
    api.get<CourseVersionWithTemplate[]>(`/api/users/${username}/versions`),

  getProfileById: (id: string) =>
    api.get<User>(`/api/users/by-id/${id}`),

  getLeaderboard: () =>
    api.get<LeaderboardEntry[]>('/api/users/leaderboard'),
};
