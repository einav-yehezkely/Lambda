import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { solutionsApi } from '@/lib/api/solutions';
import type { Solution } from '@lambda/shared';

export function useSolutions(contentItemId: string) {
  return useQuery({
    queryKey: ['solutions', contentItemId],
    queryFn: () => solutionsApi.listByItem(contentItemId),
    enabled: !!contentItemId,
  });
}

export function useCreateSolution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: solutionsApi.create,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['solutions', variables.content_item_id] });
    },
  });
}

export function useUpdateSolution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string; contentItemId: string }) =>
      solutionsApi.update(id, { content }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['solutions', variables.contentItemId] });
    },
  });
}

export function useDeleteSolution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; contentItemId: string }) => solutionsApi.remove(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['solutions', variables.contentItemId] });
    },
  });
}

export function useVoteSolution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, vote }: { id: string; vote: 1 | -1; contentItemId: string }) =>
      solutionsApi.vote(id, vote),
    onMutate: async ({ id, vote, contentItemId }) => {
      await queryClient.cancelQueries({ queryKey: ['solutions', contentItemId] });
      const previous = queryClient.getQueryData<Solution[]>(['solutions', contentItemId]);
      queryClient.setQueryData<Solution[]>(['solutions', contentItemId], (old) => {
        const updated = old?.map((s) => {
          if (s.id !== id) return s;
          const prevVote = s.user_vote ?? 0;
          const newVote = prevVote === vote ? null : vote;
          const delta = (newVote ?? 0) - prevVote;
          return { ...s, user_vote: newVote, vote_count: s.vote_count + delta };
        });
        return updated?.slice().sort((a, b) => b.vote_count - a.vote_count);
      });
      return { previous };
    },
    onError: (_err, { contentItemId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['solutions', contentItemId], context.previous);
      }
    },
    onSettled: (_data, _err, { contentItemId }) => {
      queryClient.invalidateQueries({ queryKey: ['solutions', contentItemId] });
    },
  });
}
