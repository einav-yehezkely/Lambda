import { Controller, Get, Post, Delete, Body, Param, HttpCode, UseGuards, ParseUUIDPipe } from '@nestjs/common';
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

  @Post('enroll')
  @HttpCode(204)
  @ApiOkResponse({ description: 'Enroll in a version' })
  enroll(@CurrentUser() user: User, @Body() body: { version_id: string }) {
    return this.progressService.enrollInCourse(user.id, body.version_id);
  }

  @Delete('enroll/:versionId')
  @HttpCode(204)
  @ApiOkResponse({ description: 'Unenroll from a version' })
  unenroll(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: User,
  ) {
    return this.progressService.unenrollFromCourse(user.id, versionId);
  }

  @Get('active-versions')
  @ApiOkResponse({ description: 'Versions the user has made progress on, with progress summaries' })
  getActiveVersions(@CurrentUser() user: User) {
    return this.progressService.getActiveVersions(user.id);
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
