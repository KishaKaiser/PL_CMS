import type { PrismaService } from '../prisma/prisma.service';

/** The least time a client must have talked with an advisor before they can review them. */
export const MIN_REVIEW_TALK_SECONDS = 120;
/** Clients who have been given free or promotional minutes must also have paid for at least this many minutes with the advisor. */
export const MIN_REVIEW_PAID_MINUTES = 2;

export type ReviewBlock = 'not-spoken' | 'too-short' | 'needs-paid';

export interface ReviewAccess {
  eligible: boolean;
  /** Why not, when not eligible. */
  reason: ReviewBlock | null;
  message: string | null;
  talkedSeconds: number;
  paidMinutes: number;
  /** Whether free or promotional minutes were ever given to this client, which is what makes paid minutes count. */
  receivedFreeMinutes: boolean;
}

const MESSAGES: Record<ReviewBlock, string> = {
  'not-spoken': 'You can leave a review once you have spoken with this advisor.',
  'too-short': 'You can leave a review once you have talked with this advisor for at least 2 minutes.',
  'needs-paid':
    'Free and promotional minutes do not count toward a review. You can leave a review after you have spent at least 2 paid minutes with this advisor.',
};

/**
 * Whether a client may review an advisor.
 *
 *  - Everyone: at least two minutes of talk time with the advisor, over all their calls together.
 *  - A client who has ever been given free or promotional minutes: also at least two minutes paid from their wallet with
 *    that advisor. Minutes covered by free or promotional minutes do not count, so a promotion cannot be used to leave reviews.
 */
export async function reviewAccess(prisma: PrismaService, userId: string, advisorId: string): Promise<ReviewAccess> {
  const client = await prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } });
  const none = { talkedSeconds: 0, paidMinutes: 0, receivedFreeMinutes: false };
  if (!client) return { eligible: false, reason: 'not-spoken', message: MESSAGES['not-spoken'], ...none };

  const [connected, talk, paid, freeGrants] = await Promise.all([
    prisma.callSession.count({ where: { clientId: client.id, advisorId, connectedAt: { not: null } } }),
    prisma.callSession.aggregate({
      _sum: { durationSeconds: true },
      where: { clientId: client.id, advisorId, connectedAt: { not: null } },
    }),
    // Only minutes charged to the wallet: a minute covered by a free or promotional minute is recorded with no amount.
    prisma.walletTransaction.count({
      where: { type: 'DEBIT', amount: { gt: 0 }, callSession: { clientId: client.id, advisorId } },
    }),
    prisma.freeMinuteGrant.count({ where: { clientId: client.id } }),
  ]);

  const talkedSeconds = talk._sum.durationSeconds ?? 0;
  const receivedFreeMinutes = freeGrants > 0;
  const facts = { talkedSeconds, paidMinutes: paid, receivedFreeMinutes };

  let reason: ReviewBlock | null = null;
  if (connected === 0) reason = 'not-spoken';
  else if (talkedSeconds < MIN_REVIEW_TALK_SECONDS) reason = 'too-short';
  else if (receivedFreeMinutes && paid < MIN_REVIEW_PAID_MINUTES) reason = 'needs-paid';

  return reason ? { eligible: false, reason, message: MESSAGES[reason], ...facts } : { eligible: true, reason: null, message: null, ...facts };
}
