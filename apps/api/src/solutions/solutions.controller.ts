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
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SolutionsService } from './solutions.service';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { VoteSolutionDto } from './dto/vote-solution.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';

@ApiTags('solutions')
@Controller('solutions')
export class SolutionsController {
  constructor(private readonly solutionsService: SolutionsService) {}

  @Get()
  @ApiOkResponse({ description: 'List solutions for a content item' })
  @ApiQuery({ name: 'content_item_id', required: true })
  listByItem(
    @Query('content_item_id') contentItemId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.solutionsService.listByItem(contentItemId, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Create a solution' })
  create(@Body() dto: CreateSolutionDto, @CurrentUser() user: User) {
    return this.solutionsService.create(dto, user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update a solution (author only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string },
    @CurrentUser() user: User,
  ) {
    return this.solutionsService.update(id, body.content, user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Delete a solution (author only)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.solutionsService.remove(id, user.id);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Vote on a solution (upsert)' })
  vote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoteSolutionDto,
    @CurrentUser() user: User,
  ) {
    return this.solutionsService.vote(id, dto, user.id);
  }
}
