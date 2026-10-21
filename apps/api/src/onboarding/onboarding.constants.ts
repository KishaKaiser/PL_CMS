import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@pl-cms/db';

export type DocumentType = 'AGREEMENT' | 'W9' | 'DIRECT_DEPOSIT';
export const DOCUMENT_TYPES: DocumentType[] = ['AGREEMENT', 'W9', 'DIRECT_DEPOSIT'];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  AGREEMENT: 'Advisor Agreement',
  W9: 'Form W-9',
  DIRECT_DEPOSIT: 'Direct Deposit Authorization',
};

/** Completed forms can be uploaded as a PDF or a photo/scan, up to this size. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** What an advisor may charge per minute while onboarding (they can change it later from their dashboard). */
export const MIN_RATE_PER_MINUTE = 0.5;
export const MAX_RATE_PER_MINUTE = 50;

/** How long the emailed onboarding link works. */
export const ONBOARDING_LINK_DAYS = 14;

/**
 * Advisors who are still working through onboarding are kept out of everything clients can see or call: this is added to
 * the queries that list or look up advisors. Advisors who joined another way have no onboarding and are always included.
 */
export const ONBOARDED_ADVISOR: Prisma.AdvisorProfileWhereInput = {
  OR: [{ onboarding: { is: null } }, { onboarding: { is: { completedAt: { not: null } } } }],
};

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as string[]).includes(value);
}

/** A new random link token; only its hash is kept in the database. */
export function newOnboardingToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ONBOARDING_LINK_DAYS * 24 * 60 * 60 * 1000) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** What an uploaded file really is, judged by its first bytes rather than by what its name or type claims. */
export function sniffFile(bytes: Uint8Array): { mimeType: string; extension: string } | null {
  const b = Buffer.from(bytes.subarray(0, 12));
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return { mimeType: 'application/pdf', extension: 'pdf' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: 'image/png', extension: 'png' };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mimeType: 'image/jpeg', extension: 'jpg' };
  return null;
}
