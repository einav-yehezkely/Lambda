import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { VoteContentDto } from './dto/vote-content.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  @ApiOkResponse({ description: 'List content items for a version' })
  @ApiQuery({ name: 'version_id', required: true })
  @ApiQuery({ name: 'topic_id', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['proof', 'exam_question', 'exercise_question'] })
  @ApiQuery({ name: 'difficulty', required: false, enum: ['easy', 'medium', 'hard'] })
  listByVersion(
    @Query('version_id') version_id: string,
    @Query('topic_id') topic_id?: string,
    @Query('type') type?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    return this.contentService.listByVersion({ version_id, topic_id, type, difficulty });
  }

  @Get('search')
  @ApiOkResponse({ description: 'Return version IDs that have content items matching a title query' })
  @ApiQuery({ name: 'course_id', required: true })
  @ApiQuery({ name: 'q', required: true })
  searchTitles(
    @Query('course_id') courseId: string,
    @Query('q') q: string,
  ) {
    return this.contentService.searchContentTitles(courseId, q);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Get a content item by ID' })
  getItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.contentService.getItem(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Create a content item and add it to a version' })
  createItem(@Body() dto: CreateContentDto, @CurrentUser() user: User) {
    return this.contentService.createItem(dto, user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update a content item (author only)' })
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentDto,
    @CurrentUser() user: User,
  ) {
    return this.contentService.updateItem(id, dto, user.id, user.is_admin);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Delete a content item entirely (author only) — cascades to solutions and version associations' })
  deleteItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.contentService.deleteItem(id, user.id, user.is_admin);
  }

  @Delete(':id/from/:versionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Remove item from a version (junction only, item preserved)' })
  removeFromVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: User,
  ) {
    return this.contentService.removeFromVersion(id, versionId, user.id, user.is_admin);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Vote on a content item (upsert)' })
  vote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoteContentDto,
    @CurrentUser() user: User,
  ) {
    return this.contentService.vote(id, dto, user.id);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
    @CurrentUser() user: User,
  ) {
    return this.contentService.uploadImage(id, file, user.id, user.is_admin);
  }

  @Delete(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { url: string },
    @CurrentUser() user: User,
  ) {
    return this.contentService.deleteImage(id, body.url, user.id, user.is_admin);
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Report an error in a content item — sends email to the author' })
  async reportError(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { error_text: string; reporter_username?: string },
  ) {
    return this.contentService.reportError(id, body.error_text, body.reporter_username);
  }
}
