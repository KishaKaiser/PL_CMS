import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@pl-cms/shared';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AstrologyReportsService } from './astrology-reports.service';
import { getAstrologyReportsDir } from './report-storage.util';

const MAX_REPORT_FILE_SIZE = 25 * 1024 * 1024;

@Controller('astrology/reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AstrologyOrdersController {
  constructor(private readonly reportsService: AstrologyReportsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.reportsService.listAllReports(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.reportsService.getReportForAdmin(id);
  }

  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: unknown, _file: unknown, callback: (error: Error | null, destination: string) => void) => {
          const uploadDirectory = getAstrologyReportsDir();
          mkdirSync(uploadDirectory, { recursive: true });
          callback(null, uploadDirectory);
        },
        filename: (req: unknown, _file: unknown, callback: (error: Error | null, filename: string) => void) => {
          const id = (req as { params: { id: string } }).params.id;
          callback(null, `${id}.pdf`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          callback(new UnsupportedMediaTypeException('Only PDF files are supported.'), false);
          return;
        }
        callback(null, true);
      },
      limits: { fileSize: MAX_REPORT_FILE_SIZE },
    }),
  )
  upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.reportsService.uploadReportFile(id, file);
  }

  @Post(':id/fail')
  fail(@Param('id') id: string, @Body('message') message: string) {
    return this.reportsService.markReportFailed(id, message?.trim() || 'The report could not be generated.');
  }
}
