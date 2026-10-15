import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { SetPhoneNumberDto, SubmitReviewDto } from './billing.dto';
import { PhoneService } from './phone.service';

@Controller('phone')
export class PhoneController {
  constructor(private readonly phoneService: PhoneService) {}

  /** Public: the cards of advisors who are online right now. */
  @Get('advisors')
  listAdvisors() {
    return this.phoneService.listAdvisors();
  }

  /** Public: one advisor's profile page data (bio, rate, hours, rating and comments), online or not. */
  @Get('advisors/:slug')
  getPublicProfile(@Param('slug') slug: string) {
    return this.phoneService.getPublicProfile(slug);
  }

  @Get('advisors/:slug/my-review')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  getMyReview(@Request() req: { user: { id: string } }, @Param('slug') slug: string) {
    return this.phoneService.getMyReview(req.user.id, slug);
  }

  @Post('advisors/:slug/review')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  submitReview(
    @Request() req: { user: { id: string } },
    @Param('slug') slug: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.phoneService.submitReview(req.user.id, slug, dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  getMyPhoneProfile(@Request() req: { user: { id: string } }) {
    return this.phoneService.getMyPhoneProfile(req.user.id);
  }

  @Put('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  setMyPhoneNumber(@Request() req: { user: { id: string } }, @Body() dto: SetPhoneNumberDto) {
    return this.phoneService.setMyPhoneNumber(req.user.id, dto.phoneNumber);
  }
}
