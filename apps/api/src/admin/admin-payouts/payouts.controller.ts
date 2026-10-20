import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { RecordPayoutDto, SetAdvisorShareDto, SetDefaultShareDto } from '../../payouts/payouts.dto';
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

  /** Includes the advisor's full payout details so they can be paid; viewing them is recorded in the audit log. */
  @Get('advisors/:id')
  async advisor(@Request() req: AuthedRequest, @Param('id') id: string) {
    const detail = await this.payouts.adminAdvisor(id);
    await this.audit.log(req.user.id, 'payouts.view-details', 'AdvisorProfile', id);
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
    await this.audit.log(req.user.id, 'payouts.record', 'AdvisorPayout', payout.id, { advisorId: id, amountCents: payout.amountCents });
    return payout;
  }

  @Delete('payouts/:payoutId')
  async remove(@Request() req: AuthedRequest, @Param('payoutId') payoutId: string) {
    const removed = await this.payouts.deletePayout(payoutId);
    await this.audit.log(req.user.id, 'payouts.delete', 'AdvisorPayout', payoutId, { advisorId: removed.advisorId, amountCents: removed.amountCents });
    return { id: payoutId, deleted: true };
  }
}
