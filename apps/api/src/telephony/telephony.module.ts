import { Module } from '@nestjs/common';
import { PhoneAudioController } from './phone-audio.controller';
import { PhonePromptService } from './phone-prompt.service';
import { TelnyxService } from './telnyx.service';

@Module({
  controllers: [PhoneAudioController],
  providers: [TelnyxService, PhonePromptService],
  exports: [TelnyxService, PhonePromptService],
})
export class TelephonyModule {}
