import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api/courses';
import { progressApi } from '@/lib/api/progress';
import type { ActiveVersionProgress } from '@lambda/shared';

export function useCourseSubjects() {
  return useQuery({
    queryKey: ['course-subjects'],
    queryFn: () => coursesApi.subjects(),
  });
}

export function useCourseInstitutions() {
  return useQuery({
    queryKey: ['course-institutions'],
    queryFn: () => coursesApi.institutions(),
  });
}

export function useCourses(filters?: { subject?: string; search?: string; sort?: string; institution?: string }) {
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

export function useActiveVersions(enabled: boolean) {
  return useQuery({
    queryKey: ['active-versions'],
    queryFn: () => progressApi.getActiveVersions(),
    enabled,
  });
}

export function useEnrollCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => progressApi.enroll(versionId),
    onMutate: async (versionId) => {
      await queryClient.cancelQueries({ queryKey: ['active-versions'] });
      const snapshot = queryClient.getQueryData<ActiveVersionProgress[]>(['active-versions']);
      queryClient.setQueryData<ActiveVersionProgress[]>(['active-versions'], (old) =>
        (old ?? []).map((v) => v.version_id === versionId ? { ...v, enrolled: true } : v),
      );
      return { snapshot };
    },
    onError: (_err, _versionId, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(['active-versions'], ctx.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['active-versions'] });
    },
  });
}

export function useUnenrollCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => progressApi.unenroll(versionId),
    onMutate: async (versionId) => {
      await queryClient.cancelQueries({ queryKey: ['active-versions'] });
      const snapshot = queryClient.getQueryData<ActiveVersionProgress[]>(['active-versions']);
      queryClient.setQueryData<ActiveVersionProgress[]>(['active-versions'], (old) =>
        (old ?? []).map((v) => v.version_id === versionId ? { ...v, enrolled: false } : v),
      );
      return { snapshot };
    },
    onError: (_err, _versionId, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(['active-versions'], ctx.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['active-versions'] });
    },
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: coursesApi.createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course-subjects'] });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { title?: string; subject?: string; description?: string | null } }) =>
      coursesApi.updateCourse(id, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useUpdateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof coursesApi.updateVersion>[1] }) =>
      coursesApi.updateVersion(id, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['version', variables.id] });
    },
  });
}

export function useDeleteVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; templateId: string }) => coursesApi.deleteVersion(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course-versions', variables.templateId] });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: coursesApi.deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course-subjects'] });
    },
  });
}

export function useRateVersion(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionId, rating }: { versionId: string; rating: number }) =>
      coursesApi.rateVersion(versionId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-versions', courseId] });
    },
  });
}

export function useAllVersions() {
  return useQuery({
    queryKey: ['all-versions-admin'],
    queryFn: () => coursesApi.listAllVersions(),
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
