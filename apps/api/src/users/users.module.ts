import { Global, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Global()
@Module({
  controllers: [UsersController],
  providers: [UsersService, JwtAuthGuard],
  exports: [UsersService, JwtAuthGuard],
})
export class UsersModule {}
