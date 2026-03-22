import { IsString, MinLength } from 'class-validator';

export class RespondCourseRequestDto {
  @IsString()
  @MinLength(1)
  message!: string;
}
