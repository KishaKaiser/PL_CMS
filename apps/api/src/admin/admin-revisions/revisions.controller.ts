import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../../auth/roles.guard';
import { RevisionsService } from './revisions.service';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.EDITOR)
export class RevisionsController {
  constructor(private readonly revisionsService: RevisionsService) {}

  @Get('posts/:id/revisions')
  listPostRevisions(@Param('id') id: string) {
    return this.revisionsService.listRevisions('POST', id);
  }

  @Get('pages/:id/revisions')
  listPageRevisions(@Param('id') id: string) {
    return this.revisionsService.listRevisions('PAGE', id);
  }

  @Put('posts/:id/autosave')
  autosavePost(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Request() req: { user: { sub: string } },
  ) {
    return this.revisionsService.autosave('POST', id, body, req.user.sub);
  }

  @Put('pages/:id/autosave')
  autosavePage(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Request() req: { user: { sub: string } },
  ) {
    return this.revisionsService.autosave('PAGE', id, body, req.user.sub);
  }

  @Post('posts/:id/revisions/:revisionId/restore')
  restorePost(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.revisionsService.restoreRevision('POST', id, revisionId, req.user.sub);
  }

  @Post('pages/:id/revisions/:revisionId/restore')
  restorePage(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Request() req: { user: { sub: string } },
  ) {
    return this.revisionsService.restoreRevision('PAGE', id, revisionId, req.user.sub);
  }
}
