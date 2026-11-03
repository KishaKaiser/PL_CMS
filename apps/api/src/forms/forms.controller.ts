import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { clientIp } from '../common/client-ip';
import { SubmitCmsFormDto } from './forms.dto';
import { FormsService } from './forms.service';

@Controller('forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get(':slug')
  findPublished(@Param('slug') slug: string) {
    return this.formsService.findPublishedBySlug(slug);
  }

  @Post(':slug/submit')
  submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitCmsFormDto,
    // The visitor's own address as the proxies in front of the site report it (not the address of the web server that forwarded it).
    @Req() req: { headers: Record<string, string | string[] | undefined>; ip?: string },
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.formsService.submit(slug, dto, { ipAddress: clientIp(req), userAgent });
  }
}
