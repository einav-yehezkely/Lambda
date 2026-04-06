import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
  Body,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@lambda/shared';
import { PdfImportService } from './pdf-import.service';

@ApiTags('pdf-import')
@Controller('pdf-import')
export class PdfImportController {
  constructor(private readonly pdfImportService: PdfImportService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  importPdf(
    @UploadedFile() file: any,
    @Query('version_id', ParseUUIDPipe) versionId: string,
    @Body('topics') topicsJson: string,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are accepted');
    }
    let existingTopicTitles: string[] = [];
    if (topicsJson) {
      try {
        const parsed = JSON.parse(topicsJson);
        if (Array.isArray(parsed)) {
          existingTopicTitles = parsed.filter((t) => typeof t === 'string');
        }
      } catch {
        // Ignore malformed topics; proceed with empty list
      }
    }
    return this.pdfImportService.importPdf(file.buffer, versionId, user.id, existingTopicTitles);
  }
}
