import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topicsApi, contentApi } from '@/lib/api/content';

export function useTopics(versionId: string) {
  return useQuery({
    queryKey: ['topics', versionId],
    queryFn: () => topicsApi.getByVersion(versionId),
    enabled: !!versionId,
  });
}

export function useVersionContent(params: {
  version_id: string;
  topic_id?: string;
  type?: string;
}) {
  return useQuery({
    queryKey: ['content', params],
    queryFn: () => contentApi.listByVersion(params),
    enabled: !!params.version_id,
  });
}

export function useCreateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contentApi.createItem,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['content', { version_id: variables.version_id }] });
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}

export function useCreateTopic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: topicsApi.createTopic,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['topics', variables.version_id] });
    },
  });
}

export function useDeleteTopic(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: topicsApi.deleteTopic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topics', versionId] });
    },
  });
}
