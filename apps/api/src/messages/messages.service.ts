import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Role as DbRole } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import { publicName } from '../common/public-identity';
import { CreateMessageDto } from './messages.dto';

/**
 * Messaging works like email. Each message has a subject, replies stay together in a thread, and every person has
 * an inbox, a sent folder and a trash folder.
 *
 * Who can write to whom: a client can write to Support and to advisors they have contacted (spoken with, booked an
 * appointment with, or joined the callback line of); an advisor can write to Support and to clients who have
 * contacted them. Nobody can look up or write to anyone else.
 *
 * Support is one address: every staff member who writes to a client appears to them as "Support", and anything a
 * client sends to Support reaches the one support account (Admin > Settings > Messaging). Staff share a single
 * inbox of everything members have sent to Support, and a single sent folder of everything staff have sent.
 */

const STAFF_ROLES: DbRole[] = ['ADMIN', 'EDITOR'];
const SUPPORT_NAME = 'Support';
const MESSAGING_SETTINGS_KEY = 'messaging_settings';
export const MESSAGES_PAGE_SIZE = 25;
const MAX_SUBJECT_LENGTH = 150;
const SNIPPET_LENGTH = 120;

// Other people only ever see a username (or a staff name): never an email address or a client's real name.
const MESSAGE_USER_SELECT = { id: true, username: true, name: true, role: true } as const;
const MESSAGE_INCLUDE = { sender: { select: MESSAGE_USER_SELECT }, recipient: { select: MESSAGE_USER_SELECT } } as const;

type MessageUserRow = { id: string; username: string | null; name: string; role: string };
type MessageUser = { id: string; name: string; role: string };
type Viewer = { id: string; role: string };
export type Folder = 'inbox' | 'sent' | 'trash';
type Side = 'sender' | 'recipient';

interface MessageRow {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string | null;
  threadId: string | null;
  body: string;
  sentAt: Date;
  readAt: Date | null;
  senderFolder: string;
  recipientFolder: string;
  sender: MessageUserRow;
  recipient: MessageUserRow;
}

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

  // ── The mailbox ────────────────────────────────────────────────────────────

  /** Unread messages in the inbox, counting only the ones this user can open. */
  async unreadCount(viewer: Viewer): Promise<number> {
    const ctx = await this.context(viewer);
    return this.prisma.message.count({ where: { AND: [folderWhere(viewer, 'inbox', ctx.contactIds), { readAt: null }] } });
  }

  /** The numbers shown beside the folders. */
  async summary(viewer: Viewer) {
    const ctx = await this.context(viewer);
    const [unread, trash] = await Promise.all([
      this.prisma.message.count({ where: { AND: [folderWhere(viewer, 'inbox', ctx.contactIds), { readAt: null }] } }),
      this.prisma.message.count({ where: folderWhere(viewer, 'trash', ctx.contactIds) }),
    ]);
    return { unread, trash };
  }

  /** One page of a folder, newest first, optionally narrowed by a search over subject, text and names. */
  async list(viewer: Viewer, params: { folder?: string; q?: string; page?: number }) {
    const folder = parseFolder(params.folder);
    const page = Number.isFinite(params.page) && (params.page as number) > 0 ? Math.floor(params.page as number) : 1;
    const ctx = await this.context(viewer);

    const term = params.q?.trim();
    const where: Prisma.MessageWhereInput = {
      AND: [
        folderWhere(viewer, folder, ctx.contactIds),
        ...(term
          ? [
              {
                OR: [
                  { subject: { contains: term, mode: 'insensitive' as const } },
                  { body: { contains: term, mode: 'insensitive' as const } },
                  { sender: { username: { contains: term, mode: 'insensitive' as const } } },
                  { recipient: { username: { contains: term, mode: 'insensitive' as const } } },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, rows] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * MESSAGES_PAGE_SIZE,
        take: MESSAGES_PAGE_SIZE,
        include: MESSAGE_INCLUDE,
      }),
    ]);

    return {
      folder,
      page,
      pageSize: MESSAGES_PAGE_SIZE,
      total,
      messages: rows.map((row) => toSummary(viewer, row, ctx.supportId)),
    };
  }

  /** A message with the rest of its thread. Opening it marks the thread's messages to this user as read. */
  async get(viewer: Viewer, id: string) {
    const ctx = await this.context(viewer);
    const message = await this.openable(viewer, id, ctx);

    const threadKey = message.threadId ?? message.id;
    const thread = await this.prisma.message.findMany({
      where: { OR: [{ threadId: threadKey }, { id: threadKey, threadId: null }] },
      orderBy: { sentAt: 'asc' },
      include: MESSAGE_INCLUDE,
    });
    // Only what this user could see in their own mailbox: not messages they have deleted for good, or trash they
    // have not asked to see (the one that was opened is always included).
    const visible = thread.filter((row) => row.id === message.id || (this.canSee(viewer, row, ctx) && sideState(viewer, row) === 'ACTIVE'));

    const unreadIds = visible.filter((row) => mySide(viewer, row) === 'recipient' && row.readAt === null).map((row) => row.id);
    if (unreadIds.length > 0) {
      await this.prisma.message.updateMany({ where: { id: { in: unreadIds } }, data: { readAt: new Date() } });
    }
    // Describe the messages as they are now that they have been read.
    const now = new Date();
    const asRead = (row: MessageRow): MessageRow => (unreadIds.includes(row.id) ? { ...row, readAt: now } : row);

    return {
      message: toDetail(viewer, asRead(message), ctx.supportId),
      thread: visible.map((row) => toDetail(viewer, asRead(row), ctx.supportId)),
    };
  }

  /** Sends a new message, or a reply (which joins the thread of the message it answers). */
  async create(viewer: Viewer, dto: CreateMessageDto) {
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('Write a message before sending it.');
    if (dto.recipientId === viewer.id) {
      throw new BadRequestException('You cannot send a private message to yourself');
    }

    const ctx = await this.context(viewer);

    let threadId: string | undefined;
    let subject = dto.subject?.trim() ?? '';
    if (dto.inReplyToId) {
      const original = await this.openable(viewer, dto.inReplyToId, ctx);
      threadId = original.threadId ?? original.id;
      if (!subject) subject = replySubject(original.subject);
    } else if (!subject) {
      throw new BadRequestException('Add a subject.');
    }
    if (subject.length > MAX_SUBJECT_LENGTH) throw new BadRequestException(`A subject can be up to ${MAX_SUBJECT_LENGTH} characters.`);

    const recipient = await this.ensureUserExists(dto.recipientId);
    if (isStaff(viewer.role)) {
      if (isStaff(recipient.role)) throw new BadRequestException('Staff messages go through the Support inbox.');
    } else if (dto.recipientId !== ctx.supportId) {
      // Everyone except Support has to be someone this person has been in contact with.
      if (isStaff(recipient.role) || !ctx.contactIds.includes(dto.recipientId)) {
        throw new ForbiddenException('You can message Support, and advisors or clients you have been in contact with.');
      }
    }

    const created = await this.prisma.message.create({
      data: { senderId: viewer.id, recipientId: dto.recipientId, subject, body, ...(threadId ? { threadId } : {}) },
      include: MESSAGE_INCLUDE,
    });
    return toSummary(viewer, created, ctx.supportId);
  }

  /** Back to unread, for a message in this user's inbox. */
  async markUnread(viewer: Viewer, id: string) {
    const ctx = await this.context(viewer);
    const message = await this.openable(viewer, id, ctx);
    if (mySide(viewer, message) !== 'recipient') throw new BadRequestException('Only a message you received can be marked unread.');
    await this.prisma.message.update({ where: { id }, data: { readAt: null } });
    return { id, unread: true };
  }

  /** Moves a message to this user's trash. The other person's copy is not affected. */
  async remove(viewer: Viewer, id: string) {
    return this.moveTo(viewer, id, 'TRASH');
  }

  async restore(viewer: Viewer, id: string) {
    const ctx = await this.context(viewer);
    const message = await this.openable(viewer, id, ctx);
    if (sideState(viewer, message) !== 'TRASH') throw new BadRequestException('That message is not in the trash.');
    return this.moveTo(viewer, id, 'ACTIVE');
  }

  /** Deletes a trashed message for good, for this user only. Once both people have, it is removed entirely. */
  async purge(viewer: Viewer, id: string) {
    const ctx = await this.context(viewer);
    const message = await this.openable(viewer, id, ctx);
    if (sideState(viewer, message) !== 'TRASH') throw new BadRequestException('Move the message to the trash first.');

    const side = mySide(viewer, message) as Side;
    const other = side === 'sender' ? message.recipientFolder : message.senderFolder;
    if (other === 'PURGED') {
      await this.prisma.message.delete({ where: { id } });
    } else {
      await this.prisma.message.update({ where: { id }, data: side === 'sender' ? { senderFolder: 'PURGED' } : { recipientFolder: 'PURGED' } });
    }
    return { id, deleted: true };
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Who Support is and who this user is in contact with: the things every mailbox query depends on. */
  private async context(viewer: Viewer): Promise<{ supportId: string | null; contactIds: string[] }> {
    if (isStaff(viewer.role)) return { supportId: null, contactIds: [] };
    const [supportId, contacts] = await Promise.all([this.supportUserId(), this.contactsOf(viewer)]);
    return { supportId, contactIds: [...contacts.keys()] };
  }

  /** A message this user is a party to and may open: not someone else's, not from a non-contact, not purged. */
  private async openable(viewer: Viewer, id: string, ctx: { contactIds: string[] }): Promise<MessageRow> {
    const message = (await this.prisma.message.findUnique({ where: { id }, include: MESSAGE_INCLUDE })) as MessageRow | null;
    if (!message || !this.canSee(viewer, message, ctx) || sideState(viewer, message) === 'PURGED') {
      throw new NotFoundException('Message not found');
    }
    return message;
  }

  private canSee(viewer: Viewer, message: MessageRow, ctx: { contactIds: string[] }): boolean {
    const side = mySide(viewer, message);
    if (!side) return false;
    if (isStaff(viewer.role)) return true;
    const other = side === 'sender' ? message.recipient : message.sender;
    return isStaff(other.role) || ctx.contactIds.includes(other.id);
  }

  private async moveTo(viewer: Viewer, id: string, state: 'TRASH' | 'ACTIVE') {
    const ctx = await this.context(viewer);
    const message = await this.openable(viewer, id, ctx);
    const side = mySide(viewer, message) as Side;
    await this.prisma.message.update({ where: { id }, data: side === 'sender' ? { senderFolder: state } : { recipientFolder: state } });
    return { id, folder: state === 'TRASH' ? 'trash' : side === 'sender' ? 'sent' : 'inbox' };
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

// ── Pure helpers ─────────────────────────────────────────────────────────────

function toMessageUser(user: MessageUserRow): MessageUser {
  return { id: user.id, name: publicName(user), role: user.role };
}

function parseFolder(value: string | undefined): Folder {
  if (value === undefined || value === '') return 'inbox';
  if (value === 'inbox' || value === 'sent' || value === 'trash') return value;
  throw new BadRequestException('Unknown folder.');
}

/** Which side of the message this user is on. Staff act for Support: the staff side of any message with a member. */
function mySide(viewer: Viewer, message: Pick<MessageRow, 'senderId' | 'recipientId' | 'sender' | 'recipient'>): Side | null {
  if (isStaff(viewer.role)) {
    const senderStaff = isStaff(message.sender.role);
    const recipientStaff = isStaff(message.recipient.role);
    if (senderStaff && !recipientStaff) return 'sender';
    if (!senderStaff && recipientStaff) return 'recipient';
    return null;
  }
  if (message.senderId === viewer.id) return 'sender';
  if (message.recipientId === viewer.id) return 'recipient';
  return null;
}

function sideState(viewer: Viewer, message: MessageRow): string {
  const side = mySide(viewer, message);
  return side === 'sender' ? message.senderFolder : message.recipientFolder;
}

/** The other person must be Support (any staff member) or one of the user's contacts. */
function otherIsReachable(contactIds: string[]) {
  return { OR: [{ role: { in: STAFF_ROLES } }, { id: { in: contactIds } }] };
}

/** The messages in one folder for this user. */
function folderWhere(viewer: Viewer, folder: Folder, contactIds: string[]): Prisma.MessageWhereInput {
  if (isStaff(viewer.role)) {
    const received = (state: string): Prisma.MessageWhereInput => ({
      sender: { role: { notIn: STAFF_ROLES } },
      recipient: { role: { in: STAFF_ROLES } },
      recipientFolder: state,
    });
    const sent = (state: string): Prisma.MessageWhereInput => ({
      sender: { role: { in: STAFF_ROLES } },
      recipient: { role: { notIn: STAFF_ROLES } },
      senderFolder: state,
    });
    if (folder === 'inbox') return received('ACTIVE');
    if (folder === 'sent') return sent('ACTIVE');
    return { OR: [received('TRASH'), sent('TRASH')] };
  }

  const received = (state: string): Prisma.MessageWhereInput => ({
    recipientId: viewer.id,
    recipientFolder: state,
    sender: otherIsReachable(contactIds),
  });
  const sent = (state: string): Prisma.MessageWhereInput => ({
    senderId: viewer.id,
    senderFolder: state,
    recipient: otherIsReachable(contactIds),
  });
  if (folder === 'inbox') return received('ACTIVE');
  if (folder === 'sent') return sent('ACTIVE');
  return { OR: [received('TRASH'), sent('TRASH')] };
}

/** A member never sees which staff member wrote or received a message, only "Support". */
function seenAs(viewer: Viewer, user: MessageUserRow, supportId: string | null): MessageUser {
  return !isStaff(viewer.role) && isStaff(user.role)
    ? { id: supportId ?? user.id, name: SUPPORT_NAME, role: 'SUPPORT' }
    : toMessageUser(user);
}

function snippetOf(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > SNIPPET_LENGTH ? `${flat.slice(0, SNIPPET_LENGTH - 1)}…` : flat;
}

function replySubject(subject: string | null): string {
  const base = subject?.trim() || '(no subject)';
  return /^re:\s*/i.test(base) ? base : `Re: ${base}`;
}

/** A row in a folder list. */
function toSummary(viewer: Viewer, message: MessageRow, supportId: string | null) {
  const side = mySide(viewer, message);
  return {
    id: message.id,
    threadId: message.threadId ?? message.id,
    subject: message.subject ?? '',
    snippet: snippetOf(message.body),
    sentAt: message.sentAt,
    readAt: message.readAt,
    unread: side === 'recipient' && message.readAt === null,
    fromMe: side === 'sender',
    // In the trash it matters which of your copies was deleted: the one you sent or the one you received.
    folder: sideState(viewer, message) === 'TRASH' ? 'trash' : side === 'sender' ? 'sent' : 'inbox',
    from: seenAs(viewer, message.sender, supportId),
    to: seenAs(viewer, message.recipient, supportId),
  };
}

/** A message opened for reading, with its text. */
function toDetail(viewer: Viewer, message: MessageRow, supportId: string | null) {
  return { ...toSummary(viewer, message, supportId), body: message.body };
}
