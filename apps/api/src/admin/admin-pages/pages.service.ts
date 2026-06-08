import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto } from './pages.dto';
import { normalizeSlug, sanitizeCmsHtml } from '../admin-content/cms-content.util';
import { MEDIA_ASSET_SELECT, buildMediaAssetUrl, serializeMediaAsset } from '../admin-media/media.util';

const PAGE_INCLUDE = {
  featuredMedia: {
    select: MEDIA_ASSET_SELECT,
  },
} as const;

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const pages = await this.prisma.page.findMany({
      orderBy: { updatedAt: 'desc' },
      include: PAGE_INCLUDE,
    });
    return pages.map((page) => this.serializePage(page));
  }

  async findOne(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      include: PAGE_INCLUDE,
    });
    if (!page) throw new NotFoundException(`Page ${id} not found`);
    return this.serializePage(page);
  }

  async create(dto: CreatePageDto) {
    const slug = normalizeSlug(dto.slug);
    const existing = await this.prisma.page.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Slug "${slug}" already exists`);
    const featuredMedia = await this.resolveFeaturedMedia(dto.featuredMediaId, dto.featuredImageUrl);
    return this.prisma.page.create({
      data: {
        slug,
        title: dto.title,
        content: sanitizeCmsHtml(dto.content),
        ...featuredMedia,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      },
      include: PAGE_INCLUDE,
    }).then((page) => this.serializePage(page));
  }

  private async resolveFeaturedMedia(featuredMediaId?: string | null, featuredImageUrl?: string | null) {
    if (featuredMediaId) {
      const media = await this.prisma.mediaAsset.findUnique({ where: { id: featuredMediaId } });
      if (!media) throw new NotFoundException(`Media asset ${featuredMediaId} not found`);
      return {
        featuredMediaId: media.id,
        featuredImageUrl: buildMediaAssetUrl(media.id),
      };
    }

    return {
      featuredMediaId: null,
      featuredImageUrl: featuredImageUrl ?? null,
    };
  }

  private serializePage(page: {
    featuredMedia: {
      id: string;
      originalName: string;
      title: string;
      altText: string | null;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  } & Record<string, unknown>) {
    return {
      ...page,
      featuredMedia: page.featuredMedia ? serializeMediaAsset(page.featuredMedia) : null,
    };
  }

  async update(id: string, dto: UpdatePageDto) {
    await this.findOne(id);
    const slug = dto.slug ? normalizeSlug(dto.slug) : undefined;
    if (slug) {
      const existing = await this.prisma.page.findUnique({ where: { slug } });
      if (existing && existing.id !== id) throw new ConflictException(`Slug "${slug}" already exists`);
    }

    const featuredMedia =
      dto.featuredMediaId !== undefined || dto.featuredImageUrl !== undefined
        ? await this.resolveFeaturedMedia(dto.featuredMediaId, dto.featuredImageUrl)
        : undefined;

    return this.prisma.page
      .update({
        where: { id },
        data: {
          slug,
          title: dto.title,
          content: dto.content === undefined ? undefined : sanitizeCmsHtml(dto.content),
          ...featuredMedia,
          publishedAt: dto.publishedAt === null ? null : dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        },
        include: PAGE_INCLUDE,
      })
      .then((page) => this.serializePage(page));
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.prisma.page
      .update({
        where: { id },
        data: { publishedAt: new Date() },
        include: PAGE_INCLUDE,
      })
      .then((page) => this.serializePage(page));
  }

  async unpublish(id: string) {
    await this.findOne(id);
    return this.prisma.page
      .update({
        where: { id },
        data: { publishedAt: null },
        include: PAGE_INCLUDE,
      })
      .then((page) => this.serializePage(page));
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.page.delete({ where: { id } });
  }
}
