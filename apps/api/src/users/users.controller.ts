import { Controller, Get, Post, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('leaderboard')
  @ApiOkResponse({ description: 'Top 10 contributors by number of public course versions' })
  getLeaderboard() {
    return this.usersService.getLeaderboard(10);
  }

  @Get('by-id/:id')
  @ApiOkResponse({ description: 'Get a public user profile by ID' })
  async getProfileById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

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

  @Get(':username/stats')
  @ApiOkResponse({ description: 'Get contribution stats for a user' })
  async getUserStats(@Param('username') username: string) {
    return this.usersService.getUserStats(username);
  }

  @Get(':username/solutions')
  @ApiOkResponse({ description: 'Get all solutions submitted by a user' })
  async getUserSolutions(@Param('username') username: string) {
    return this.usersService.getSolutionsByUsername(username);
  }

  @Post(':username/send-message')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOkResponse({ description: 'Send a custom email to a user (admin only)' })
  async sendMessage(
    @Param('username') username: string,
    @Body() body: { subject: string; message: string },
    @CurrentUser() admin: User,
  ) {
    await this.usersService.sendMessageToUser(username, body.subject, body.message, admin.id);
    return { success: true };
  }
}
