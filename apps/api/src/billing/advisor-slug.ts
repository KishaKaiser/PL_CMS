import type { PrismaService } from '../prisma/prisma.service';

/** "Madame Zelda's Tarot!" becomes "madame-zelda-s-tarot". */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return base || 'advisor';
}

/** "Psychic_Denise" becomes "psychic_denise": a username as it appears in the profile link. */
export function slugFromUsername(username: string): string {
  const base = username
    .toLowerCase()
    .replace(/[.\s]+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48);
  return base || 'advisor';
}

/** Whether this slug is the one built from the username (or that one with a number added to keep it unique). */
export function slugMatchesUsername(slug: string, username: string): boolean {
  const base = slugFromUsername(username);
  if (slug === base) return true;
  return slug.startsWith(`${base}_`) && /^[0-9]+$/.test(slug.slice(base.length + 1));
}

/**
 * The advisor's profile slug, assigning a unique one from their username the first time it is needed.
 * Once assigned it never changes, so links people have shared keep working if the advisor renames themselves.
 */
export async function ensureAdvisorSlug(
  prisma: PrismaService,
  advisor: { id: string; displayName: string; slug: string | null },
): Promise<string> {
  if (advisor.slug) return advisor.slug;

  const owner = await prisma.advisorProfile.findUnique({ where: { id: advisor.id }, select: { user: { select: { username: true } } } });
  const username = owner?.user.username;
  const base = username ? slugFromUsername(username) : slugify(advisor.displayName);
  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = attempt === 1 ? base : `${base}_${attempt}`;

    const taken = await prisma.advisorProfile.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (taken) continue;

    try {
      // Only fill it in if it is still empty, so two requests racing to assign a slug agree on one winner.
      const claim = await prisma.advisorProfile.updateMany({
        where: { id: advisor.id, slug: null },
        data: { slug: candidate },
      });
      if (claim.count === 1) return candidate;

      const current = await prisma.advisorProfile.findUnique({ where: { id: advisor.id }, select: { slug: true } });
      if (current?.slug) return current.slug;
    } catch {
      // Someone else took this candidate a moment ago: try the next one.
    }
  }

  // Practically unreachable; the id is always unique and the profile page accepts it.
  return advisor.id;
}
