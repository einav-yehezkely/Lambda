import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ example: 'Algorithms' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'cs' })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
