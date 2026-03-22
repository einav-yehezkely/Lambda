import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FulfillCourseRequestDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
