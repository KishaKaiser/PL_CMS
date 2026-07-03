import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVariantDto, UpdateVariantDto, UpdateInventoryDto } from './variants.dto';

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  findByProduct(productId: string) {
    return this.prisma.productVariant.findMany({
      where: { productId },
      include: { inventory: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!variant) throw new NotFoundException(`Variant ${id} not found`);
    return variant;
  }

  async create(productId: string, dto: CreateVariantDto) {
    // Ensure the product exists
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException(`Product ${productId} not found`);

    return this.prisma.productVariant.create({
      data: {
        productId,
        color: dto.color.trim(),
        sku: await this.resolveSku(productId, dto.sku, dto.color),
        priceOverride: dto.priceOverride ?? null,
        imageUrl: dto.imageUrl ?? null,
        isActive: dto.isActive ?? true,
        inventory: {
          create: { onHand: 0, reserved: 0 },
        },
      },
      include: { inventory: true },
    });
  }

  async update(productId: string, id: string, dto: UpdateVariantDto) {
    const variant = await this.findOne(id);
    if (variant.productId !== productId) {
      throw new NotFoundException(`Variant ${id} not found for product ${productId}`);
    }
    return this.prisma.productVariant.update({
      where: { id },
      data: {
        color: dto.color?.trim(),
        sku: dto.sku === undefined ? undefined : await this.resolveSku(productId, dto.sku, dto.color ?? variant.color, id),
        priceOverride: dto.priceOverride,
        imageUrl: dto.imageUrl,
        isActive: dto.isActive,
      },
      include: { inventory: true },
    });
  }

  async remove(productId: string, id: string) {
    const variant = await this.findOne(id);
    if (variant.productId !== productId) {
      throw new NotFoundException(`Variant ${id} not found for product ${productId}`);
    }
    return this.prisma.productVariant.delete({ where: { id } });
  }

  async updateInventory(variantId: string, dto: UpdateInventoryDto) {
    await this.findOne(variantId);
    return this.prisma.inventory.upsert({
      where: { variantId },
      update: {
        onHand: dto.onHand,
        reserved: dto.reserved ?? 0,
      },
      create: {
        variantId,
        onHand: dto.onHand,
        reserved: dto.reserved ?? 0,
      },
    });
  }

  private async resolveSku(productId: string, sku: string | undefined, color: string, currentVariantId?: string) {
    const normalized = sku?.trim();
    if (normalized) {
      const existing = await this.prisma.productVariant.findUnique({ where: { sku: normalized }, select: { id: true } });
      if (existing && existing.id !== currentVariantId) throw new BadRequestException(`Variant SKU "${normalized}" already exists.`);
      return normalized;
    }
    const colorSlug = color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'variant';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `${productId.slice(-6).toUpperCase()}-${colorSlug.toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const existing = await this.prisma.productVariant.findUnique({ where: { sku: candidate }, select: { id: true } });
      if (!existing || existing.id === currentVariantId) return candidate;
    }
    return `${productId.slice(-6).toUpperCase()}-${randomUUID().slice(0, 10).toUpperCase()}`;
  }
}
