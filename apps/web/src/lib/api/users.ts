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
  content_item: {
    id: string;
    title: string;
    type: string;
    version_content_items: Array<{
      version_id: string;
      course_version: { template_id: string } | null;
    }>;
  } | null;
}

export const usersApi = {
  getMe: () =>
    api.get<User>('/api/auth/me'),

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

  listAllUsers: () =>
    api.get<User[]>('/api/users/all'),

  searchUsers: (query: string) =>
    api.get<User[]>(`/api/users/search?q=${encodeURIComponent(query)}`),

  sendMessageToAll: (subject: string, message: string) =>
    api.post<{ sent: number }>('/api/users/send-message-all', { subject, message }),

  sendMessage: (username: string, subject: string, message: string) =>
    api.post<{ success: boolean }>(`/api/users/${username}/send-message`, { subject, message }),
};
