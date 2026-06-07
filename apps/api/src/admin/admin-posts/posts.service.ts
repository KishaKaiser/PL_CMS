import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './posts.dto';
import { normalizeSlug, sanitizeCmsHtml } from '../admin-content/cms-content.util';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.post.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return post;
  }

  async create(dto: CreatePostDto) {
    const slug = normalizeSlug(dto.slug);
    const existing = await this.prisma.post.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Slug "${slug}" already exists`);
    return this.prisma.post.create({
      data: {
        slug,
        title: dto.title,
        excerpt: dto.excerpt ?? null,
        content: sanitizeCmsHtml(dto.content),
        featuredImageUrl: dto.featuredImageUrl ?? null,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        authorId: dto.authorId,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async update(id: string, dto: UpdatePostDto) {
    await this.findOne(id);
    const slug = dto.slug ? normalizeSlug(dto.slug) : undefined;
    if (slug) {
      const existing = await this.prisma.post.findUnique({ where: { slug } });
      if (existing && existing.id !== id) throw new ConflictException(`Slug "${slug}" already exists`);
    }
    return this.prisma.post.update({
      where: { id },
      data: {
        slug,
        title: dto.title,
        excerpt: dto.excerpt === undefined ? undefined : dto.excerpt,
        content: dto.content === undefined ? undefined : sanitizeCmsHtml(dto.content),
        featuredImageUrl: dto.featuredImageUrl === undefined ? undefined : dto.featuredImageUrl,
        publishedAt: dto.publishedAt === null ? null : dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        authorId: dto.authorId,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.prisma.post.update({
      where: { id },
      data: { publishedAt: new Date() },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async unpublish(id: string) {
    await this.findOne(id);
    return this.prisma.post.update({
      where: { id },
      data: { publishedAt: null },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.post.delete({ where: { id } });
  }
}
