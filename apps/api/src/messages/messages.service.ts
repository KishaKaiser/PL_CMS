import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Role as DbRole } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import { publicName } from '../common/public-identity';
import { CreateMessageDto } from './messages.dto';

/**
 * Messaging works like email, not instant messaging. A client can write to Support and to advisors they have
 * contacted (spoken with, booked an appointment with, or joined the callback line of); an advisor can write to
 * Support and to clients who have contacted them. Nobody can look up or write to anyone else.
 *
 * Support is one address: every staff member who writes to a client appears to them as "Support", and anything a
 * client sends to Support reaches the one support account (Admin > Settings > Messaging). Staff share a single
 * inbox of everything members have sent to Support.
 */

const STAFF_ROLES: DbRole[] = ['ADMIN', 'EDITOR'];
const SUPPORT_NAME = 'Support';
const MESSAGING_SETTINGS_KEY = 'messaging_settings';
const MAX_STAFF_MESSAGES = 2000;

// Other people only ever see a username (or a staff name): never an email address or a client's real name.
const MESSAGE_USER_SELECT = { id: true, username: true, name: true, role: true } as const;

type MessageUserRow = { id: string; username: string | null; name: string; role: string };
type MessageUser = { id: string; name: string; role: string };
type Viewer = { id: string; role: string };

const isStaff = (role: string) => (STAFF_ROLES as string[]).includes(role);

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Contacts ───────────────────────────────────────────────────────────────

  /**
   * The people this user can write to. For a client or advisor: Support first, then everyone they have been in
   * contact with. For staff: every client and advisor.
   */
  async listContacts(viewer: Viewer): Promise<MessageUser[]> {
    if (isStaff(viewer.role)) {
      const users = await this.prisma.user.findMany({
        where: { role: { notIn: STAFF_ROLES }, id: { not: viewer.id } },
        orderBy: [{ role: 'asc' }, { username: 'asc' }, { name: 'asc' }],
        select: MESSAGE_USER_SELECT,
        take: 1000,
      });
      return users.map(toMessageUser);
    }

    const [supportId, contacts] = await Promise.all([this.supportUserId(), this.contactsOf(viewer)]);
    const people = [...contacts.values()].map(toMessageUser).sort((a, b) => a.name.localeCompare(b.name));
    return supportId ? [{ id: supportId, name: SUPPORT_NAME, role: 'SUPPORT' }, ...people] : people;
  }

  /** The one account that receives what members send to Support. */
  private async supportUserId(): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({ where: { key: MESSAGING_SETTINGS_KEY } });
    if (setting) {
      try {
        const chosen = (JSON.parse(setting.value) as { supportUserId?: unknown }).supportUserId;
        if (typeof chosen === 'string' && chosen) {
          const user = await this.prisma.user.findFirst({ where: { id: chosen, role: { in: STAFF_ROLES } }, select: { id: true } });
          if (user) return user.id;
        }
      } catch {
        // an unreadable setting falls back to the default below
      }
    }
    const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    return admin?.id ?? null;
  }

  /** The advisors a client has contacted, or the clients who have contacted an advisor. */
  private async contactsOf(viewer: Viewer): Promise<Map<string, MessageUserRow>> {
    const found = new Map<string, MessageUserRow>();
    const add = (user: MessageUserRow | undefined) => {
      if (user && user.id !== viewer.id && !isStaff(user.role)) found.set(user.id, user);
    };
    const userSelect = { select: { user: { select: MESSAGE_USER_SELECT } } } as const;

    if (viewer.role === 'CLIENT') {
      const [calls, appointments, spots] = await Promise.all([
        this.prisma.callSession.findMany({
          where: { client: { userId: viewer.id }, connectedAt: { not: null } },
          select: { advisor: userSelect },
          distinct: ['advisorId'],
        }),
        this.prisma.appointment.findMany({ where: { client: { userId: viewer.id } }, select: { advisor: userSelect }, distinct: ['advisorId'] }),
        this.prisma.queueAssignment.findMany({
          where: { client: { userId: viewer.id } },
          select: { queue: { select: { advisor: userSelect } } },
          distinct: ['queueId'],
        }),
      ]);
      calls.forEach((row) => add(row.advisor.user));
      appointments.forEach((row) => add(row.advisor.user));
      spots.forEach((row) => add(row.queue.advisor.user));
    } else if (viewer.role === 'ADVISOR') {
      const [calls, appointments, spots] = await Promise.all([
        this.prisma.callSession.findMany({
          where: { advisor: { userId: viewer.id }, connectedAt: { not: null } },
          select: { client: userSelect },
          distinct: ['clientId'],
        }),
        this.prisma.appointment.findMany({ where: { advisor: { userId: viewer.id } }, select: { client: userSelect }, distinct: ['clientId'] }),
        this.prisma.queueAssignment.findMany({
          where: { queue: { advisor: { userId: viewer.id } } },
          select: { client: userSelect },
          distinct: ['clientId'],
        }),
      ]);
      calls.forEach((row) => add(row.client.user));
      appointments.forEach((row) => add(row.client.user));
      spots.forEach((row) => add(row.client.user));
    }
    return found;
  }

  // ── Conversations ──────────────────────────────────────────────────────────

  /**
   * How many unread messages this user has, counting only the ones they can actually open: from Support and from
   * their contacts (not from people they are no longer in contact with). For staff it is the shared Support inbox.
   */
  async unreadCount(viewer: Viewer): Promise<number> {
    if (isStaff(viewer.role)) {
      return this.prisma.message.count({ where: { readAt: null, recipient: { role: { in: STAFF_ROLES } }, sender: { role: { notIn: STAFF_ROLES } } } });
    }
    const contactIds = [...(await this.contactsOf(viewer)).keys()];
    return this.prisma.message.count({
      where: { recipientId: viewer.id, readAt: null, OR: [{ sender: { role: { in: STAFF_ROLES } } }, { senderId: { in: contactIds } }] },
    });
  }

  async listConversations(viewer: Viewer) {
    const staff = isStaff(viewer.role);
    const [supportId, contacts] = staff
      ? [null, new Map<string, MessageUserRow>()]
      : await Promise.all([this.supportUserId(), this.contactsOf(viewer)]);

    const messages = await this.prisma.message.findMany({
      where: staff ? supportTraffic() : { OR: [{ senderId: viewer.id }, { recipientId: viewer.id }] },
      orderBy: { sentAt: 'desc' },
      take: staff ? MAX_STAFF_MESSAGES : undefined,
      include: { sender: { select: MESSAGE_USER_SELECT }, recipient: { select: MESSAGE_USER_SELECT } },
    });

    const conversations = new Map<string, { participant: MessageUser; lastMessage: ReturnType<typeof present>; unreadCount: number }>();
    for (const message of messages) {
      let other: MessageUserRow;
      if (staff) other = isStaff(message.sender.role) ? message.recipient : message.sender;
      else other = message.senderId === viewer.id ? message.recipient : message.sender;

      // For a member, every staff member is the one "Support"; and old threads with people who are no longer
      // contacts are not shown.
      const key = !staff && isStaff(other.role) ? (supportId ?? other.id) : other.id;
      if (!staff && key !== supportId && !contacts.has(key)) continue;

      let conversation = conversations.get(key);
      if (!conversation) {
        conversation = {
          participant: !staff && isStaff(other.role) ? { id: key, name: SUPPORT_NAME, role: 'SUPPORT' } : toMessageUser(other),
          lastMessage: present(viewer, message, supportId),
          unreadCount: 0,
        };
        conversations.set(key, conversation);
      }

      const unread = staff ? isStaff(message.recipient.role) : message.recipientId === viewer.id;
      if (unread && !message.readAt) conversation.unreadCount += 1;
    }
    return Array.from(conversations.values());
  }

  async getConversation(viewer: Viewer, participantId: string) {
    const staff = isStaff(viewer.role);
    const participant = await this.ensureUserExists(participantId);

    if (staff) {
      if (isStaff(participant.role)) throw new BadRequestException('Staff messages go through the Support inbox.');
      const messages = await this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: participantId, recipient: { role: { in: STAFF_ROLES } } },
            { recipientId: participantId, sender: { role: { in: STAFF_ROLES } } },
          ],
        },
        orderBy: { sentAt: 'asc' },
        include: { sender: { select: MESSAGE_USER_SELECT }, recipient: { select: MESSAGE_USER_SELECT } },
      });
      await this.prisma.message.updateMany({
        where: { senderId: participantId, recipient: { role: { in: STAFF_ROLES } }, readAt: null },
        data: { readAt: new Date() },
      });
      return messages.map((message) => present(viewer, message, null));
    }

    const supportId = await this.supportUserId();
    const toSupport = participantId === supportId;
    if (!toSupport && !(await this.contactsOf(viewer)).has(participantId)) {
      throw new ForbiddenException('You can only read conversations with Support and with people you have been in contact with.');
    }

    const messages = await this.prisma.message.findMany({
      where: toSupport
        ? {
            OR: [
              { senderId: viewer.id, recipient: { role: { in: STAFF_ROLES } } },
              { recipientId: viewer.id, sender: { role: { in: STAFF_ROLES } } },
            ],
          }
        : {
            OR: [
              { senderId: viewer.id, recipientId: participantId },
              { senderId: participantId, recipientId: viewer.id },
            ],
          },
      orderBy: { sentAt: 'asc' },
      include: { sender: { select: MESSAGE_USER_SELECT }, recipient: { select: MESSAGE_USER_SELECT } },
    });

    await this.prisma.message.updateMany({
      where: toSupport
        ? { recipientId: viewer.id, sender: { role: { in: STAFF_ROLES } }, readAt: null }
        : { senderId: participantId, recipientId: viewer.id, readAt: null },
      data: { readAt: new Date() },
    });

    return messages.map((message) => present(viewer, message, supportId));
  }

  async create(viewer: Viewer, dto: CreateMessageDto) {
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Message body is required');
    if (dto.recipientId === viewer.id) {
      throw new BadRequestException('You cannot send a private message to yourself');
    }

    const recipient = await this.ensureUserExists(dto.recipientId);
    const supportId = isStaff(viewer.role) ? null : await this.supportUserId();

    if (isStaff(viewer.role)) {
      if (isStaff(recipient.role)) throw new BadRequestException('Staff messages go through the Support inbox.');
    } else if (dto.recipientId !== supportId) {
      // Everyone except Support has to be someone this person has been in contact with.
      if (isStaff(recipient.role) || !(await this.contactsOf(viewer)).has(dto.recipientId)) {
        throw new ForbiddenException('You can message Support, and advisors or clients you have been in contact with.');
      }
    }

    const created = await this.prisma.message.create({
      data: { senderId: viewer.id, recipientId: dto.recipientId, body },
      include: { sender: { select: MESSAGE_USER_SELECT }, recipient: { select: MESSAGE_USER_SELECT } },
    });
    return present(viewer, created, supportId);
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

  private async ensureUserExists(userId: string): Promise<MessageUserRow> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: MESSAGE_USER_SELECT,
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }
}

function toMessageUser(user: MessageUserRow): MessageUser {
  return { id: user.id, name: publicName(user), role: user.role };
}

/** Everything exchanged between staff and members: the shared Support inbox. */
function supportTraffic() {
  return {
    OR: [
      { sender: { role: { in: STAFF_ROLES } }, recipient: { role: { notIn: STAFF_ROLES } } },
      { sender: { role: { notIn: STAFF_ROLES } }, recipient: { role: { in: STAFF_ROLES } } },
    ],
  };
}

/** A message as this viewer sees it. A member never sees which staff member wrote or received it, only "Support". */
function present<T extends { senderId: string; recipientId: string; sender: MessageUserRow; recipient: MessageUserRow }>(
  viewer: Viewer,
  message: T,
  supportId: string | null,
) {
  const asSeen = (user: MessageUserRow): { id: string; user: MessageUser } =>
    !isStaff(viewer.role) && isStaff(user.role)
      ? { id: supportId ?? user.id, user: { id: supportId ?? user.id, name: SUPPORT_NAME, role: 'SUPPORT' } }
      : { id: user.id, user: toMessageUser(user) };
  const sender = asSeen(message.sender);
  const recipient = asSeen(message.recipient);
  return { ...message, senderId: sender.id, recipientId: recipient.id, sender: sender.user, recipient: recipient.user };
}
