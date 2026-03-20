import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PracticeService } from './practice.service';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PracticeMode, User } from '@lambda/shared';

@ApiTags('practice')
@Controller('practice')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Get('options')
  @ApiOkResponse({ description: 'Returns available topics and item counts for a version' })
  @ApiQuery({ name: 'version_id', required: true })
  @ApiQuery({ name: 'with_solution', required: false, type: Boolean })
  getOptions(
    @Query('version_id') version_id: string,
    @CurrentUser() user: User,
    @Query('with_solution') with_solution?: string,
  ) {
    return this.practiceService.getOptions(version_id, user.id, with_solution === 'true');
  }

  @Get('session')
  @ApiOkResponse({ description: 'Returns an ordered list of content items for practice' })
  @ApiQuery({ name: 'version_id', required: true })
  @ApiQuery({ name: 'topic_id', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['proof', 'exam_question', 'exercise_question', 'algorithm', 'other'] })
  @ApiQuery({ name: 'question_format', required: false, description: 'Comma-separated formats: flashcard,multiple_choice,open' })
  @ApiQuery({ name: 'mode', required: true, enum: ['random', 'topic', 'exam', 'spaced_repetition'] })
  @ApiQuery({ name: 'with_solution', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items to return' })
  @ApiQuery({ name: 'progress_filter', required: false, description: 'Filter by past rating: unseen, incorrect, needs_review, solved, easy' })
  @ApiQuery({ name: 'no_topic', required: false, type: Boolean, description: 'Include only items with no topic assigned' })
  getSession(
    @Query('version_id') version_id: string,
    @Query('mode') mode: PracticeMode,
    @CurrentUser() user: User,
    @Query('topic_id') topic_id?: string,
    @Query('type') type?: string,
    @Query('question_format') question_format?: string,
    @Query('with_solution') with_solution?: string,
    @Query('limit') limit?: string,
    @Query('progress_filter') progress_filter?: string,
    @Query('no_topic') no_topic?: string,
  ) {
    return this.practiceService.getSession({
      version_id,
      topic_ids: topic_id ? topic_id.split(',') : undefined,
      no_topic: no_topic === 'true',
      type,
      question_formats: question_format ? question_format.split(',') : undefined,
      mode, userId: user.id,
      with_solution: with_solution === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      progress_filter,
    });
  }

  @Post('attempt')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Record an attempt and update user progress' })
  submitAttempt(@Body() dto: SubmitAttemptDto, @CurrentUser() user: User) {
    return this.practiceService.submitAttempt(dto, user.id);
  }
}
