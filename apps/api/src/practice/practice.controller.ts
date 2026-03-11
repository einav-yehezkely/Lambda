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

  @Get('session')
  @ApiOkResponse({ description: 'Returns an ordered list of content items for practice' })
  @ApiQuery({ name: 'version_id', required: true })
  @ApiQuery({ name: 'topic_id', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['proof', 'exam_question', 'exercise_question'] })
  @ApiQuery({ name: 'mode', required: true, enum: ['random', 'topic', 'exam', 'spaced_repetition'] })
  @ApiQuery({ name: 'with_solution', required: false, type: Boolean })
  getSession(
    @Query('version_id') version_id: string,
    @Query('mode') mode: PracticeMode,
    @CurrentUser() user: User,
    @Query('topic_id') topic_id?: string,
    @Query('type') type?: string,
    @Query('with_solution') with_solution?: string,
  ) {
    return this.practiceService.getSession({
      version_id, topic_id, type, mode, userId: user.id,
      with_solution: with_solution === 'true',
    });
  }

  @Post('attempt')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Record an attempt and update user progress' })
  submitAttempt(@Body() dto: SubmitAttemptDto, @CurrentUser() user: User) {
    return this.practiceService.submitAttempt(dto, user.id);
  }
}
