import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { ModerateReviewDto } from './reviews.dto';
import { AdminReviewsService } from './reviews.service';

type AuthedRequest = { user: { id: string } };

@Controller('admin/reviews')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviews: AdminReviewsService) {}

  @Get()
  list(@Query('status') status?: string, @Query('advisorId') advisorId?: string, @Query('search') search?: string) {
    return this.reviews.list({ status, advisorId, search });
  }

  @Get('advisors')
  listAdvisors() {
    return this.reviews.listAdvisors();
  }

  @Patch(':id')
  setHidden(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.setHidden(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.reviews.remove(req.user.id, id);
  }
}
