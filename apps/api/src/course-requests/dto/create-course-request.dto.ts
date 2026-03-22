import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCourseRequestDto {
  @IsString()
  @IsNotEmpty()
  course_name!: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}