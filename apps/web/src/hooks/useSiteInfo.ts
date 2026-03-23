import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { siteInfoApi } from '@/lib/api/site-info';

export function useSiteInfo() {
  return useQuery({
    queryKey: ['site-info'],
    queryFn: () => siteInfoApi.get(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSiteInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => siteInfoApi.update(content),
    onSuccess: (data) => {
      queryClient.setQueryData(['site-info'], data);
    },
  });
}
