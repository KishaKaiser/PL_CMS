import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@pl-cms/shared';
import { memoryStorage } from 'multer';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { MAX_PROMPT_AUDIO_BYTES, PhonePromptService } from '../../telephony/phone-prompt.service';
import { AuditService } from '../audit/audit.service';

type AuthedRequest = { user: { id: string } };

@Controller('admin/phone-prompts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminPhonePromptsController {
  constructor(
    private readonly prompts: PhonePromptService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.prompts.list();
  }

  /** Replaces the computer voice for one line with an uploaded MP3 or WAV recording. */
  @Post(':key/audio')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_PROMPT_AUDIO_BYTES } }))
  async upload(@Request() req: AuthedRequest, @Param('key') key: string, @UploadedFile() file?: Express.Multer.File) {
    const saved = await this.prompts.save(key, file);
    await this.audit.log(req.user.id, 'phone-prompt.upload', 'PhonePrompt', key, {
      format: saved.format,
      sizeBytes: saved.sizeBytes,
    });
    return saved;
  }

  /** Goes back to the computer voice for this line. */
  @Delete(':key/audio')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: AuthedRequest, @Param('key') key: string) {
    await this.prompts.remove(key);
    await this.audit.log(req.user.id, 'phone-prompt.remove', 'PhonePrompt', key);
  }
}
