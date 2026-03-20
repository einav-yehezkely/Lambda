import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty } from '@lambda/shared';
import type { ContentType } from '@lambda/shared';

export class UpdateContentDto {
  @ApiPropertyOptional({ description: 'Version context for copy-on-write when editing shared content' })
  @IsUUID()
  @IsOptional()
  version_id?: string;

  @ApiPropertyOptional({ enum: ['proof', 'exam_question', 'exercise_question', 'algorithm', 'other'] })
  @IsEnum(['proof', 'exam_question', 'exercise_question', 'algorithm', 'other'])
  @IsOptional()
  type?: ContentType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Supports LaTeX' })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ description: 'Supports LaTeX' })
  @IsString()
  @IsOptional()
  solution?: string;

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'], nullable: true })
  @ValidateIf((o) => o.difficulty !== null)
  @IsEnum(['easy', 'medium', 'hard'])
  @IsOptional()
  difficulty?: Difficulty | null;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_published?: boolean;

  @ApiPropertyOptional({ description: 'Reassign to a different topic within the same version' })
  @IsUUID()
  @IsOptional()
  topic_id?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}
