import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { UserProgress, ActiveVersionProgress } from '@lambda/shared';

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

  // Enroll user in a specific version
  async enrollInCourse(userId: string, versionId: string): Promise<void> {
    const { error } = await this.db
      .from('user_enrollments')
      .upsert({ user_id: userId, version_id: versionId });

    if (error) throw new InternalServerErrorException(error.message);
  }

  // Unenroll user from a specific version
  async unenrollFromCourse(userId: string, versionId: string): Promise<void> {
    const { error } = await this.db
      .from('user_enrollments')
      .delete()
      .eq('user_id', userId)
      .eq('version_id', versionId);

    if (error) throw new InternalServerErrorException(error.message);
  }

  // Versions the user has made progress on OR enrolled in, with progress summaries
  async getActiveVersions(userId: string): Promise<ActiveVersionProgress[]> {
    // 1. Get all content items the user has attempted
    const { data: progressRows, error: progressError } = await this.db
      .from('user_progress')
      .select('content_item_id, status, last_attempt_at')
      .eq('user_id', userId);

    if (progressError) throw new InternalServerErrorException(progressError.message);

    const contentIds = (progressRows ?? []).map((r) => r.content_item_id);

    // 2. Map content items → versions
    let versionItems: Array<{ version_id: string; content_item_id: string }> = [];
    let progressVersionIds: string[] = [];

    if (contentIds.length > 0) {
      const { data: vi, error: viError } = await this.db
        .from('version_content_items')
        .select('version_id, content_item_id')
        .in('content_item_id', contentIds);

      if (viError) throw new InternalServerErrorException(viError.message);
      versionItems = vi ?? [];
      progressVersionIds = [...new Set(versionItems.map((r) => r.version_id))];
    }

    // 3. Get enrolled version IDs
    const { data: enrollments, error: enrollError } = await this.db
      .from('user_enrollments')
      .select('version_id, enrolled_at')
      .eq('user_id', userId);

    if (enrollError) throw new InternalServerErrorException(enrollError.message);
    const enrolledVersionIds = (enrollments ?? []).map((e) => e.version_id);

    // 4. Union version IDs from progress + enrollments
    const allVersionIds = [...new Set([...progressVersionIds, ...enrolledVersionIds])];
    if (!allVersionIds.length) return [];

    // 5. Get version details + course template info
    const { data: versions, error: versionsError } = await this.db
      .from('course_versions')
      .select('id, title, template_id, course_templates!template_id(id, title, subject)')
      .in('id', allVersionIds);

    if (versionsError) throw new InternalServerErrorException(versionsError.message);
    if (!versions?.length) return [];

    // 6. Compute per-version progress
    const result: ActiveVersionProgress[] = (versions as any[]).map((version) => {
      const versionContentIds = new Set(
        versionItems.filter((vi) => vi.version_id === version.id).map((vi) => vi.content_item_id),
      );

      const total = versionContentIds.size;
      const userProgressForVersion = (progressRows ?? []).filter((p) =>
        versionContentIds.has(p.content_item_id),
      );
      const solved = userProgressForVersion.filter((p) => p.status === 'solved').length;
      const lastAttempts = userProgressForVersion
        .map((p) => p.last_attempt_at)
        .filter((d): d is string => !!d)
        .sort();

      const enrolledAt = (enrollments ?? []).find((e) => e.version_id === version.id)?.enrolled_at ?? null;
      const tmpl = version.course_templates;

      return {
        version_id: version.id,
        version_title: version.title,
        course_id: tmpl?.id ?? '',
        course_title: tmpl?.title ?? '',
        subject: tmpl?.subject ?? '',
        total,
        solved,
        last_attempt_at: lastAttempts.at(-1) ?? enrolledAt,
        enrolled: enrolledAt !== null,
      };
    });

    return result.sort((a, b) =>
      (b.last_attempt_at ?? '').localeCompare(a.last_attempt_at ?? ''),
    );
  }

  // Progress summary for a specific version
  async getVersionProgress(versionId: string, userId: string): Promise<VersionProgressSummary> {
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
