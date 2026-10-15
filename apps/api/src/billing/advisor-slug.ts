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

/**
 * The advisor's profile slug, assigning a unique one from their display name the first time it is needed.
 * Once assigned it never changes, so links people have shared keep working if the advisor renames themselves.
 */
export async function ensureAdvisorSlug(
  prisma: PrismaService,
  advisor: { id: string; displayName: string; slug: string | null },
): Promise<string> {
  if (advisor.slug) return advisor.slug;

  const base = slugify(advisor.displayName);
  for (let attempt = 1; attempt <= 50; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;

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

/** "Jane Q Smith" becomes "Jane S.": reviews show a first name and last initial, not a full name. */
export function publicReviewerName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A client';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}
