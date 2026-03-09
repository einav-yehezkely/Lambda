import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Visibility } from '@lambda/shared';

export class UpdateVersionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  institution?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  semester?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsEnum(['public', 'private'])
  @IsOptional()
  visibility?: Visibility;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_recommended?: boolean;
}
