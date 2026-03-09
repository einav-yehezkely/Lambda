import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentType, Difficulty } from '@lambda/shared';

export class CreateContentDto {
  @ApiProperty({ description: 'The version this item is being added to' })
  @IsUUID()
  version_id!: string;

  @ApiPropertyOptional({ description: 'The topic within this version (optional)' })
  @IsUUID()
  @IsOptional()
  topic_id?: string;

  @ApiProperty({ enum: ['proof', 'exam_question', 'coding_question', 'algorithm'] })
  @IsEnum(['proof', 'exam_question', 'coding_question', 'algorithm'])
  type!: ContentType;

  @ApiProperty({ example: 'BFS' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Problem statement. Supports LaTeX syntax.' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({ description: 'Solution, supports LaTeX' })
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

  @ApiPropertyOptional({ description: 'Type-specific fields (algorithm: { algorithm, proof, runtime })' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}
