import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';

@Injectable()
export class SiteInfoService {
  private get db() {
    return getSupabaseClient();
  }

  async get(): Promise<{ content: string }> {
    const { data, error } = await this.db
      .from('site_info')
      .select('content')
      .eq('id', 1)
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return { content: data?.content ?? '' };
  }

  async update(content: string): Promise<{ content: string }> {
    const { data, error } = await this.db
      .from('site_info')
      .upsert({ id: 1, content, updated_at: new Date().toISOString() })
      .select('content')
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return { content: data.content };
  }
}
