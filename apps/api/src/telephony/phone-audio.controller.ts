import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PhonePromptService } from './phone-prompt.service';

const FILE_NAME = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(mp3|wav)$/i;

/**
 * Serves the uploaded phone recordings. Telnyx fetches them without logging in, so this route is public: it only
 * ever returns audio, and only for the long random address of a recording an admin uploaded.
 */
@Controller('phone-audio')
export class PhoneAudioController {
  constructor(private readonly prompts: PhonePromptService) {}

  @Get(':file')
  async getAudio(@Param('file') file: string, @Res() res: Response) {
    const match = FILE_NAME.exec(file);
    if (!match) throw new NotFoundException();

    const audio = await this.prompts.getFile(match[1].toLowerCase());
    if (!audio) throw new NotFoundException();

    res.set({
      'Content-Type': audio.format === 'wav' ? 'audio/wav' : 'audio/mpeg',
      'Content-Length': String(audio.data.length),
      // A new upload gets a new address, so this one never changes and can be cached for good.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(audio.data);
  }
}
