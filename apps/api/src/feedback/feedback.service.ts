import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class FeedbackService {
  constructor(private readonly config: ConfigService) {}

  async sendSuggestion(text: string, username?: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM') ?? 'Lambda <noreply@lambda-learn.com>';
    const adminEmail = this.config.get<string>('ADMIN_EMAIL') ?? this.config.get<string>('SMTP_USER');

    if (!apiKey || !adminEmail) {
      throw new InternalServerErrorException('Email service not configured');
    }

    const resend = new Resend(apiKey);

    const senderLine = username
      ? `From: ${username} (https://lambda-site.vercel.app/profile/${username})`
      : 'From: Anonymous';

    const { error } = await resend.emails.send({
      from,
      to: adminEmail,
      subject: 'Lambda – New Site Suggestion',
      text: `${senderLine}\n\n${text}`,
    });

    if (error) throw new InternalServerErrorException(`Failed to send email: ${JSON.stringify(error)}`);
  }
}
