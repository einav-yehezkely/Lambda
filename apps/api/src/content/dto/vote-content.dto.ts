import { IsIn, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoteContentDto {
  @ApiProperty({ enum: [1, -1], description: '1 = upvote, -1 = downvote' })
  @IsInt()
  @IsIn([1, -1])
  vote!: 1 | -1;
}
