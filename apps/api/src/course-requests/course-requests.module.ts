import { Module } from '@nestjs/common';
import { CourseRequestsController } from './course-requests.controller';
import { CourseRequestsService } from './course-requests.service';

@Module({
  controllers: [CourseRequestsController],
  providers: [CourseRequestsService],
})
export class CourseRequestsModule {}
