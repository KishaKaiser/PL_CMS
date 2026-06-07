import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
        publishedAt: true,
        updatedAt: true,
      },
    });

    if (!page) throw new NotFoundException(`Page ${slug} not found`);
    return page;
  }

  findPublishedPosts() {
    const now = new Date();
    return this.prisma.post.findMany({
      where: {
        publishedAt: { not: null, lte: now },
      },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
      },
    });
  }

  async findPublishedPostBySlug(slug: string) {
    const now = new Date();
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        publishedAt: { not: null, lte: now },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
      },
    });

    if (!post) throw new NotFoundException(`Post ${slug} not found`);
    return post;
  }
}
