import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { versionFilesApi } from '@/lib/api/version-files';

export function useVersionFiles(versionId: string) {
  return useQuery({
    queryKey: ['version-files', versionId],
    queryFn: () => versionFilesApi.list(versionId),
    enabled: !!versionId,
  });
}

export function useUploadVersionFile(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, displayName }: { file: File; displayName: string }) =>
      versionFilesApi.upload(versionId, file, displayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['version-files', versionId] });
    },
  });
}

export function useRenameVersionFile(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, displayName }: { fileId: string; displayName: string }) =>
      versionFilesApi.rename(versionId, fileId, displayName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['version-files', versionId] });
    },
  });
}

export function useDeleteVersionFile(versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => versionFilesApi.remove(versionId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['version-files', versionId] });
    },
  });
}

export function useVersionFileUrl(versionId: string) {
  return {
    getViewUrl: (fileId: string) => versionFilesApi.getUrl(versionId, fileId, false),
    getDownloadUrl: (fileId: string) => versionFilesApi.getUrl(versionId, fileId, true),
  };
}
