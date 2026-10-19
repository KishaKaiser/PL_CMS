import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from './messages.service';

/**
 * An advisor's own lists of the clients they have spoken with ("Monday callers"). A list can only hold clients the
 * advisor has been in contact with, and the advisor can write to everyone on a list in one go.
 */

const MAX_LISTS = 25;
const MAX_NAME_LENGTH = 40;

@Injectable()
export class ContactListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: MessagesService,
  ) {}

  /** Everything the Lists page needs: the lists with their members, and every client with the lists they are on. */
  async overview(userId: string) {
    const [clients, lists] = await Promise.all([
      this.clientsOf(userId),
      this.prisma.contactList.findMany({
        where: { advisorUserId: userId },
        orderBy: { name: 'asc' },
        include: { members: { select: { clientUserId: true } } },
      }),
    ]);
    const nameOf = new Map(clients.map((c) => [c.id, c.name]));
    const listIdsOf = new Map<string, string[]>();
    for (const list of lists) {
      for (const member of list.members) {
        listIdsOf.set(member.clientUserId, [...(listIdsOf.get(member.clientUserId) ?? []), list.id]);
      }
    }
    return {
      lists: lists.map((list) => ({
        id: list.id,
        name: list.name,
        members: list.members
          .filter((m) => nameOf.has(m.clientUserId))
          .map((m) => ({ id: m.clientUserId, name: nameOf.get(m.clientUserId) as string }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
      clients: clients.map((c) => ({ id: c.id, name: c.name, listIds: listIdsOf.get(c.id) ?? [] })),
    };
  }

  async create(userId: string, name: string, clientUserId?: string) {
    const clean = this.cleanName(name);
    if ((await this.prisma.contactList.count({ where: { advisorUserId: userId } })) >= MAX_LISTS) {
      throw new BadRequestException(`You can have up to ${MAX_LISTS} lists.`);
    }
    if (clientUserId) await this.assertClient(userId, clientUserId);
    await this.assertNameFree(userId, clean);

    const list = await this.prisma.contactList.create({
      data: {
        advisorUserId: userId,
        name: clean,
        ...(clientUserId ? { members: { create: { clientUserId } } } : {}),
      },
      select: { id: true, name: true },
    });
    return list;
  }

  async rename(userId: string, listId: string, name: string) {
    const list = await this.owned(userId, listId);
    const clean = this.cleanName(name);
    if (clean !== list.name) await this.assertNameFree(userId, clean);
    return this.prisma.contactList.update({ where: { id: listId }, data: { name: clean }, select: { id: true, name: true } });
  }

  async remove(userId: string, listId: string) {
    await this.owned(userId, listId);
    await this.prisma.contactList.delete({ where: { id: listId } });
    return { id: listId, deleted: true };
  }

  async addMember(userId: string, listId: string, clientUserId: string) {
    await this.owned(userId, listId);
    await this.assertClient(userId, clientUserId);
    await this.prisma.contactListMember.upsert({
      where: { listId_clientUserId: { listId, clientUserId } },
      create: { listId, clientUserId },
      update: {},
    });
    return { listId, clientUserId };
  }

  async removeMember(userId: string, listId: string, clientUserId: string) {
    await this.owned(userId, listId);
    await this.prisma.contactListMember.deleteMany({ where: { listId, clientUserId } });
    return { listId, clientUserId };
  }

  /** Writes to everyone on the list. */
  async message(userId: string, listId: string, subject: string, body: string) {
    const list = await this.prisma.contactList.findFirst({
      where: { id: listId, advisorUserId: userId },
      select: { members: { select: { clientUserId: true } } },
    });
    if (!list) throw new NotFoundException('List not found');
    if (list.members.length === 0) throw new BadRequestException('Add clients to this list first.');
    return this.messages.sendBulk(
      { id: userId, role: 'ADVISOR' },
      list.members.map((m) => m.clientUserId),
      subject,
      body,
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async clientsOf(userId: string) {
    const contacts = await this.messages.listContacts({ id: userId, role: 'ADVISOR' });
    return contacts.filter((contact) => contact.role === 'CLIENT');
  }

  private async assertClient(userId: string, clientUserId: string) {
    const clients = await this.clientsOf(userId);
    if (!clients.some((c) => c.id === clientUserId)) {
      throw new ForbiddenException('You can add clients who have contacted you.');
    }
  }

  private async owned(userId: string, listId: string) {
    const list = await this.prisma.contactList.findFirst({ where: { id: listId, advisorUserId: userId }, select: { id: true, name: true } });
    if (!list) throw new NotFoundException('List not found');
    return list;
  }

  private cleanName(name: string): string {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) throw new BadRequestException('Give the list a name.');
    if (clean.length > MAX_NAME_LENGTH) throw new BadRequestException(`A list name can be up to ${MAX_NAME_LENGTH} characters.`);
    return clean;
  }

  private async assertNameFree(userId: string, name: string) {
    const clash = await this.prisma.contactList.findFirst({
      where: { advisorUserId: userId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (clash) throw new ConflictException('You already have a list with that name.');
  }
}
