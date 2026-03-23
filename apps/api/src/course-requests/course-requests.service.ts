import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { getSupabaseClient } from '../common/supabase.client';
import { createNotification } from '../common/create-notification';
import { CreateCourseRequestDto } from './dto/create-course-request.dto';
import { FulfillCourseRequestDto } from './dto/fulfill-course-request.dto';
import { RespondCourseRequestDto } from './dto/respond-course-request.dto';

@Injectable()
export class CourseRequestsService {
  constructor(private readonly config: ConfigService) {}

  private get db() {
    return getSupabaseClient();
  }

  private async sendMail(to: string, subject: string, text: string, html?: string): Promise<void> {
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');
    if (!smtpUser || !smtpPass) return;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({ from: smtpUser, to, subject, text, html });
  }

  private buildCourseFulfilledHtml(params: {
    name: string;
    courseName: string;
    courseUrl: string;
    appUrl: string;
  }): string {
    const { name, courseName, courseUrl, appUrl } = params;

    // SVG inlined so it renders without needing an external URL
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
                Your course is live! 🎉
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;">
                Hi ${name},
              </p>

              <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.6;">
                Great news — the course you requested,
                <strong style="color:#0f172a;">${courseName}</strong>,
                has been added to Lambda and is ready for contributions.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#1e3a8a;border-radius:8px;">
                    <a href="${courseUrl}"
                      style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      Add your version →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                If the button doesn't work, copy this link:<br />
                <a href="${courseUrl}" style="color:#1e3a8a;word-break:break-all;">${courseUrl}</a>
              </p>

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

  private buildRespondHtml(params: { name: string; courseName: string; message: string }): string {
    const { name, courseName, message } = params;
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
              <span style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">Lambda</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:36px 36px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
                Update on your course request
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;">Hi ${name},</p>
              <p style="margin:0 0 12px;font-size:14px;color:#64748b;">
                You requested: <strong style="color:#0f172a;">${courseName}</strong>
              </p>
              <div style="background:#f8fafc;border-left:3px solid #1e3a8a;border-radius:4px;padding:14px 16px;margin:0 0 24px;">
                <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;white-space:pre-wrap;">${message}</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">Lambda — the community learning platform</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async respond(id: string, dto: RespondCourseRequestDto) {
    const { data: request, error: reqErr } = await this.db
      .from('course_requests')
      .select('*, requester:users!course_requests_requester_id_fkey(id, email, username, display_name)')
      .eq('id', id)
      .single();

    if (reqErr || !request) throw new NotFoundException('Course request not found');

    await this.db
      .from('course_requests')
      .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
      .eq('id', id);

    const requester = request.requester as { id?: string; email?: string; username?: string; display_name?: string } | null;
    if (requester?.email) {
      const name = requester.display_name ?? requester.username ?? 'there';
      const plainText = `Hi ${name},\n\nYou requested: "${request.course_name}"\n\n${dto.message}\n\nThe Lambda team`;
      const html = this.buildRespondHtml({ name, courseName: request.course_name, message: dto.message });
      await this.sendMail(requester.email, `Lambda – Update on your course request: "${request.course_name}"`, plainText, html);

      if (requester.id) {
        await createNotification({
          targetUserId: requester.id,
          title: `Update on your course request: "${request.course_name}"`,
          content: dto.message,
        });
      }
    }
  }

  async create(dto: CreateCourseRequestDto, requesterId: string) {
    const { data: requester } = await this.db
      .from('users')
      .select('email, username, display_name')
      .eq('id', requesterId)
      .single();

    const { data, error } = await this.db
      .from('course_requests')
      .insert({
        requester_id: requesterId,
        course_name: dto.course_name,
        subject: dto.subject ?? null,
        description: dto.description ?? null,
        institution: dto.institution ?? null,
        notes: dto.notes ?? null,
      })
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);

    // Plain-text email to admin
    const adminEmail = this.config.get<string>('SMTP_USER');
    if (adminEmail) {
      const lines = [
        `Course request from: ${requester?.display_name ?? requester?.username ?? 'unknown'} (${requester?.email ?? ''})`,
        `Course name: ${dto.course_name}`,
        dto.subject ? `Subject: ${dto.subject}` : null,
        dto.description ? `Description: ${dto.description}` : null,
        dto.institution ? `Institution: ${dto.institution}` : null,
        dto.notes ? `Notes: ${dto.notes}` : null,
        '',
        `Manage requests: ${this.config.get('APP_URL') ?? 'http://localhost:3000'}/admin/course-requests`,
      ].filter((l) => l !== null);

      await this.sendMail(adminEmail, `Lambda – New Course Request: ${dto.course_name}`, lines.join('\n'));
    }

    return data;
  }

  async findAll() {
    const { data, error } = await this.db
      .from('course_requests')
      .select('*, requester:users!course_requests_requester_id_fkey(id, username, display_name, email)')
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async fulfill(id: string, dto: FulfillCourseRequestDto, adminId: string) {
    const { data: request, error: reqErr } = await this.db
      .from('course_requests')
      .select('*, requester:users!course_requests_requester_id_fkey(id, email, username, display_name)')
      .eq('id', id)
      .single();

    if (reqErr || !request) throw new NotFoundException('Course request not found');

    // Create the course template
    const { data: course, error: courseErr } = await this.db
      .from('course_templates')
      .insert({
        title: dto.title,
        subject: dto.subject,
        description: dto.description ?? null,
        created_by: adminId,
      })
      .select()
      .single();

    if (courseErr) throw new InternalServerErrorException(courseErr.message);

    // Mark request as fulfilled
    await this.db
      .from('course_requests')
      .update({ status: 'fulfilled', course_template_id: course.id, fulfilled_at: new Date().toISOString() })
      .eq('id', id);

    // HTML email + in-app notification to the requester
    const requester = request.requester as { id?: string; email?: string; username?: string; display_name?: string } | null;
    if (requester?.email) {
      const appUrl = this.config.get('APP_URL') ?? 'http://localhost:3000';
      const courseUrl = `${appUrl}/courses/${course.id}`;
      const name = requester.display_name ?? requester.username ?? 'there';

      const plainText = [
        `Hi ${name},`,
        '',
        `Great news! The course you requested — "${request.course_name}" — has been added to Lambda.`,
        '',
        `Add your version: ${courseUrl}`,
        '',
        'Thanks for contributing to the community!',
        'The Lambda team',
      ].join('\n');

      const html = this.buildCourseFulfilledHtml({
        name,
        courseName: request.course_name,
        courseUrl,
        appUrl,
      });

      await this.sendMail(
        requester.email,
        `Lambda – Your course "${request.course_name}" has been added!`,
        plainText,
        html,
      );

      if (requester.id) {
        await createNotification({
          targetUserId: requester.id,
          title: `Your course "${request.course_name}" has been added!`,
          content: `The course you requested is now live. Add your version: ${courseUrl}`,
          createdBy: adminId,
        });
      }
    }

    return course;
  }
}
