import { Injectable, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { getSupabaseClient } from '../common/supabase.client';
import { User } from '@lambda/shared';

interface FindOrCreateInput {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

@Injectable()
export class UsersService {
  private get db() {
    return getSupabaseClient();
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data as User;
  }

  async findByUsername(username: string): Promise<User | null> {
    const { data, error } = await this.db
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error) return null;
    return data as User;
  }

  async findOrCreate(input: FindOrCreateInput): Promise<User> {
    const existing = await this.findById(input.id);
    if (existing) {
      // Backfill display_name / avatar_url if they were missing (e.g. created by DB trigger)
      if (!existing.display_name && input.display_name) {
        const { data } = await this.db
          .from('users')
          .update({ display_name: input.display_name, avatar_url: input.avatar_url })
          .eq('id', input.id)
          .select()
          .single();
        if (data) return data as User;
      }
      return existing;
    }

    const baseUsername = input.email.split('@')[0].replace(/[^a-z0-9_]/gi, '_');
    const username = await this.resolveUniqueUsername(baseUsername);

    const { data, error } = await this.db
      .from('users')
      .insert({
        id: input.id,
        email: input.email,
        username,
        display_name: input.display_name,
        avatar_url: input.avatar_url,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new ConflictException('User already exists');
      throw new InternalServerErrorException(`Failed to create user: ${error.message}`);
    }

    return data as User;
  }

  async getVersionsByUserId(userId: string) {
    const { data, error } = await this.db
      .from('course_versions')
      .select('*, course_templates(id, title, subject)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data ?? [];
  }

  async getLeaderboard(limit = 10): Promise<{ username: string; display_name: string | null; avatar_url: string | null; version_count: number }[]> {
    const { data, error } = await this.db
      .from('course_versions')
      .select('author_id, author:users!course_versions_author_id_fkey(username, display_name, avatar_url)')
      .eq('visibility', 'public');

    if (error || !data) return [];

    const counts = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; count: number }>();
    for (const row of data as any[]) {
      const author = row.author;
      if (!author?.username) continue;
      const existing = counts.get(author.username);
      if (existing) {
        existing.count++;
      } else {
        counts.set(author.username, { username: author.username, display_name: author.display_name, avatar_url: author.avatar_url, count: 1 });
      }
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(({ username, display_name, avatar_url, count }) => ({ username, display_name, avatar_url, version_count: count }));
  }

  private async resolveUniqueUsername(base: string): Promise<string> {
    let candidate = base;
    let attempt = 0;

    while (true) {
      const { data } = await this.db
        .from('users')
        .select('id')
        .eq('username', candidate)
        .maybeSingle();

      if (!data) return candidate;
      attempt++;
      candidate = `${base}${attempt}`;
    }
  }
}
