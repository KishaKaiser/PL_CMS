import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { Role } from '@pl-cms/shared';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Clients and advisors are known to each other only by username: never a real name and never an email address.
 * Admin and staff accounts may still be shown by name.
 */
export function isPublicRole(role: string | null | undefined): boolean {
  return role === Role.CLIENT || role === Role.ADVISOR;
}

/** "psychic_denise" becomes "Psychic Denise": the username as people read it. The username itself stays as typed. */
export function displayNameFromUsername(username: string): string {
  const words = username.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return username;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * The name shown on a blog post. An admin's posts are shown as "Admin" rather than their own name; anyone else is shown by
 * their username, or their name if they have none.
 */
export function authorDisplayName(author: { username?: string | null; name?: string | null; role?: string | null }): string {
  if (author.role === Role.ADMIN) return 'Admin';
  return author.username || author.name?.trim() || 'Author';
}

/** What other people see for this account. */
export function publicName(user: { username?: string | null; name?: string | null; role?: string | null }): string {
  if (user.username) return displayNameFromUsername(user.username);
  if (user.role === Role.CLIENT) return 'Client';
  if (user.role === Role.ADVISOR) return 'Advisor';
  return user.name?.trim() || 'Member';
}

/** Lowercase letters, digits, dot, dash and underscore only, so a username can never look like an email address. */
export function assertPublicUsername(username: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
    throw new BadRequestException(
      'Usernames are 3 to 30 characters: lowercase letters, numbers, dots, dashes and underscores. They cannot be an email address.',
    );
  }
}

/** "client-3fa91c" / "advisor-3fa91c": a stand-in for accounts that never chose a username. */
export function generateUsername(role: string): string {
  const prefix = role === Role.ADVISOR ? 'advisor' : 'client';
  return `${prefix}-${randomBytes(3).toString('hex')}`;
}

export async function generateUniqueUsername(prisma: PrismaService, role: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = generateUsername(role);
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${generateUsername(role)}-${randomBytes(2).toString('hex')}`;
}
