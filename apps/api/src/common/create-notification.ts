import { getSupabaseClient } from './supabase.client';

/**
 * Inserts a personal in-app notification for a specific user.
 * The notification appears in that user's notification bell alongside global announcements.
 */
export async function createNotification(params: {
  targetUserId: string;
  title: string;
  content?: string;
  createdBy?: string | null;
}): Promise<void> {
  const db = getSupabaseClient();
  await db.from('announcements').insert({
    title: params.title,
    content: params.content ?? null,
    target_user_id: params.targetUserId,
    created_by: params.createdBy ?? null,
  });
}
