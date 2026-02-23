import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePageDto, UpdatePageDto } from './pages.dto';

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.page.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) throw new NotFoundException(`Page ${id} not found`);
    return page;
  }

  async create(dto: CreatePageDto) {
    const existing = await this.prisma.page.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" already exists`);
    return this.prisma.page.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        content: dto.content,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      },
    });
  }

  async update(id: string, dto: UpdatePageDto) {
    await this.findOne(id);
    if (dto.slug) {
      const existing = await this.prisma.page.findUnique({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) throw new ConflictException(`Slug "${dto.slug}" already exists`);
    }
    return this.prisma.page.update({
      where: { id },
      data: {
        ...dto,
        publishedAt: dto.publishedAt === null ? null : dto.publishedAt ? new Date(dto.publishedAt) : undefined,
      },
    });
  }

  async publish(id: string) {
    await this.findOne(id);
    return this.prisma.page.update({ where: { id }, data: { publishedAt: new Date() } });
  }

  async unpublish(id: string) {
    await this.findOne(id);
    return this.prisma.page.update({ where: { id }, data: { publishedAt: null } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.page.delete({ where: { id } });
  }
}
