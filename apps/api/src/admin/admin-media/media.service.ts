import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import { ListMediaDto, UploadMediaDto } from './media.dto';
import {
  deriveMediaTitle,
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

function isMissingFileError(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  return error.code === 'ENOENT';
}
