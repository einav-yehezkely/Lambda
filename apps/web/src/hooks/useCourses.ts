import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api/courses';
import { progressApi } from '@/lib/api/progress';

export function useCourses(filters?: { subject?: string; search?: string; sort?: string }) {
  return useQuery({
    queryKey: ['courses', filters],
    queryFn: () => coursesApi.list(filters),
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => coursesApi.get(id),
    enabled: !!id,
  });
}

export function useCourseVersions(courseId: string) {
  return useQuery({
    queryKey: ['course-versions', courseId],
    queryFn: () => coursesApi.getVersions(courseId),
    enabled: !!courseId,
  });
}

export function useVersion(versionId: string) {
  return useQuery({
    queryKey: ['version', versionId],
    queryFn: () => coursesApi.getVersion(versionId),
    enabled: !!versionId,
  });
}

export function useVersionProgress(versionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['version-progress', versionId],
    queryFn: () => progressApi.getVersionProgress(versionId),
    enabled: !!versionId && enabled,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: coursesApi.createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useCreateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: coursesApi.createVersion,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-versions', variables.template_id] });
    },
  });
}
