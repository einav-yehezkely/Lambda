import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';
import { CourseRequestsService } from './course-requests.service';
import { CreateCourseRequestDto } from './dto/create-course-request.dto';
import { FulfillCourseRequestDto } from './dto/fulfill-course-request.dto';

@ApiTags('course-requests')
@ApiBearerAuth()
@Controller('course-requests')
export class CourseRequestsController {
  constructor(private readonly service: CourseRequestsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCourseRequestDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll() {
    return this.service.findAll();
  }

  @Post(':id/fulfill')
  @UseGuards(JwtAuthGuard, AdminGuard)
  fulfill(@Param('id') id: string, @Body() dto: FulfillCourseRequestDto, @CurrentUser() user: User) {
    return this.service.fulfill(id, dto, user.id);
  }
}
