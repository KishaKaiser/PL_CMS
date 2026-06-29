import { Body, Controller, Post } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';

interface SubscribeDto {
  email?: string;
  name?: string;
}

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto);
  }
}
