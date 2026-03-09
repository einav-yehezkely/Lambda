import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProgressStatus } from '@lambda/shared';

export class SubmitAttemptDto {
  @ApiProperty()
  @IsUUID()
  content_item_id!: string;

  @ApiPropertyOptional({ description: 'true = correct, false = incorrect. If omitted, status must be provided.' })
  @IsBoolean()
  @IsOptional()
  is_correct?: boolean;

  @ApiPropertyOptional({ description: 'User answer text (for exam/proof questions)' })
  @IsString()
  @IsOptional()
  answer?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  time_spent_seconds?: number;

  @ApiPropertyOptional({
    enum: ['solved', 'incorrect', 'needs_review', 'skipped'],
    description: 'Override the computed status (e.g. mark as needs_review manually)',
  })
  @IsEnum(['solved', 'incorrect', 'needs_review', 'skipped'])
  @IsOptional()
  status?: ProgressStatus;
}
