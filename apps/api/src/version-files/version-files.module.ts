import { Module } from '@nestjs/common';
import { VersionFilesController } from './version-files.controller';
import { VersionFilesService } from './version-files.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [VersionFilesController],
  providers: [VersionFilesService],
  exports: [VersionFilesService],
})
export class VersionFilesModule {}
