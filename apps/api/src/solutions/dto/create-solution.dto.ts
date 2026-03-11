import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSolutionDto {
  @ApiProperty({ description: 'The content item this solution belongs to' })
  @IsUUID()
  content_item_id!: string;

  @ApiProperty({ description: 'Solution content (LaTeX supported)' })
  @IsString()
  @MinLength(1)
  content!: string;
}
