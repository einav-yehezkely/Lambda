import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Visibility } from '@lambda/shared';

export class CreateVersionDto {
  @ApiProperty({ description: 'The course template this version belongs to' })
  @IsUUID()
  template_id!: string;

  @ApiProperty({ example: 'Algorithms - HUJI - 2025' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'HUJI' })
  @IsString()
  @IsOptional()
  institution?: string;

  @ApiPropertyOptional({ example: 2025 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({ example: 'א' })
  @IsString()
  @IsOptional()
  semester?: string;

  @ApiPropertyOptional({ example: 'Prof. Cohen' })
  @IsString()
  @IsOptional()
  lecturer_name?: string;

  @ApiPropertyOptional({ example: '67101' })
  @IsString()
  @IsOptional()
  course_number?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Fork from this version (copies topics and content references)' })
  @IsUUID()
  @IsOptional()
  based_on_version_id?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'], default: 'public' })
  @IsEnum(['public', 'private'])
  @IsOptional()
  visibility?: Visibility;
}
