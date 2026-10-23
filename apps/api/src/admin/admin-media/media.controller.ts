import { Body, Controller, Delete, Get, Param, Post, Query, Res, StreamableFile, UploadedFile, UnsupportedMediaTypeException, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'fs';
import type { Response } from 'express';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ListMediaDto, UploadMediaDto } from './media.dto';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_PDF_FILE_SIZE,
  generateMediaStorageKey,
  getMediaUploadDirectory,
  isImageMimeType,
  isPdfMimeType,
  sanitizeDownloadName,
} from './media.util';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  findAll(@Query() dto: ListMediaDto) {
    return this.mediaService.findAll(dto);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: unknown, _file: unknown, callback: (error: Error | null, destination: string) => void) => {
          const uploadDirectory = getMediaUploadDirectory();
          mkdirSync(uploadDirectory, { recursive: true });
          callback(null, uploadDirectory);
        },
        filename: (
          _req: unknown,
          file: { originalname: string },
          callback: (error: Error | null, filename: string) => void,
        ) => {
          callback(null, generateMediaStorageKey(file.originalname));
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype)) {
          callback(new UnsupportedMediaTypeException('Only JPG, PNG, GIF, WEBP, and PDF uploads are supported.'), false);
          return;
        }
        callback(null, true);
      },
      // The most any file may be; images are held to their own lower limit when the upload is saved.
      limits: {
        fileSize: MAX_PDF_FILE_SIZE,
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadMediaDto) {
    return this.mediaService.create(file, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string) {
    return this.mediaService.delete(id);
  }

  @Get(':id/file')
  async getFile(@Param('id') id: string, @Query('download') download: string | undefined, @Res({ passthrough: true }) res: Response) {
    const { asset, stream } = await this.mediaService.openFileStream(id);
    // Pictures and PDFs open in the browser (so a PDF can be shown on a page); "?download=1" saves the file instead.
    const showInBrowser = isImageMimeType(asset.mimeType) || isPdfMimeType(asset.mimeType);
    const disposition = showInBrowser && !download ? 'inline' : 'attachment';
    const filename = sanitizeDownloadName(asset.originalName);

    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return new StreamableFile(stream);
  }
}
