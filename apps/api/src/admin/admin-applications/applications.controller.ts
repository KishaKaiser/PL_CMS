import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import type { Response } from 'express';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { AgreementSettingsService } from '../../onboarding/agreement-settings.service';
import { ApplicationsService } from '../../onboarding/applications.service';
import { MAX_UPLOAD_BYTES } from '../../onboarding/onboarding.constants';
import { AgreementSettingsDto, RejectApplicationDto } from '../../onboarding/onboarding.dto';
import { OnboardingDocumentsService } from '../../onboarding/onboarding-documents.service';
import { AuditService } from '../audit/audit.service';

type AuthedRequest = { user: { id: string } };

/** Admin: review advisor applications, send onboarding links, open the forms advisors submitted, and edit the agreement. */
@Controller('admin/advisor-applications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly documents: OnboardingDocumentsService,
    private readonly agreement: AgreementSettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.applications.list(status);
  }

  @Get('agreement')
  getAgreement() {
    return this.agreement.get();
  }

  @Put('agreement')
  async setAgreement(@Request() req: AuthedRequest, @Body() dto: AgreementSettingsDto) {
    const saved = await this.agreement.set(dto);
    await this.audit.log(req.user.id, 'onboarding.agreement-edit', 'Setting', 'advisor_agreement', { title: saved.title, length: saved.body.length });
    return saved;
  }

  /** A form an advisor submitted. Every download is recorded in the audit log. */
  @Get('documents/:docId')
  async download(@Request() req: AuthedRequest, @Param('docId') docId: string, @Res({ passthrough: true }) res: Response) {
    const { meta, bytes, advisorId } = await this.documents.read(docId);
    await this.audit.log(req.user.id, 'onboarding.document-download', 'OnboardingDocument', docId, { advisorId, type: meta.type });
    res.set({ 'Content-Type': meta.mimeType, 'Content-Disposition': `attachment; filename="${meta.fileName}"`, 'Cache-Control': 'no-store' });
    return new StreamableFile(bytes);
  }

  /** Deletes a stored form, for example once it has been copied somewhere safe. The advisor can submit it again. */
  @Delete('documents/:docId')
  async removeDocument(@Request() req: AuthedRequest, @Param('docId') docId: string) {
    const removed = await this.documents.remove(docId);
    await this.audit.log(req.user.id, 'onboarding.document-delete', 'OnboardingDocument', docId, { advisorId: removed.advisorId, type: removed.type });
    return { id: docId, deleted: true };
  }

  /** Adds a signed form the advisor emailed (for example the W-9) so it is stored with the rest. */
  @Post(':id/documents/:type')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async addDocument(
    @Request() req: AuthedRequest,
    @Param('id') id: string,
    @Param('type') type: string,
    @UploadedFile() file: { buffer?: Buffer } | undefined,
  ) {
    const result = await this.applications.addDocument(id, type, file);
    await this.audit.log(req.user.id, 'onboarding.document-add', 'AdvisorApplication', id, { type });
    return result;
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.applications.get(id);
  }

  @Post(':id/approve')
  async approve(@Request() req: AuthedRequest, @Param('id') id: string) {
    const result = await this.applications.approve(req.user.id, id);
    await this.audit.log(req.user.id, 'onboarding.application-approve', 'AdvisorApplication', id, { emailSent: result.emailSent });
    return result;
  }

  @Post(':id/resend')
  async resend(@Request() req: AuthedRequest, @Param('id') id: string) {
    const result = await this.applications.resendLink(id);
    await this.audit.log(req.user.id, 'onboarding.link-resend', 'AdvisorApplication', id, { emailSent: result.emailSent });
    return result;
  }

  @Post(':id/reject')
  async reject(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: RejectApplicationDto) {
    const result = await this.applications.reject(req.user.id, id, dto.note);
    await this.audit.log(req.user.id, 'onboarding.application-reject', 'AdvisorApplication', id);
    return result;
  }
}
