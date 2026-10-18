import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateMessageDto } from './messages.dto';
import { MessagesService } from './messages.service';

type AuthenticatedRequest = { user: { id: string; role: string } };

@Controller('messages')
@UseGuards(AuthGuard('jwt'))
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /** Who the signed-in user can write to: Support and the people they have been in contact with. */
  @Get('contacts')
  listContacts(@Request() req: AuthenticatedRequest) {
    return this.messagesService.listContacts(req.user);
  }

  /** The numbers beside the folders: unread in the inbox and what is in the trash. */
  @Get('summary')
  summary(@Request() req: AuthenticatedRequest) {
    return this.messagesService.summary(req.user);
  }

  /** One page of a folder (inbox, sent or trash), optionally searched. */
  @Get()
  list(
    @Request() req: AuthenticatedRequest,
    @Query('folder') folder?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
  ) {
    return this.messagesService.list(req.user, { folder, q, page: page ? Number(page) : undefined });
  }

  /** A message and the rest of its thread. */
  @Get(':id')
  get(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.messagesService.get(req.user, id);
  }

  /** A new message (needs a subject) or a reply (`inReplyToId`). */
  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateMessageDto) {
    return this.messagesService.create(req.user, dto);
  }

  @Patch(':id/read')
  markRead(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.messagesService.markRead(req.user.id, id);
  }

  @Patch(':id/unread')
  markUnread(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.messagesService.markUnread(req.user, id);
  }

  /** Moves a message to the trash. */
  @Delete(':id')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.messagesService.remove(req.user, id);
  }

  @Post(':id/restore')
  restore(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.messagesService.restore(req.user, id);
  }

  /** Deletes a trashed message for good (for this user). */
  @Post(':id/purge')
  purge(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.messagesService.purge(req.user, id);
  }
}
