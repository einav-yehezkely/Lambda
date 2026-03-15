import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { TopicsModule } from './topics/topics.module';
import { ContentModule } from './content/content.module';
import { PracticeModule } from './practice/practice.module';
import { ProgressModule } from './progress/progress.module';
import { FeedbackModule } from './feedback/feedback.module';
import { SolutionsModule } from './solutions/solutions.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { VersionFilesModule } from './version-files/version-files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    CoursesModule,
    TopicsModule,
    ContentModule,
    PracticeModule,
    ProgressModule,
    FeedbackModule,
    SolutionsModule,
    AnnouncementsModule,
    VersionFilesModule,
  ],
})
export class AppModule {}
