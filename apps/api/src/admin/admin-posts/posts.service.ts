import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './posts.dto';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.post.findMany({ orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, name: true, email: true } } } });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id }, include: { author: { select: { id: true, name: true, email: true } } } });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return post;
  }

  async create(dto: CreatePostDto) {
    const existing = await this.prisma.post.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" already exists`);
    return this.prisma.post.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        excerpt: dto.excerpt,
        content: dto.content,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
        authorId: dto.authorId,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async update(id: string, dto: UpdatePostDto) {
    await this.findOne(id);
    if (dto.slug) {
      const existing = await this.prisma.post.findUnique({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) throw new ConflictException(`Slug "${dto.slug}" already exists`);
    }
    return this.prisma.post.update({
      where: { id },
      data: {
        ...dto,
        publishedAt: dto.publishedAt === null ? null : dto.publishedAt ? new Date(dto.publishedAt) : undefined,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.prisma.post.update({ where: { id }, data: { publishedAt: new Date() }, include: { author: { select: { id: true, name: true, email: true } } } });
  }

  async unpublish(id: string) {
    await this.findOne(id);
    return this.prisma.post.update({ where: { id }, data: { publishedAt: null }, include: { author: { select: { id: true, name: true, email: true } } } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.post.delete({ where: { id } });
  }
}
