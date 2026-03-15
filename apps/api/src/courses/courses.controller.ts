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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';
import { RateVersionDto } from './dto/rate-version.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // ─── Course Templates ─────────────────────────────────────────────────────

  @Get()
  @ApiOkResponse({ description: 'List all course templates' })
  @ApiQuery({ name: 'subject', required: false, enum: ['cs', 'math', 'other'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sort', required: false, enum: ['popular', 'recent'] })
  listCourses(
    @Query('subject') subject?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: 'popular' | 'recent',
  ) {
    return this.coursesService.listCourses({ subject, search, sort });
  }

  @Get('subjects')
  @ApiOkResponse({ description: 'Get all unique course subjects' })
  getSubjects() {
    return this.coursesService.getSubjects();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Get a course template by ID' })
  getCourse(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.getCourse(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Create a new course template' })
  createCourse(@Body() dto: CreateCourseDto, @CurrentUser() user: User) {
    return this.coursesService.createCourse(dto, user.id);
  }

  @Get(':id/versions')
  @ApiOkResponse({ description: 'List all public versions of a course' })
  listVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.listVersions(id);
  }

  // ─── Course Versions ──────────────────────────────────────────────────────

  @Get('versions/:id')
  @ApiOkResponse({ description: 'Get a version by ID' })
  getVersion(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.getVersion(id);
  }

  @Post('versions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ description: 'Create or fork a course version' })
  createVersion(@Body() dto: CreateVersionDto, @CurrentUser() user: User) {
    return this.coursesService.createVersion(dto, user.id);
  }

  @Put('versions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update a version (author only)' })
  updateVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.coursesService.updateVersion(id, dto, user.id, user.is_admin);
  }

  @Post('versions/:id/rate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  rateVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.coursesService.rateVersion(id, dto.rating, user.id);
  }

  @Delete('versions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  deleteVersion(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.coursesService.deleteVersion(id, user.id, user.is_admin);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  deleteCourse(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.coursesService.deleteCourse(id, user.id, user.is_admin);
  }
}
