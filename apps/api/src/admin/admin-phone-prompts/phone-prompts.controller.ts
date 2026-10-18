import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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
import { normalizePhoneNumber } from '../../telephony/phone-number';
import { MAX_PROMPT_AUDIO_BYTES, PhonePromptService } from '../../telephony/phone-prompt.service';
import { TelnyxService } from '../../telephony/telnyx.service';
import { AuditService } from '../audit/audit.service';

type AuthedRequest = { user: { id: string } };

@Controller('admin/phone-prompts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminPhonePromptsController {
  constructor(
    private readonly prompts: PhonePromptService,
    private readonly audit: AuditService,
    private readonly telnyx: TelnyxService,
  ) {}

  @Get()
  list() {
    return this.prompts.list();
  }

  /** Chooses the computer voice that reads every line without a recording (empty goes back to the default). */
  @Put('voice')
  async setVoice(@Request() req: AuthedRequest, @Body() body: { voice?: string | null }) {
    const info = await this.prompts.setVoice(body?.voice);
    await this.audit.log(req.user.id, 'phone-voice.set', 'PhonePrompt', 'voice', { voice: info.chosen ?? 'default' });
    return info;
  }

  /** Rings the admin's phone and reads a sample in the voice, to hear it before using it for real. */
  @Post('voice/test')
  @HttpCode(HttpStatus.NO_CONTENT)
  async testVoice(@Body() body: { phoneNumber?: string; voice?: string | null }) {
    const to = body?.phoneNumber ? normalizePhoneNumber(body.phoneNumber) : null;
    if (!to) throw new BadRequestException('Enter a valid phone number, including area code.');
    const voice = body.voice?.trim() || (await this.prompts.voice());
    await this.telnyx.placeVoiceTest(to, voice);
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
