import { Body, Controller, Get, Headers, Ip, Param, Post } from '@nestjs/common';
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
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.formsService.submit(slug, dto, { ipAddress, userAgent });
  }
}
