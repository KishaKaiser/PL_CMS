import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './messages.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listContacts(userId: string) {
    return this.prisma.user.findMany({
      where: { id: { not: userId } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { id: true, email: true, name: true, role: true },
    });
  }

  async listConversations(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { sentAt: 'desc' },
      include: {
        sender: { select: { id: true, email: true, name: true, role: true } },
        recipient: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    const conversations = new Map<string, {
      participant: { id: string; email: string; name: string; role: string };
      lastMessage: typeof messages[number];
      unreadCount: number;
    }>();

    for (const message of messages) {
      const participant =
        message.senderId === userId ? message.recipient : message.sender;
      const existing = conversations.get(participant.id);

      if (!existing) {
        conversations.set(participant.id, {
          participant,
          lastMessage: message,
          unreadCount: 0,
        });
      }

      if (message.recipientId === userId && !message.readAt) {
        conversations.get(participant.id)!.unreadCount += 1;
      }
    }

    return Array.from(conversations.values());
  }

  async getConversation(userId: string, participantId: string) {
    await this.ensureUserExists(participantId);

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: participantId },
          { senderId: participantId, recipientId: userId },
        ],
      },
      orderBy: { sentAt: 'asc' },
      include: {
        sender: { select: { id: true, email: true, name: true, role: true } },
        recipient: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    await this.prisma.message.updateMany({
      where: { senderId: participantId, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    return messages;
  }

  async create(userId: string, dto: CreateMessageDto) {
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message body is required');
    if (dto.recipientId === userId) {
      throw new BadRequestException('You cannot send a private message to yourself');
    }

    await this.ensureUserExists(dto.recipientId);

    return this.prisma.message.create({
      data: {
        senderId: userId,
        recipientId: dto.recipientId,
        body,
      },
      include: {
        sender: { select: { id: true, email: true, name: true, role: true } },
        recipient: { select: { id: true, email: true, name: true, role: true } },
      },
    });
  }

  async markRead(userId: string, messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) throw new NotFoundException(`Message ${messageId} not found`);
    if (message.recipientId !== userId) throw new ForbiddenException();

    return this.prisma.message.update({
      where: { id: messageId },
      data: { readAt: message.readAt ?? new Date() },
    });
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
  }
}
