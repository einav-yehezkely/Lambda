import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { Announcement } from '@lambda/shared';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  private get db() {
    return getSupabaseClient();
  }

  async list(userId: string): Promise<Announcement[]> {
    const [announcementsResult, readsResult] = await Promise.all([
      this.db
        .from('announcements')
        .select('*')
        .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
        .order('created_at', { ascending: false }),
      this.db.from('announcement_reads').select('announcement_id').eq('user_id', userId),
    ]);

    const readIds = new Set((readsResult.data ?? []).map((r: any) => r.announcement_id));
    return (announcementsResult.data ?? []).map((a: any) => ({
      ...a,
      is_read: readIds.has(a.id),
    })) as Announcement[];
  }

  async create(dto: CreateAnnouncementDto, userId: string): Promise<Announcement> {
    const { data, error } = await this.db
      .from('announcements')
      .insert({ ...dto, created_by: userId })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return { ...data, is_read: false } as Announcement;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('announcements').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(error.message);
  }

  async markAllRead(userId: string): Promise<void> {
    const { data: announcements } = await this.db
      .from('announcements')
      .select('id')
      .or(`target_user_id.is.null,target_user_id.eq.${userId}`);
    if (!announcements || announcements.length === 0) return;

    const { data: reads } = await this.db
      .from('announcement_reads')
      .select('announcement_id')
      .eq('user_id', userId);

    const readIds = new Set((reads ?? []).map((r: any) => r.announcement_id));
    const unreadIds = announcements.map((a: any) => a.id).filter((id: string) => !readIds.has(id));
    if (unreadIds.length === 0) return;

    const { error } = await this.db
      .from('announcement_reads')
      .upsert(
        unreadIds.map((id: string) => ({ user_id: userId, announcement_id: id })),
        { onConflict: 'user_id,announcement_id' },
      );

    if (error) throw new InternalServerErrorException(error.message);
  }
}
