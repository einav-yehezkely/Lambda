import { Injectable, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
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
  constructor(private readonly config: ConfigService) {}

  private get db() {
    return getSupabaseClient();
  }

  private async sendMail(to: string, subject: string, text: string, html?: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM') ?? 'Lambda <noreply@lambda-learn.com>';
    if (!apiKey) return;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to, subject, text, html });
    if (error) throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  private buildAdminMessageHtml(params: { name: string; subject: string; message: string; appUrl: string }): string {
    const { name, subject, message, appUrl } = params;

    const inlineLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="44" viewBox="963 -194 979 1434" style="display:block;margin:0 auto 8px;"><path style="fill:#0f172a;fill-rule:evenodd" d="M1941.7986 938.2071L1905.7586 938.2071C1895.7486 1043.6671 1853.3686 1096.3871 1778.6186 1096.3871 1734.5686 1096.3871 1696.6886 1074.1971 1664.9886 1029.8171Q1617.4386 963.2371 1574.3886 766.0171L1503.3086 448.6681Q1428.2286 110.2941 1392.6886 2.6721C1368.9886-69.0729 1340.9586-119.7959 1308.5886-149.4969 1276.2186-179.195 1242.0186-194.0448 1205.9786-194.0462 1149.9186-194.0448 1103.1986-164.512 1065.8186-105.4479 1028.4486-46.3809 1008.7586 32.2061 1006.7586 130.3141L1042.7986 130.3141C1046.1386 69.5811 1061.9886 24.6981 1090.3486-4.3359 1118.7186-33.3669 1151.9186-47.8829 1189.9586-47.8839 1237.3486-47.8829 1277.0586-19.1839 1309.0886 38.2121Q1357.1486 124.3091 1391.1886 303.5061L962.7086 1226.5371 1151.9186 1226.5371 1450.2486 549.7801 1536.3486 938.2071C1567.0486 1076.3671 1601.7486 1161.2971 1640.4586 1192.9971 1679.1686 1224.6971 1719.5486 1240.5471 1761.5986 1240.5471 1812.9886 1240.5471 1855.8686 1216.5171 1890.2386 1168.4671 1924.6086 1120.4171 1941.7986 1043.6671 1941.7986 938.2071Z"/></svg>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              ${inlineLogo}
              <span style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">Lambda</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:36px 36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

              <!-- Title -->
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
                ${subject}
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
                Hi ${name},
              </p>

              <!-- Message -->
              <div style="background:#f8fafc;border-left:3px solid #1e3a8a;border-radius:4px;padding:14px 16px;margin:0 0 24px;">
                <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;white-space:pre-wrap;">${message}</p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Lambda — the community learning platform<br />
                <a href="${appUrl}" style="color:#94a3b8;">${appUrl}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async sendMessageToUser(username: string, subject: string, message: string, adminId?: string): Promise<void> {
    const user = await this.findByUsername(username);
    if (!user) throw new NotFoundException('User not found');
    if (!user.email) throw new NotFoundException('User has no email address');

    const name = user.display_name ?? user.username;
    const appUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    const plainText = `Hi ${name},\n\n${message}\n\nThe Lambda team`;
    const html = this.buildAdminMessageHtml({ name, subject, message, appUrl });

    await this.sendMail(user.email, `Lambda – ${subject}`, plainText, html);

    // Also create an in-app notification in the bell
    await this.db.from('announcements').insert({
      title: subject,
      content: message,
      target_user_id: user.id,
      created_by: adminId ?? null,
    });
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

  async getLeaderboard(limit = 10): Promise<{ username: string; display_name: string | null; avatar_url: string | null; contribution_count: number }[]> {
    const [versionsResult, solutionsResult] = await Promise.all([
      this.db
        .from('course_versions')
        .select('author_id, author:users!course_versions_author_id_fkey(username, display_name, avatar_url)')
        .eq('visibility', 'public'),
      this.db
        .from('solutions')
        .select('author_id, author:users!solutions_author_id_fkey(username, display_name, avatar_url)'),
    ]);

    const counts = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; count: number }>();

    for (const row of ((versionsResult.data ?? []) as any[])) {
      const author = row.author;
      if (!author?.username) continue;
      const existing = counts.get(author.username);
      if (existing) { existing.count++; }
      else { counts.set(author.username, { username: author.username, display_name: author.display_name, avatar_url: author.avatar_url, count: 1 }); }
    }

    for (const row of ((solutionsResult.data ?? []) as any[])) {
      const author = row.author;
      if (!author?.username) continue;
      const existing = counts.get(author.username);
      if (existing) { existing.count++; }
      else { counts.set(author.username, { username: author.username, display_name: author.display_name, avatar_url: author.avatar_url, count: 1 }); }
    }

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(({ username, display_name, avatar_url, count }) => ({ username, display_name, avatar_url, contribution_count: count }));
  }

  async getUserStats(username: string): Promise<{ version_count: number; solution_count: number }> {
    const user = await this.findByUsername(username);
    if (!user) return { version_count: 0, solution_count: 0 };

    const [versionsResult, solutionsResult] = await Promise.all([
      this.db.from('course_versions').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
      this.db.from('solutions').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    ]);

    return {
      version_count: versionsResult.count ?? 0,
      solution_count: solutionsResult.count ?? 0,
    };
  }

  async getSolutionsByUsername(username: string) {
    const user = await this.findByUsername(username);
    if (!user) return [];

    const { data, error } = await this.db
      .from('solutions')
      .select('*, content_item:content_items(id, title, type, version_content_items(version_id, course_version:course_versions(template_id)))')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data ?? [];
  }

  async sendMessageToAllUsers(subject: string, message: string): Promise<{ sent: number }> {
    const { data: users } = await this.db
      .from('users')
      .select('id, username, display_name, email')
      .not('email', 'is', null);

    if (!users?.length) return { sent: 0 };

    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM') ?? 'Lambda <noreply@lambda-learn.com>';
    const appUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';

    if (apiKey) {
      const resend = new Resend(apiKey);
      const emails = users.map((u) => ({
        from,
        to: u.email as string,
        subject: `Lambda – ${subject}`,
        text: `Hi ${u.display_name ?? u.username},\n\n${message}\n\nThe Lambda team`,
        html: this.buildAdminMessageHtml({ name: u.display_name ?? u.username, subject, message, appUrl }),
      }));

      // Resend batch limit is 100 per call
      for (let i = 0; i < emails.length; i += 100) {
        await resend.batch.send(emails.slice(i, i + 100));
      }
    }

    // In-app notifications for all users
    const notifications = users.map((u) => ({
      title: subject,
      content: message,
      target_user_id: u.id,
      created_by: null,
    }));
    await this.db.from('announcements').insert(notifications);

    return { sent: users.length };
  }

  async listAllUsers(): Promise<User[]> {
    const { data, error } = await this.db
      .from('users')
      .select('id, username, display_name, avatar_url, email, is_admin, created_at')
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data ?? []) as User[];
  }

  async searchUsers(query: string): Promise<User[]> {
    const q = `%${query}%`;
    const { data, error } = await this.db
      .from('users')
      .select('id, username, display_name, avatar_url, email, is_admin, created_at')
      .or(`username.ilike.${q},display_name.ilike.${q},email.ilike.${q}`)
      .order('username')
      .limit(20);

    if (error) return [];
    return (data ?? []) as User[];
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
