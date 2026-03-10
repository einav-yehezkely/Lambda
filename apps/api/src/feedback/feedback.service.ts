import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class FeedbackService {
  constructor(private readonly config: ConfigService) {}

  async sendSuggestion(text: string, username?: string): Promise<void> {
    const smtpUser = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!smtpUser || !pass) {
      throw new InternalServerErrorException('Email service not configured');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass },
    });

    const senderLine = username
      ? `From: ${username} (https://lambda-site.vercel.app/profile/${username})`
      : 'From: Anonymous';

    await transporter.sendMail({
      from: smtpUser,
      to: 'simplifye.solutions@gmail.com',
      subject: 'Lambda – New Site Suggestion',
      text: `${senderLine}\n\n${text}`,
    });
  }
}
