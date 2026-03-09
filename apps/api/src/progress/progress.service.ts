import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { UserProgress } from '@lambda/shared';

export interface VersionProgressSummary {
  version_id: string;
  total: number;
  solved: number;
  incorrect: number;
  needs_review: number;
  skipped: number;
  unseen: number;
}

@Injectable()
export class ProgressService {
  private get db() {
    return getSupabaseClient();
  }

  // All progress records for the current user
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    const { data, error } = await this.db
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .order('last_attempt_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data as UserProgress[];
  }

  // Progress summary for a specific version
  async getVersionProgress(versionId: string, userId: string): Promise<VersionProgressSummary> {
    // Total items in version
    const { data: allItems, error: itemsError } = await this.db
      .from('version_content_items')
      .select('content_item_id')
      .eq('version_id', versionId);

    if (itemsError) throw new InternalServerErrorException(itemsError.message);
    const total = allItems?.length ?? 0;
    const allIds = (allItems ?? []).map((r) => r.content_item_id);

    if (total === 0) {
      return { version_id: versionId, total: 0, solved: 0, incorrect: 0, needs_review: 0, skipped: 0, unseen: 0 };
    }

    // User progress for those items
    const { data: progressRows, error: progressError } = await this.db
      .from('user_progress')
      .select('content_item_id, status')
      .eq('user_id', userId)
      .in('content_item_id', allIds);

    if (progressError) throw new InternalServerErrorException(progressError.message);

    const counts = { solved: 0, incorrect: 0, needs_review: 0, skipped: 0 };
    for (const row of progressRows ?? []) {
      if (row.status in counts) counts[row.status as keyof typeof counts]++;
    }

    const attempted = (progressRows ?? []).length;
    const unseen = total - attempted;

    return { version_id: versionId, total, ...counts, unseen };
  }
}
