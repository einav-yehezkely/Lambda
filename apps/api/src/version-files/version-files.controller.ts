import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  Body,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VersionFilesService } from './version-files.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';

@ApiTags('version-files')
@Controller('versions/:versionId/files')
export class VersionFilesController {
  constructor(private readonly versionFilesService: VersionFilesService) {}

  @Get()
  list(@Param('versionId', ParseUUIDPipe) versionId: string) {
    return this.versionFilesService.list(versionId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @UploadedFile() file: any,
    @Body('display_name') displayName: string,
    @CurrentUser() user: User,
  ) {
    return this.versionFilesService.upload(versionId, file, displayName, user.id);
  }

  @Put(':fileId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  rename(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Body('display_name') displayName: string,
    @CurrentUser() user: User,
  ) {
    return this.versionFilesService.rename(fileId, displayName, user.id);
  }

  @Delete(':fileId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
  ) {
    return this.versionFilesService.remove(fileId, user.id);
  }

  @Get(':fileId/url')
  getUrl(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('download') download?: string,
  ) {
    return this.versionFilesService.getSignedUrl(fileId, download === 'true');
  }
}
