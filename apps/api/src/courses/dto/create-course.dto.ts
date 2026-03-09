import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Subject } from '@lambda/shared';

export class CreateCourseDto {
  @ApiProperty({ example: 'Algorithms' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ enum: ['cs', 'math', 'other'] })
  @IsEnum(['cs', 'math', 'other'])
  subject!: Subject;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
