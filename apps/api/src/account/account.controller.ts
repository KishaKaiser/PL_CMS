import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { createReadStream, mkdirSync } from 'fs';
import type { Response } from 'express';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  MAX_MEDIA_FILE_SIZE,
  generateMediaStorageKey,
  getMediaUploadDirectory,
  isImageMimeType,
} from '../admin/admin-media/media.util';
import {
  SaveAddressDto,
  SavePaymentMethodDto,
  SavePayoutMethodDto,
  UpdateAccountDto,
  UpdateAdvisorProfileDto,
} from './account.dto';
import { AccountService } from './account.service';
import { AstrologyReportsService } from '../astrology/astrology-reports.service';

type AuthenticatedRequest = { user: { id: string } };

@Controller('account')
@UseGuards(AuthGuard('jwt'))
export class AccountController {
  constructor(
    private readonly accountService: AccountService,
    private readonly astrologyReports: AstrologyReportsService,
  ) {}

  @Get('dashboard')
  getDashboard(@Request() req: AuthenticatedRequest) {
    return this.accountService.getDashboard(req.user.id);
  }

  @Patch('me')
  updateAccount(@Request() req: AuthenticatedRequest, @Body() dto: UpdateAccountDto) {
    return this.accountService.updateAccount(req.user.id, dto);
  }

  @Get('downloads')
  listDownloads(@Request() req: AuthenticatedRequest) {
    return this.astrologyReports.listUserDownloads(req.user.id);
  }

  @Get('downloads/:id/file')
  async downloadReportFile(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.astrologyReports.getReportFile(id, req.user.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    createReadStream(file.filePath).pipe(res);
  }

  @Get('addresses')
  listAddresses(@Request() req: AuthenticatedRequest) {
    return this.accountService.listAddresses(req.user.id);
  }

  @Post('addresses')
  createAddress(@Request() req: AuthenticatedRequest, @Body() dto: SaveAddressDto) {
    return this.accountService.createAddress(req.user.id, dto);
  }

  @Patch('addresses/:id')
  updateAddress(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SaveAddressDto,
  ) {
    return this.accountService.updateAddress(req.user.id, id, dto);
  }

  @Delete('addresses/:id')
  removeAddress(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.accountService.removeAddress(req.user.id, id);
  }

  @Get('payment-methods')
  listPaymentMethods(@Request() req: AuthenticatedRequest) {
    return this.accountService.listPaymentMethods(req.user.id);
  }

  @Post('payment-methods')
  createPaymentMethod(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SavePaymentMethodDto,
  ) {
    return this.accountService.createPaymentMethod(req.user.id, dto);
  }

  @Delete('payment-methods/:id')
  removePaymentMethod(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.accountService.removePaymentMethod(req.user.id, id);
  }

  @Patch('advisor-profile')
  updateAdvisorProfile(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateAdvisorProfileDto,
  ) {
    return this.accountService.updateAdvisorProfile(req.user.id, dto);
  }

  @Post('advisor-profile/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: unknown, _file: unknown, callback: (error: Error | null, destination: string) => void) => {
          const uploadDirectory = getMediaUploadDirectory();
          mkdirSync(uploadDirectory, { recursive: true });
          callback(null, uploadDirectory);
        },
        filename: (_req: unknown, file: { originalname: string }, callback: (error: Error | null, filename: string) => void) => {
          callback(null, generateMediaStorageKey(file.originalname));
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype) || !isImageMimeType(file.mimetype)) {
          callback(new UnsupportedMediaTypeException('Only JPG, PNG, GIF, and WEBP profile images are supported.'), false);
          return;
        }
        callback(null, true);
      },
      limits: { fileSize: MAX_MEDIA_FILE_SIZE },
    }),
  )
  uploadAdvisorProfileImage(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.accountService.uploadAdvisorProfileImage(req.user.id, file);
  }

  @Post('payout-methods')
  createPayoutMethod(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SavePayoutMethodDto,
  ) {
    return this.accountService.createPayoutMethod(req.user.id, dto);
  }

  @Delete('payout-methods/:id')
  removePayoutMethod(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.accountService.removePayoutMethod(req.user.id, id);
  }
}
