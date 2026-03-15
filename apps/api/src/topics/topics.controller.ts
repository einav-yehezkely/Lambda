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
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiCreatedResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TopicsService } from './topics.service';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';

@ApiTags('topics')
@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  @ApiOkResponse({ description: 'List topics for a version, ordered by order_index' })
  @ApiQuery({ name: 'version_id', required: true })
  listByVersion(@Query('version_id') versionId: string) {
    return this.topicsService.listByVersion(versionId);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Get topic by ID' })
  getTopic(@Param('id', ParseUUIDPipe) id: string) {
    return this.topicsService.getTopic(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Create a topic in a version (author only)' })
  createTopic(@Body() dto: CreateTopicDto, @CurrentUser() user: User) {
    return this.topicsService.createTopic(dto, user.id, user.is_admin);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update a topic (version author only)' })
  updateTopic(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTopicDto,
    @CurrentUser() user: User,
  ) {
    return this.topicsService.updateTopic(id, dto, user.id, user.is_admin);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Delete a topic (version author only)' })
  deleteTopic(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.topicsService.deleteTopic(id, user.id, user.is_admin);
  }
}
