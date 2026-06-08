import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './posts.dto';
import { normalizeSlug, sanitizeCmsHtml } from '../admin-content/cms-content.util';
import { MEDIA_ASSET_SELECT, buildMediaAssetUrl, serializeMediaAsset } from '../admin-media/media.util';

const POST_INCLUDE = {
  author: { select: { id: true, name: true, email: true } },
  categories: { select: { id: true, slug: true, name: true } },
  tags: { select: { id: true, slug: true, name: true } },
  featuredMedia: { select: MEDIA_ASSET_SELECT },
} as const;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const posts = await this.prisma.post.findMany({
      orderBy: { updatedAt: 'desc' },
      include: POST_INCLUDE,
    });
    return posts.map((post) => this.serializePost(post));
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return this.serializePost(post);
  }

  async create(dto: CreatePostDto) {
    const slug = normalizeSlug(dto.slug);
    const existing = await this.prisma.post.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Slug "${slug}" already exists`);
    const featuredMedia = await this.resolveFeaturedMedia(dto.featuredMediaId, dto.featuredImageUrl);
    return this.prisma.post.create({
      data: {
        slug,
        title: dto.title,
        metaTitle: this.normalizeMetadataField(dto.metaTitle),
        metaDescription: this.normalizeMetadataField(dto.metaDescription),
        excerpt: dto.excerpt ?? null,
        content: sanitizeCmsHtml(dto.content),
        ...featuredMedia,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        authorId: dto.authorId,
        categories: dto.categoryIds ? { connect: dto.categoryIds.map((id) => ({ id })) } : undefined,
        tags: dto.tagIds ? { connect: dto.tagIds.map((id) => ({ id })) } : undefined,
      },
      include: POST_INCLUDE,
    }).then((post) => this.serializePost(post));
  }

  async update(id: string, dto: UpdatePostDto) {
    const existingPost = await this.prisma.post.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existingPost) throw new NotFoundException(`Post ${id} not found`);
    const slug = dto.slug ? normalizeSlug(dto.slug) : undefined;
    if (slug) {
      const existing = await this.prisma.post.findUnique({ where: { slug } });
      if (existing && existing.id !== id) throw new ConflictException(`Slug "${slug}" already exists`);
    }

    const featuredMedia =
      dto.featuredMediaId !== undefined || dto.featuredImageUrl !== undefined
        ? await this.resolveFeaturedMedia(dto.featuredMediaId, dto.featuredImageUrl)
        : undefined;

    const nextSlug = slug ?? existingPost.slug;

    return this.prisma.$transaction(async (tx) => {
      if (nextSlug !== existingPost.slug) {
        await tx.slugRedirect.deleteMany({
          where: {
            contentType: 'POST',
            sourceSlug: nextSlug,
          },
        });
      }

      const post = await tx.post.update({
        where: { id },
        data: {
          slug,
          title: dto.title,
          metaTitle: dto.metaTitle === undefined ? undefined : this.normalizeMetadataField(dto.metaTitle),
          metaDescription:
            dto.metaDescription === undefined ? undefined : this.normalizeMetadataField(dto.metaDescription),
          excerpt: dto.excerpt === undefined ? undefined : dto.excerpt,
          content: dto.content === undefined ? undefined : sanitizeCmsHtml(dto.content),
          ...featuredMedia,
          publishedAt: dto.publishedAt === null ? null : dto.publishedAt ? new Date(dto.publishedAt) : undefined,
          authorId: dto.authorId,
          categories: dto.categoryIds ? { set: dto.categoryIds.map((entryId) => ({ id: entryId })) } : undefined,
          tags: dto.tagIds ? { set: dto.tagIds.map((entryId) => ({ id: entryId })) } : undefined,
        },
        include: POST_INCLUDE,
      });

      if (nextSlug !== existingPost.slug) {
        await tx.slugRedirect.upsert({
          where: {
            contentType_sourceSlug: {
              contentType: 'POST',
              sourceSlug: existingPost.slug,
            },
          },
          update: {
            targetSlug: nextSlug,
          },
          create: {
            contentType: 'POST',
            sourceSlug: existingPost.slug,
            targetSlug: nextSlug,
          },
        });

        await tx.slugRedirect.updateMany({
          where: {
            contentType: 'POST',
            targetSlug: existingPost.slug,
            sourceSlug: { not: existingPost.slug },
          },
          data: {
            targetSlug: nextSlug,
          },
        });
      }

      return this.serializePost(post);
    });
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.prisma.post.update({
      where: { id },
      data: { publishedAt: new Date() },
      include: POST_INCLUDE,
    }).then((post) => this.serializePost(post));
  }

  async unpublish(id: string) {
    await this.findOne(id);
    return this.prisma.post.update({
      where: { id },
      data: { publishedAt: null },
      include: POST_INCLUDE,
    }).then((post) => this.serializePost(post));
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.post.delete({ where: { id } });
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

  private serializePost(post: {
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
      ...post,
      featuredMedia: post.featuredMedia ? serializeMediaAsset(post.featuredMedia) : null,
    };
  }

  private normalizeMetadataField(value?: string | null) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
  }
}
