import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@pl-cms/shared';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { ContactListsService } from './contact-lists.service';
import { BroadcastDto, ContactListDto, ListMessageDto } from './messages.dto';
import { MessagesService } from './messages.service';

type AuthedRequest = { user: { id: string; role: string } };

/** An advisor's custom lists of clients. */
@Controller('contact-lists')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADVISOR)
export class ContactListsController {
  constructor(private readonly lists: ContactListsService) {}

  @Get()
  overview(@Request() req: AuthedRequest) {
    return this.lists.overview(req.user.id);
  }

  @Post()
  create(@Request() req: AuthedRequest, @Body() dto: ContactListDto) {
    return this.lists.create(req.user.id, dto.name, dto.clientUserId);
  }

  @Patch(':id')
  rename(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: ContactListDto) {
    return this.lists.rename(req.user.id, id, dto.name);
  }

  @Delete(':id')
  remove(@Request() req: AuthedRequest, @Param('id') id: string) {
    return this.lists.remove(req.user.id, id);
  }

  @Put(':id/members/:clientUserId')
  addMember(@Request() req: AuthedRequest, @Param('id') id: string, @Param('clientUserId') clientUserId: string) {
    return this.lists.addMember(req.user.id, id, clientUserId);
  }

  @Delete(':id/members/:clientUserId')
  removeMember(@Request() req: AuthedRequest, @Param('id') id: string, @Param('clientUserId') clientUserId: string) {
    return this.lists.removeMember(req.user.id, id, clientUserId);
  }

  /** Sends one message to everyone on the list. */
  @Post(':id/message')
  message(@Request() req: AuthedRequest, @Param('id') id: string, @Body() dto: ListMessageDto) {
    return this.lists.message(req.user.id, id, dto.subject, dto.body);
  }
}

/** Admin: write to every client, every advisor, or both. */
@Controller('admin/broadcasts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminBroadcastsController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  history() {
    return this.messages.broadcastHistory();
  }

  @Post()
  send(@Request() req: AuthedRequest, @Body() dto: BroadcastDto) {
    return this.messages.broadcast(req.user.id, dto.audience, dto.subject, dto.body);
  }
}
