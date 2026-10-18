import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
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

  @Get('conversations')
  listConversations(@Request() req: AuthenticatedRequest) {
    return this.messagesService.listConversations(req.user);
  }

  @Get('conversations/:participantId')
  getConversation(
    @Request() req: AuthenticatedRequest,
    @Param('participantId') participantId: string,
  ) {
    return this.messagesService.getConversation(req.user, participantId);
  }

  @Post()
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateMessageDto) {
    return this.messagesService.create(req.user, dto);
  }

  @Patch(':id/read')
  markRead(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.messagesService.markRead(req.user.id, id);
  }
}
