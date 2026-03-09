import {
  IsArray,
  IsEnum,
  IsNotEmpty,
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

  @ApiProperty({ enum: ['proof', 'exam_question', 'coding_question'] })
  @IsEnum(['proof', 'exam_question', 'coding_question'])
  type!: ContentType;

  @ApiProperty({ example: 'Prove that there are infinitely many primes' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'Supports LaTeX syntax', example: 'Let $p_1, p_2, \\ldots, p_n$ be all primes...' })
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
}
