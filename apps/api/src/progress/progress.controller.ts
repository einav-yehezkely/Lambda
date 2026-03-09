import { Controller, Get, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ProgressService } from './progress.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';

@ApiTags('progress')
@Controller('progress')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get()
  @ApiOkResponse({ description: 'All progress records for the current user' })
  getUserProgress(@CurrentUser() user: User) {
    return this.progressService.getUserProgress(user.id);
  }

  @Get('version/:id')
  @ApiOkResponse({ description: 'Progress summary for a specific version (solved/incorrect/unseen counts)' })
  getVersionProgress(
    @Param('id', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: User,
  ) {
    return this.progressService.getVersionProgress(versionId, user.id);
  }
}
