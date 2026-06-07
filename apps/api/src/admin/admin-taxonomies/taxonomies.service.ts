import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaxonomyDto, UpdateTaxonomyDto } from './taxonomies.dto';
import { normalizeSlug } from '../admin-content/cms-content.util';

@Injectable()
export class TaxonomiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllCategories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  findAllTags() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  async createCategory(dto: CreateTaxonomyDto) {
    const name = dto.name.trim();
    const slug = normalizeSlug(dto.slug || name);
    return this.createTaxonomy('category', { name, slug });
  }

  async createTag(dto: CreateTaxonomyDto) {
    const name = dto.name.trim();
    const slug = normalizeSlug(dto.slug || name);
    return this.createTaxonomy('tag', { name, slug });
  }

  async updateCategory(id: string, dto: UpdateTaxonomyDto) {
    await this.ensureCategoryExists(id);
    return this.updateTaxonomy('category', id, dto);
  }

  async updateTag(id: string, dto: UpdateTaxonomyDto) {
    await this.ensureTagExists(id);
    return this.updateTaxonomy('tag', id, dto);
  }

  async removeCategory(id: string) {
    await this.ensureCategoryExists(id);
    return this.prisma.category.delete({ where: { id } });
  }

  async removeTag(id: string) {
    await this.ensureTagExists(id);
    return this.prisma.tag.delete({ where: { id } });
  }

  private async ensureCategoryExists(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
  }

  private async ensureTagExists(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id }, select: { id: true } });
    if (!tag) throw new NotFoundException(`Tag ${id} not found`);
  }

  private async createTaxonomy(kind: 'category' | 'tag', data: { name: string; slug: string }) {
    try {
      if (kind === 'category') {
        return await this.prisma.category.create({ data });
      }
      return await this.prisma.tag.create({ data });
    } catch {
      throw new ConflictException(`A ${kind} with that name or slug already exists`);
    }
  }

  private async updateTaxonomy(kind: 'category' | 'tag', id: string, dto: UpdateTaxonomyDto) {
    const data = {
      ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
      ...(dto.slug === undefined ? {} : { slug: normalizeSlug(dto.slug) }),
    };

    try {
      if (kind === 'category') {
        return await this.prisma.category.update({ where: { id }, data });
      }
      return await this.prisma.tag.update({ where: { id }, data });
    } catch {
      throw new ConflictException(`A ${kind} with that name or slug already exists`);
    }
  }
}
