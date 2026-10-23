import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { open, unlink } from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import { ListMediaDto, UploadMediaDto } from './media.dto';
import {
  MAX_MEDIA_FILE_SIZE,
  deriveMediaTitle,
  isImageMimeType,
  isPdfMimeType,
  resolveMediaStoragePath,
  serializeMediaAsset,
} from './media.util';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListMediaDto) {
    const search = dto.search?.trim();
    const assets = await this.prisma.mediaAsset.findMany({
      where: search
        ? {
            OR: [
              { originalName: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              { altText: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return assets.map((asset) => serializeMediaAsset(asset));
  }

  async findOne(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException(`Media asset ${id} not found`);
    return asset;
  }

  async create(file: Express.Multer.File | undefined, dto: UploadMediaDto) {
    if (!file) throw new BadRequestException('Choose a media file to upload.');

    // The upload is already on disk by now, so a file that is turned away is removed again.
    if (isImageMimeType(file.mimetype) && file.size > MAX_MEDIA_FILE_SIZE) {
      await discardUpload(file);
      throw new BadRequestException('Images can be up to 8 MB. PDFs can be up to 25 MB.');
    }
    if (isPdfMimeType(file.mimetype) && !(await looksLikePdf(file.path))) {
      await discardUpload(file);
      throw new BadRequestException('That file is not a valid PDF.');
    }

    const asset = await this.prisma.mediaAsset.create({
      data: {
        originalName: file.originalname,
        storageKey: file.filename,
        title: dto.title?.trim() || deriveMediaTitle(file.originalname),
        altText: dto.altText?.trim() || null,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    return serializeMediaAsset(asset);
  }

  async openFileStream(id: string) {
    const asset = await this.findOne(id);
    const filePath = resolveMediaStoragePath(asset.storageKey);
    if (!existsSync(filePath)) throw new NotFoundException(`Media file for ${id} not found`);
    return {
      asset,
      stream: createReadStream(filePath),
    };
  }

  async delete(id: string) {
    const asset = await this.findOne(id);
    const filePath = resolveMediaStoragePath(asset.storageKey);

    await this.prisma.mediaAsset.delete({ where: { id } });

    try {
      await unlink(filePath);
    } catch (error: unknown) {
      if (!isMissingFileError(error)) throw error;
    }

    return { success: true };
  }
}

/** Every PDF starts with "%PDF-". */
async function looksLikePdf(path: string) {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(5);
    await handle.read(buffer, 0, 5, 0);
    return buffer.toString('latin1') === '%PDF-';
  } finally {
    await handle.close();
  }
}

async function discardUpload(file: Express.Multer.File) {
  await unlink(file.path).catch(() => undefined);
}

function isMissingFileError(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return error.code === 'ENOENT';
}
