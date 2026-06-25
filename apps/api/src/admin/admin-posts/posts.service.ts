import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  MEDIA_ASSET_SELECT,
  buildMediaAssetUrl,
  serializeMediaAsset,
} from '../admin-media/media.util';
import { downloadRemoteImageToMedia } from '../admin-media/media-import.util';
import { normalizeSlug, sanitizeCmsHtml } from '../admin-content/cms-content.util';
import { BulkActionDto, CreatePostDto, UpdatePostDto } from './posts.dto';

const POST_INCLUDE = {
  author: { select: { id: true, name: true, username: true, email: true } },
  categories: { select: { id: true, slug: true, name: true } },
  tags: { select: { id: true, slug: true, name: true } },
  featuredMedia: { select: MEDIA_ASSET_SELECT },
} as const;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    const now = new Date();
    let where: Prisma.PostWhereInput = {};

    if (status === 'published') where = { publishedAt: { lte: now, not: null } };
    else if (status === 'draft') where = { publishedAt: null };
    else if (status === 'scheduled') where = { publishedAt: { gt: now } };

    const posts = await this.prisma.post.findMany({
      where,
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
    const featuredMedia = await this.resolveFeaturedMedia(
      dto.featuredMediaId,
      dto.featuredImageUrl,
    );
    return this.prisma.post
      .create({
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
          categories: dto.categoryIds
            ? { connect: dto.categoryIds.map((id) => ({ id })) }
            : undefined,
          tags: dto.tagIds ? { connect: dto.tagIds.map((id) => ({ id })) } : undefined,
        },
        include: POST_INCLUDE,
      })
      .then((post) => this.serializePost(post));
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
      if (existing && existing.id !== id)
        throw new ConflictException(`Slug "${slug}" already exists`);
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
          metaTitle:
            dto.metaTitle === undefined ? undefined : this.normalizeMetadataField(dto.metaTitle),
          metaDescription:
            dto.metaDescription === undefined
              ? undefined
              : this.normalizeMetadataField(dto.metaDescription),
          excerpt: dto.excerpt === undefined ? undefined : dto.excerpt,
          content: dto.content === undefined ? undefined : sanitizeCmsHtml(dto.content),
          ...featuredMedia,
          publishedAt:
            dto.publishedAt === null
              ? null
              : dto.publishedAt
                ? new Date(dto.publishedAt)
                : undefined,
          authorId: dto.authorId,
          categories: dto.categoryIds
            ? { set: dto.categoryIds.map((categoryId) => ({ id: categoryId })) }
            : undefined,
          tags: dto.tagIds ? { set: dto.tagIds.map((tagId) => ({ id: tagId })) } : undefined,
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
    return this.prisma.post
      .update({
        where: { id },
        data: { publishedAt: new Date() },
        include: POST_INCLUDE,
      })
      .then((post) => this.serializePost(post));
  }

  async unpublish(id: string) {
    await this.findOne(id);
    return this.prisma.post
      .update({
        where: { id },
        data: { publishedAt: null },
        include: POST_INCLUDE,
      })
      .then((post) => this.serializePost(post));
  }

  async bulkAction(dto: BulkActionDto, _actorId: string) {
    const { action, ids } = dto;
    if (ids.length === 0) return { affected: 0 };

    if (action === 'publish') {
      const result = await this.prisma.post.updateMany({
        where: { id: { in: ids } },
        data: { publishedAt: new Date() },
      });
      return { affected: result.count };
    }

    if (action === 'unpublish') {
      const result = await this.prisma.post.updateMany({
        where: { id: { in: ids } },
        data: { publishedAt: null },
      });
      return { affected: result.count };
    }

    const result = await this.prisma.post.deleteMany({ where: { id: { in: ids } } });
    return { affected: result.count };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.post.delete({ where: { id } });
  }

  async importPosts(items: Array<Record<string, unknown>>, authorId: string) {
    const author = await this.prisma.user.findUnique({ where: { id: authorId }, select: { id: true } });
    if (!author) throw new NotFoundException(`Author ${authorId} not found`);

    const results: Array<{ title: string; status: 'created' | 'skipped'; reason?: string }> = [];
    for (const item of items) {
      const title = readString(item, ['title', 'Title', 'post_title', 'name']);
      const content = readString(item, ['content', 'Content', 'post_content', 'description']) ?? '';
      if (!title || !content) {
        results.push({ title: title || 'Untitled post', status: 'skipped', reason: 'Missing title or content' });
        continue;
      }

      const baseSlug = normalizeSlug(readString(item, ['slug', 'post_name', 'Slug']) ?? title);
      const slug = await this.nextAvailableSlug(baseSlug);
      const categoryIds = await this.resolveTaxonomyIds('category', readList(item, ['categories', 'Categories', 'category']));
      const tagIds = await this.resolveTaxonomyIds('tag', readList(item, ['tags', 'Tags', 'post_tags', 'tag']));
      const status = readString(item, ['status', 'post_status', 'Status'])?.toLowerCase();
      const dateValue = readString(item, ['publishedAt', 'post_date', 'post_date_gmt', 'Date']);
      const remoteImageUrl = firstImageUrl(readString(item, ['featuredImageUrl', 'featured_image', 'image', 'Image', 'attachment_url']));
      const downloadedMedia = await downloadRemoteImageToMedia(this.prisma, remoteImageUrl, title);

      await this.prisma.post.create({
        data: {
          slug,
          title,
          metaTitle: this.normalizeMetadataField(readString(item, ['metaTitle', 'Meta title', 'yoast_wpseo_title'])),
          metaDescription: this.normalizeMetadataField(readString(item, ['metaDescription', 'Meta description', 'yoast_wpseo_metadesc'])),
          excerpt: readString(item, ['excerpt', 'post_excerpt', 'Excerpt']) ?? null,
          content: sanitizeCmsHtml(content),
          featuredImageUrl: downloadedMedia?.url ?? remoteImageUrl,
          featuredMediaId: downloadedMedia?.id ?? null,
          authorId,
          publishedAt: status === 'draft' || status === 'pending' ? null : parseDateOrNull(dateValue) ?? new Date(),
          categories: categoryIds.length > 0 ? { connect: categoryIds.map((id) => ({ id })) } : undefined,
          tags: tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : undefined,
        },
        include: POST_INCLUDE,
      });
      results.push({ title, status: 'created' });
    }

    return {
      created: results.filter((result) => result.status === 'created').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      results,
    };
  }

  private async nextAvailableSlug(baseSlug: string) {
    const fallback = baseSlug || 'imported-post';
    let candidate = fallback;
    let suffix = 2;
    while (await this.prisma.post.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${fallback}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private async resolveTaxonomyIds(kind: TaxonomyKind, names: string[]) {
    const ids: string[] = [];
    for (const name of names) {
      const slug = normalizeSlug(name);
      if (!slug) continue;
      const record =
        kind === 'category'
          ? await this.prisma.category.upsert({
              where: { slug },
              update: {},
              create: { slug, name },
              select: { id: true },
            })
          : await this.prisma.tag.upsert({
              where: { slug },
              update: {},
              create: { slug, name },
              select: { id: true },
            });
      ids.push(record.id);
    }
    return ids;
  }

  private async resolveFeaturedMedia(
    featuredMediaId?: string | null,
    featuredImageUrl?: string | null,
  ) {
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

  private serializePost(
    post: {
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
    } & Record<string, unknown>,
  ) {
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

type TaxonomyKind = 'category' | 'tag';

function readString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function readList(item: Record<string, unknown>, keys: string[]) {
  const value = readString(item, keys);
  if (!value) return [];
  return value.split(/[|,>]/).map((entry) => entry.trim()).filter(Boolean);
}

function parseDateOrNull(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstImageUrl(value: string | null) {
  if (!value) return null;
  return value.split(/[|,\s]+/).find((entry) => /^https?:\/\//i.test(entry)) ?? null;
}
