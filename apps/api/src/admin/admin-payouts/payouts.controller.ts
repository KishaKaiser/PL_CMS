import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { BankOnFileDto, RecordPayoutDto, SetAdvisorShareDto, SetDefaultShareDto, SetPaypalFeeDto } from '../../payouts/payouts.dto';
import { PayoutsService } from '../../payouts/payouts.service';
import { AuditService } from '../audit/audit.service';

type AuthedRequest = { user: { id: string } };

/** Admin: the revenue share, what each advisor is owed, and the payments made to them. */
@Controller('admin/payouts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminPayoutsController {
  constructor(
    private readonly payouts: PayoutsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  overview() {
    return this.payouts.adminOverview();
  }

  @Put('settings/share')
  async setDefaultShare(@Request() req: AuthedRequest, @Body() dto: SetDefaultShareDto) {
    const sharePercent = await this.payouts.setDefaultShare(dto.sharePercent);
    await this.audit.log(req.user.id, 'payouts.default-share', 'Setting', 'payout_settings', { sharePercent });
    return { defaultSharePercent: sharePercent };
  }

  @Put('settings/paypal-fee')
  async setPaypalFee(@Request() req: AuthedRequest, @Body() dto: SetPaypalFeeDto) {
    const paypalFeePercent = await this.payouts.setPaypalFeePercent(dto.paypalFeePercent);
    await this.audit.log(req.user.id, 'payouts.paypal-fee', 'Setting', 'payout_settings', { paypalFeePercent });
    return { paypalFeePercent };
  }

  /** One advisor: how they are paid right now (it follows whatever they last chose), what they are owed, and recent history. */
  @Get('advisors/:id')
  advisor(@Param('id') id: string) {
    return this.payouts.adminAdvisor(id);
  }

  /** Support has received (or no longer has) the advisor's bank information from onboarding, which unlocks Direct Deposit for them. */
  @Put('advisors/:id/bank-on-file')
  async bankOnFile(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: BankOnFileDto) {
    const detail = await this.payouts.setBankOnFile(id, dto.onFile);
    await this.audit.log(req.user.id, 'payouts.bank-on-file', 'AdvisorProfile', id, { onFile: dto.onFile });
    return detail;
  }

  @Patch('advisors/:id/share')
  async setShare(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: SetAdvisorShareDto) {
    const result = await this.payouts.setAdvisorShare(id, dto.sharePercent);
    await this.audit.log(req.user.id, 'payouts.advisor-share', 'AdvisorProfile', id, { sharePercent: result.sharePercent });
    return result;
  }

  @Post('advisors/:id/payouts')
  async record(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: RecordPayoutDto) {
    const payout = await this.payouts.recordPayout(req.user.id, id, dto);
    await this.audit.log(req.user.id, 'payouts.record', 'AdvisorPayout', payout.id, { advisorId: id, amountCents: payout.amountCents, feeCents: payout.feeCents });
    return payout;
  }

  @Delete('payouts/:payoutId')
  async remove(@Request() req: AuthedRequest, @Param('payoutId') payoutId: string) {
    const removed = await this.payouts.deletePayout(payoutId);
    await this.audit.log(req.user.id, 'payouts.delete', 'AdvisorPayout', payoutId, { advisorId: removed.advisorId, amountCents: removed.amountCents });
    return { id: payoutId, deleted: true };
  }
}
