import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { FeedbackService } from './feedback.service';

class SubmitSuggestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsString()
  username?: string;
}

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('suggest')
  @HttpCode(200)
  @ApiOkResponse({ description: 'Suggestion sent via email' })
  async suggest(@Body() dto: SubmitSuggestionDto) {
    await this.feedbackService.sendSuggestion(dto.text, dto.username);
    return { ok: true };
  }
}
