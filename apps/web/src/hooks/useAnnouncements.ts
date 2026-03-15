'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api/announcements';
import { useAuth } from './useAuth';

export function useAnnouncements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.list(),
    enabled: !!user,
    staleTime: 30 * 1000,
  });
}

export function useMarkAllAnnouncementsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => announcementsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; content?: string }) => announcementsApi.create(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
  });
}
