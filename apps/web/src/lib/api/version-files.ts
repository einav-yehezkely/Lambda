import { api } from './client';
import type { VersionFile } from '@lambda/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function uploadFile(
  versionId: string,
  file: File,
  displayName: string,
): Promise<VersionFile> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('display_name', displayName);

  const res = await fetch(`${API_URL}/api/versions/${versionId}/files`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    // No Content-Type header — browser sets multipart/form-data with boundary
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Upload failed');
  }

  return res.json();
}

export const versionFilesApi = {
  list: (versionId: string) =>
    api.get<VersionFile[]>(`/api/versions/${versionId}/files`),

  upload: uploadFile,

  rename: (versionId: string, fileId: string, displayName: string) =>
    api.put<VersionFile>(`/api/versions/${versionId}/files/${fileId}`, { display_name: displayName }),

  remove: (versionId: string, fileId: string) =>
    api.delete<void>(`/api/versions/${versionId}/files/${fileId}`),

  getUrl: (versionId: string, fileId: string, download = false) =>
    api.get<{ url: string }>(
      `/api/versions/${versionId}/files/${fileId}/url${download ? '?download=true' : ''}`,
    ),
};
