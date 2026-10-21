import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decryptBuffer, encryptBuffer } from './document-crypto';
import { DOCUMENT_TYPES, DocumentType } from './onboarding.constants';

export interface DocumentMeta {
  id: string;
  type: string;
  source: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  supersededAt: Date | null;
}

const META_SELECT = { id: true, type: true, source: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, supersededAt: true } as const;

/** Keeps the completed onboarding forms, encrypted. Nothing here is ever served without a signed-in owner or an admin. */
@Injectable()
export class OnboardingDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private secret(): string {
    const secret = this.config.get<string>('DOCUMENT_ENCRYPTION_KEY') || this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('Documents cannot be stored securely on this server yet. Ask the site owner to set DOCUMENT_ENCRYPTION_KEY.');
    }
    return secret;
  }

  /** Stores a completed form; any earlier one of the same type is kept but marked as replaced. */
  async save(advisorId: string, type: DocumentType, source: 'ONLINE' | 'UPLOADED', fileName: string, mimeType: string, bytes: Uint8Array): Promise<DocumentMeta> {
    const data = encryptBuffer(Buffer.from(bytes), this.secret());
    return this.prisma.$transaction(async (tx) => {
      await tx.onboardingDocument.updateMany({ where: { advisorId, type, supersededAt: null }, data: { supersededAt: new Date() } });
      return tx.onboardingDocument.create({
        data: { advisorId, type, source, fileName, mimeType, sizeBytes: bytes.length, data },
        select: META_SELECT,
      });
    });
  }

  /** The current (not replaced) form of each type for an advisor. */
  async current(advisorId: string): Promise<Record<DocumentType, DocumentMeta | null>> {
    const rows = await this.prisma.onboardingDocument.findMany({ where: { advisorId, supersededAt: null }, orderBy: { createdAt: 'desc' }, select: META_SELECT });
    const result = { AGREEMENT: null, W9: null, DIRECT_DEPOSIT: null } as Record<DocumentType, DocumentMeta | null>;
    for (const type of DOCUMENT_TYPES) result[type] = rows.find((row) => row.type === type) ?? null;
    return result;
  }

  /** Every form an advisor has submitted, newest first, including replaced ones (for the admin). */
  all(advisorId: string): Promise<DocumentMeta[]> {
    return this.prisma.onboardingDocument.findMany({ where: { advisorId }, orderBy: { createdAt: 'desc' }, select: META_SELECT });
  }

  /** The decrypted file. With `advisorId` it must belong to that advisor. */
  async read(id: string, advisorId?: string): Promise<{ meta: DocumentMeta; bytes: Buffer; advisorId: string }> {
    const row = await this.prisma.onboardingDocument.findFirst({
      where: { id, ...(advisorId ? { advisorId } : {}) },
      select: { ...META_SELECT, advisorId: true, data: true },
    });
    if (!row) throw new NotFoundException('Document not found');
    const bytes = decryptBuffer(row.data, this.secret());
    if (!bytes) throw new ServiceUnavailableException('This document could not be opened: it was saved with a different encryption key.');
    const { data: _data, advisorId: owner, ...meta } = row;
    return { meta, bytes, advisorId: owner };
  }

  async remove(id: string): Promise<{ id: string; advisorId: string; type: string }> {
    const row = await this.prisma.onboardingDocument.findUnique({ where: { id }, select: { id: true, advisorId: true, type: true } });
    if (!row) throw new NotFoundException('Document not found');
    await this.prisma.onboardingDocument.delete({ where: { id } });
    return row;
  }
}
