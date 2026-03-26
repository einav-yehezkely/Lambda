import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { useAuth } from './useAuth';

export function useCurrentUser() {
  const { user: authUser } = useAuth();
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () => usersApi.getMe(),
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserProfile(username: string) {
  return useQuery({
    queryKey: ['user-profile', username],
    queryFn: () => usersApi.getProfile(username),
    enabled: !!username,
  });
}

export function useUserProfileById(id: string) {
  return useQuery({
    queryKey: ['user-profile-by-id', id],
    queryFn: () => usersApi.getProfileById(id),
    enabled: !!id,
  });
}

export function useUserVersions(username: string) {
  return useQuery({
    queryKey: ['user-versions', username],
    queryFn: () => usersApi.getVersions(username),
    enabled: !!username,
  });
}

export function useUserStats(username: string) {
  return useQuery({
    queryKey: ['user-stats', username],
    queryFn: () => usersApi.getUserStats(username),
    enabled: !!username,
  });
}

export function useUserSolutions(username: string) {
  return useQuery({
    queryKey: ['user-solutions', username],
    queryFn: () => usersApi.getUserSolutions(username),
    enabled: !!username,
  });
}

export function useAllUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: () => usersApi.listAllUsers(),
    staleTime: 60 * 1000,
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ['search-users', query],
    queryFn: () => usersApi.searchUsers(query),
    enabled: query.trim().length >= 1,
    staleTime: 30 * 1000,
  });
}
