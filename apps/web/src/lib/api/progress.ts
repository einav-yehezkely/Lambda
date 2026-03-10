import { api } from './client';
import type { VersionProgressSummary, ActiveVersionProgress } from '@lambda/shared';

export const progressApi = {
  getVersionProgress: (versionId: string) =>
    api.get<VersionProgressSummary>(`/api/progress/version/${versionId}`),

  getActiveVersions: () =>
    api.get<ActiveVersionProgress[]>('/api/progress/active-versions'),

  enroll: (versionId: string) =>
    api.post<void>('/api/progress/enroll', { version_id: versionId }),

  unenroll: (versionId: string) =>
    api.delete<void>(`/api/progress/enroll/${versionId}`),
};
