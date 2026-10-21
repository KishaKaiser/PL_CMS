import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ApplicationsService } from './applications.service';
import { MAX_UPLOAD_BYTES } from './onboarding.constants';
import { ActivateDto, DirectDepositDto, DisplayNameDto, PaypalDto, RateDto, SignAgreementDto, SubmitApplicationDto, W9Dto } from './onboarding.dto';
import { OnboardingService } from './onboarding.service';

type AuthedRequest = { user: { id: string }; headers: Record<string, string | string[] | undefined>; ip?: string };

/** The address a request came from, as reported by the proxies in front of the site. Recorded for reference only. */
export function clientIp(req: Pick<AuthedRequest, 'headers' | 'ip'>): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.ip || undefined;
}

/** Anyone: apply to become an advisor, and open the link that was emailed after approval. */
@Controller()
export class OnboardingPublicController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly onboarding: OnboardingService,
  ) {}

  @Post('advisor-applications')
  apply(@Request() req: AuthedRequest, @Body() dto: SubmitApplicationDto) {
    return this.applications.submit(dto, clientIp(req));
  }

  /** Whether an emailed link is good, already used or out of date. */
  @Get('advisor-onboarding/link')
  link(@Query('token') token?: string) {
    return this.onboarding.checkLink(token ?? '');
  }

  /** Sets the advisor's password from the emailed link; returns the tokens that sign them in. */
  @Post('advisor-onboarding/activate')
  activate(@Body() dto: ActivateDto) {
    return this.onboarding.activate(dto.token, dto.password);
  }
}

/** The signed-in advisor's own onboarding checklist. */
@Controller('advisor-onboarding/me')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADVISOR)
export class OnboardingMeController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  status(@Request() req: AuthedRequest) {
    return this.onboarding.status(req.user.id);
  }

  @Post('display-name')
  displayName(@Request() req: AuthedRequest, @Body() dto: DisplayNameDto) {
    return this.onboarding.chooseDisplayName(req.user.id, dto.displayName);
  }

  @Post('rate')
  rate(@Request() req: AuthedRequest, @Body() dto: RateDto) {
    return this.onboarding.setRate(req.user.id, dto.ratePerMinute);
  }

  @Post('payment/paypal')
  paypal(@Request() req: AuthedRequest, @Body() dto: PaypalDto) {
    return this.onboarding.setPaypal(req.user.id, dto.paypalEmail);
  }

  @Post('agreement')
  agreement(@Request() req: AuthedRequest, @Body() dto: SignAgreementDto) {
    return this.onboarding.signAgreement(req.user.id, dto, clientIp(req));
  }

  @Post('w9')
  w9(@Request() req: AuthedRequest, @Body() dto: W9Dto) {
    return this.onboarding.submitW9(req.user.id, dto);
  }

  @Post('direct-deposit')
  directDeposit(@Request() req: AuthedRequest, @Body() dto: DirectDepositDto) {
    return this.onboarding.submitDirectDeposit(req.user.id, dto, clientIp(req));
  }

  /** A completed form uploaded instead of filling it in on the site. `type` is agreement, w9 or direct-deposit. */
  @Post('documents/:type/upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@Request() req: AuthedRequest, @Param('type') type: string, @UploadedFile() file: { buffer?: Buffer; size?: number } | undefined) {
    return this.onboarding.upload(req.user.id, type, file);
  }

  /** The blank form, to print or fill in outside the site. */
  @Get('forms/:type/blank')
  async blank(@Param('type') type: string, @Res({ passthrough: true }) res: Response) {
    const { bytes, fileName } = await this.onboarding.blankForm(type);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(Buffer.from(bytes));
  }

  /** The advisor's own copy of a form they submitted. */
  @Get('documents/:type')
  async own(@Request() req: AuthedRequest, @Param('type') type: string, @Res({ passthrough: true }) res: Response) {
    const { meta, bytes } = await this.onboarding.ownDocument(req.user.id, type);
    res.set({ 'Content-Type': meta.mimeType, 'Content-Disposition': `attachment; filename="${meta.fileName}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(bytes);
  }
}
