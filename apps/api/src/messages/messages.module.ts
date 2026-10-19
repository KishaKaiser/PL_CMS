import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContactListsController, AdminBroadcastsController } from './contact-lists.controller';
import { ContactListsService } from './contact-lists.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [PrismaModule],
  controllers: [MessagesController, ContactListsController, AdminBroadcastsController],
  providers: [MessagesService, ContactListsService],
  exports: [MessagesService],
})
export class MessagesModule {}
