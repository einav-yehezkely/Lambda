import { api } from './client';
import type { VersionProgressSummary } from '@lambda/shared';

export const progressApi = {
  getVersionProgress: (versionId: string) =>
    api.get<VersionProgressSummary>(`/api/progress/version/${versionId}`),
};
