import { Controller, Get, Header, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { AdminCallsService, CallFilter } from './calls.service';

type AuthedRequest = { user: { id: string } };

interface FilterQuery extends CallFilter {
  page?: string;
  tz?: string;
}

@Controller('admin/calls')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminCallsController {
  constructor(private readonly calls: AdminCallsService) {}

  @Get()
  list(@Query() query: FilterQuery) {
    return this.calls.list(filterOf(query), Number(query.page ?? 1));
  }

  @Get('live')
  live() {
    return this.calls.live();
  }

  @Get('revenue')
  revenue(@Query() query: FilterQuery) {
    return this.calls.revenue(filterOf(query), query.tz);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@Query() query: FilterQuery) {
    return this.calls.exportCsv(filterOf(query));
  }

  @Post(':id/end')
  end(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.calls.endCall(req.user.id, id);
  }
}

function filterOf(query: FilterQuery): CallFilter {
  return {
    from: query.from,
    to: query.to,
    advisorId: query.advisorId,
    clientId: query.clientId,
    outcome: query.outcome,
    source: query.source,
    search: query.search,
  };
}
