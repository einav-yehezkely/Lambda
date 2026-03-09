import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty } from '@lambda/shared';

export class UpdateContentDto {
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

  @ApiPropertyOptional({ enum: ['easy', 'medium', 'hard'] })
  @IsEnum(['easy', 'medium', 'hard'])
  @IsOptional()
  difficulty?: Difficulty;

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
