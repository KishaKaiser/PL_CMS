import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { ListMediaDto, UploadMediaDto } from './media.dto';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  deriveMediaTitle,
  getMediaUploadDirectory,
  serializeMediaAsset,
} from './media.util';

type UploadedMediaFile = {
  filename: string;
  originalname: string;
  mimetype: string;
  path: string;
  size: number;
};

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

  async create(file: UploadedMediaFile | undefined, dto: UploadMediaDto) {
    if (!file) throw new BadRequestException('Choose a media file to upload.');

    if (!ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype)) {
      await unlink(file.path).catch(() => undefined);
      throw new BadRequestException('Only JPG, PNG, GIF, WEBP, and PDF uploads are supported.');
    }

    mkdirSync(getMediaUploadDirectory(), { recursive: true });

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
    const filePath = join(getMediaUploadDirectory(), asset.storageKey);
    if (!existsSync(filePath)) throw new NotFoundException(`Media file for ${id} not found`);
    return {
      asset,
      stream: createReadStream(filePath),
    };
  }
}
