import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  @ApiOkResponse({ description: 'Get a public user profile by username' })
  async getProfile(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Get(':username/versions')
  @ApiOkResponse({ description: 'Get all course versions authored by this user' })
  async getUserVersions(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) throw new NotFoundException('User not found');
    return this.usersService.getVersionsByUserId(user.id);
  }
}
