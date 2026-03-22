import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { courseRequestsApi } from '@/lib/api/course-requests';

export function useCreateCourseRequest() {
  return useMutation({
    mutationFn: courseRequestsApi.create,
  });
}

export function useCourseRequests() {
  return useQuery({
    queryKey: ['course-requests'],
    queryFn: courseRequestsApi.list,
  });
}

export function useFulfillCourseRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { title: string; subject: string; description?: string } }) =>
      courseRequestsApi.fulfill(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-requests'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}
