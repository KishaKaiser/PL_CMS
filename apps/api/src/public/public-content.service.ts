import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';

type PostQuery = {
  search?: string;
  categorySlug?: string;
  tagSlug?: string;
  authorId?: string;
  year?: string;
  month?: string;
};

const POST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  featuredImageUrl: true,
  publishedAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  categories: { select: { id: true, slug: true, name: true } },
  tags: { select: { id: true, slug: true, name: true } },
} as const;

const MIN_ARCHIVE_YEAR = 1970;
const MAX_ARCHIVE_YEAR = 3000;

@Injectable()
export class PublicContentService {
  constructor(private readonly prisma: PrismaService) {}

  findPublishedPages(excludeSlug?: string) {
    const now = new Date();
    return this.prisma.page.findMany({
      where: {
        ...(excludeSlug ? { slug: { not: excludeSlug } } : {}),
        publishedAt: { not: null, lte: now },
      },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        featuredImageUrl: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
  }

  async findPublishedPageBySlug(slug: string) {
    const now = new Date();
    const page = await this.prisma.page.findFirst({
      where: {
        slug,
        publishedAt: { not: null, lte: now },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        featuredImageUrl: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    if (!page) throw new NotFoundException(`Page ${slug} not found`);
    return page;
  }

  findPublishedPosts(query: PostQuery = {}) {
    return this.prisma.post.findMany({
      where: this.getPublishedPostWhere(query),
      orderBy: { publishedAt: 'desc' },
      select: POST_SELECT,
    });
  }

  async findPublishedPostBySlug(slug: string) {
    const now = new Date();
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        publishedAt: { not: null, lte: now },
      },
      select: POST_SELECT,
    });

    if (!post) throw new NotFoundException(`Post ${slug} not found`);
    return post;
  }

  async findCategories() {
    const now = new Date();
    const categories = await this.prisma.category.findMany({
      where: {
        posts: {
          some: { publishedAt: { not: null, lte: now } },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        posts: {
          where: { publishedAt: { not: null, lte: now } },
          select: { id: true },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      postCount: category.posts.length,
    }));
  }

  async findPostsByCategorySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (!category) throw new NotFoundException(`Category ${slug} not found`);

    const posts = await this.findPublishedPosts({ categorySlug: slug });
    return { category, posts };
  }

  async findTags() {
    const now = new Date();
    const tags = await this.prisma.tag.findMany({
      where: {
        posts: {
          some: { publishedAt: { not: null, lte: now } },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        posts: {
          where: { publishedAt: { not: null, lte: now } },
          select: { id: true },
        },
      },
    });

    return tags.map((tag) => ({
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
      postCount: tag.posts.length,
    }));
  }

  async findPostsByTagSlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (!tag) throw new NotFoundException(`Tag ${slug} not found`);

    const posts = await this.findPublishedPosts({ tagSlug: slug });
    return { tag, posts };
  }

  async findAuthors() {
    const now = new Date();
    const authors = await this.prisma.user.findMany({
      where: {
        posts: {
          some: { publishedAt: { not: null, lte: now } },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        posts: {
          where: { publishedAt: { not: null, lte: now } },
          select: { id: true },
        },
      },
    });

    return authors.map((author) => ({
      id: author.id,
      name: author.name,
      postCount: author.posts.length,
    }));
  }

  async findPostsByAuthorId(authorId: string) {
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, name: true },
    });
    if (!author) throw new NotFoundException(`Author ${authorId} not found`);

    const posts = await this.findPublishedPosts({ authorId });
    return { author, posts };
  }

  async findRelatedPosts(slug: string) {
    const now = new Date();
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        publishedAt: { not: null, lte: now },
      },
      select: {
        id: true,
        categories: { select: { id: true } },
        tags: { select: { id: true } },
      },
    });

    if (!post) throw new NotFoundException(`Post ${slug} not found`);

    const categoryIds = post.categories.map((category) => category.id);
    const tagIds = post.tags.map((tag) => tag.id);
    const relatedFilter: Prisma.PostWhereInput[] = [];

    if (categoryIds.length > 0) {
      relatedFilter.push({ categories: { some: { id: { in: categoryIds } } } });
    }
    if (tagIds.length > 0) {
      relatedFilter.push({ tags: { some: { id: { in: tagIds } } } });
    }

    const related = await this.prisma.post.findMany({
      where: {
        id: { not: post.id },
        publishedAt: { not: null, lte: now },
        ...(relatedFilter.length > 0 ? { OR: relatedFilter } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: POST_SELECT,
    });

    if (related.length >= 3) return related;

    const fallback = await this.prisma.post.findMany({
      where: {
        id: { notIn: [post.id, ...related.map((item) => item.id)] },
        publishedAt: { not: null, lte: now },
      },
      orderBy: { publishedAt: 'desc' },
      take: 3 - related.length,
      select: POST_SELECT,
    });

    return [...related, ...fallback];
  }

  async findArchives() {
    const now = new Date();
    const posts = await this.prisma.post.findMany({
      where: { publishedAt: { not: null, lte: now } },
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    const archiveMap = new Map<string, number>();
    for (const post of posts) {
      if (!post.publishedAt) continue;
      const year = post.publishedAt.getUTCFullYear();
      const month = post.publishedAt.getUTCMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      archiveMap.set(key, (archiveMap.get(key) ?? 0) + 1);
    }

    return Array.from(archiveMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => {
        const [year, month] = key.split('-');
        return {
          key,
          year: Number(year),
          month: Number(month),
          count,
        };
      });
  }

  private getPublishedPostWhere(query: PostQuery): Prisma.PostWhereInput {
    const now = new Date();
    const publishedAtRange = this.getPublishedAtRange(now, query.year, query.month);
    const search = query.search?.trim();

    return {
      publishedAt: publishedAtRange,
      ...(query.categorySlug ? { categories: { some: { slug: query.categorySlug } } } : {}),
      ...(query.tagSlug ? { tags: { some: { slug: query.tagSlug } } } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { excerpt: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private getPublishedAtRange(now: Date, year?: string, month?: string): Prisma.DateTimeNullableFilter {
    const parsedYear = Number.parseInt(year ?? '', 10);
    const parsedMonth = Number.parseInt(month ?? '', 10);

    if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
      return { not: null, lte: now };
    }

    if (parsedMonth < 1 || parsedMonth > 12 || parsedYear < MIN_ARCHIVE_YEAR || parsedYear > MAX_ARCHIVE_YEAR) {
      return { not: null, lte: now };
    }

    const from = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1, 0, 0, 0));
    const to = new Date(Date.UTC(parsedYear, parsedMonth, 1, 0, 0, 0));

    return {
      not: null,
      gte: from,
      lt: to,
      lte: now,
    };
  }
}
