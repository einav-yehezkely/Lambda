import { api } from './client';
import type { User, CourseVersionWithTemplate } from '@lambda/shared';

export interface LeaderboardEntry {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  contribution_count: number;
}

export interface UserStats {
  version_count: number;
  solution_count: number;
}

export interface UserSolution {
  id: string;
  content: string;
  created_at: string;
  content_item: { id: string; title: string; type: string } | null;
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

  getUserStats: (username: string) =>
    api.get<UserStats>(`/api/users/${username}/stats`),

  getUserSolutions: (username: string) =>
    api.get<UserSolution[]>(`/api/users/${username}/solutions`),
};
