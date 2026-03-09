import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';

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
