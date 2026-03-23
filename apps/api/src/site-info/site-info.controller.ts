import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SiteInfoService } from './site-info.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('site-info')
@Controller('site-info')
export class SiteInfoController {
  constructor(private readonly siteInfoService: SiteInfoService) {}

  @Get()
  @ApiOkResponse({ description: 'Get site info content (public)' })
  get() {
    return this.siteInfoService.get();
  }

  @Put()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Update site info content (admin only)' })
  update(@Body() body: { content: string }) {
    return this.siteInfoService.update(body.content ?? '');
  }
}
