import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt } from 'class-validator';

export class VoteSolutionDto {
  @ApiProperty({ description: '1 for upvote, -1 for downvote', enum: [1, -1] })
  @IsInt()
  @IsIn([1, -1])
  vote!: 1 | -1;
}
