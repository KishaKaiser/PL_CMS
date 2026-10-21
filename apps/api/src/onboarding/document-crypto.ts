import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Onboarding documents (W-9, direct deposit forms, signed agreements) hold Social Security and bank numbers, so they
 * are stored encrypted with AES-256-GCM: a copy of the database alone does not reveal them. The key comes from
 * DOCUMENT_ENCRYPTION_KEY, or failing that from this site's own JWT refresh secret, which is generated once and kept.
 * Layout of the stored bytes: 12-byte IV, 16-byte authentication tag, then the ciphertext.
 */

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(`onboarding-documents:${secret}`).digest();
}

export function encryptBuffer(plain: Buffer, secret: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

/** Returns null if the bytes were not produced with this secret, or have been changed. */
export function decryptBuffer(stored: Uint8Array, secret: string): Buffer | null {
  const blob = Buffer.from(stored);
  if (blob.length < IV_LENGTH + TAG_LENGTH + 1) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), blob.subarray(0, IV_LENGTH));
    decipher.setAuthTag(blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH));
    return Buffer.concat([decipher.update(blob.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]);
  } catch {
    return null;
  }
}
