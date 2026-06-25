import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, CreateProductReviewDto, UpdateProductDto } from './products.dto';
import { normalizeSlug, sanitizeCmsHtml } from '../admin/admin-content/cms-content.util';
import { serializeMediaAsset } from '../admin/admin-media/media.util';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: productInclude,
    }).then((products) => products.map(serializeProduct));
  }

  async findActive() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: activeProductInclude,
    });
    return products.map((product) => applyEffectiveSalePrice(serializeProduct(product)));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return applyEffectiveSalePrice(serializeProduct(product));
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: createProductData(dto),
      include: productInclude,
    }).then(serializeProduct);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: updateProductData(dto),
      include: productInclude,
    }).then(serializeProduct);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }

  async importProducts(items: Array<Record<string, unknown>>) {
    const results: Array<{ name: string; status: 'created' | 'skipped'; reason?: string }> = [];

    for (const item of items) {
      const name = readString(item, ['name', 'Name', 'post_title', 'Title', 'product_name']);
      const price = readNumber(item, ['regularPrice', 'regular_price', 'Regular price', 'price', 'Price']);
      if (!name || price == null) {
        results.push({ name: name || 'Untitled product', status: 'skipped', reason: 'Missing name or price' });
        continue;
      }

      const categoryIds = await this.resolveTaxonomyIds('category', readList(item, ['categories', 'Categories', 'category']));
      const tagIds = await this.resolveTaxonomyIds('tag', readList(item, ['tags', 'Tags', 'tag']));
      const salePrice = readNumber(item, ['salePrice', 'sale_price', 'Sale price']);
      const stockQuantity = readNumber(item, ['stockQuantity', 'stock_quantity', 'Stock', 'stock', 'inventory', 'Inventory']);

      await this.prisma.product.create({
        data: createProductData({
          name,
          description: readString(item, ['description', 'Description', 'post_content', 'Content']) ?? undefined,
          shortDescription: readString(item, ['shortDescription', 'short_description', 'Short description', 'post_excerpt', 'Excerpt']) ?? undefined,
          price,
          regularPrice: price,
          salePrice,
          saleStartsAt: readString(item, ['saleStartsAt', 'sale_price_dates_from']) ?? null,
          saleEndsAt: readString(item, ['saleEndsAt', 'sale_price_dates_to']) ?? null,
          currency: readString(item, ['currency', 'Currency']) ?? 'USD',
          minutesPack: readNumber(item, ['minutesPack', 'minutes_pack']) ?? 0,
          isActive: readBoolean(item, ['isActive', 'published', 'Published', 'post_status'], true),
          weightOz: readNumber(item, ['weightOz', 'weight', 'Weight']) ?? null,
          lengthIn: readNumber(item, ['lengthIn', 'length', 'Length']) ?? null,
          widthIn: readNumber(item, ['widthIn', 'width', 'Width']) ?? null,
          heightIn: readNumber(item, ['heightIn', 'height', 'Height']) ?? null,
          trackStock: readBoolean(item, ['trackStock', 'manage_stock', 'Manage stock'], stockQuantity != null && stockQuantity > 0),
          stockQuantity: Math.max(0, Math.trunc(stockQuantity ?? 0)),
          stockStatus: normalizeStockStatus(readString(item, ['stockStatus', 'stock_status', 'Stock status'])),
          imageUrl: readString(item, ['imageUrl', 'images', 'Images', 'featuredImageUrl']) ?? null,
          categoryIds,
          tagIds,
        }),
      });
      results.push({ name, status: 'created' });
    }

    return {
      created: results.filter((result) => result.status === 'created').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      results,
    };
  }

  async listReviews(productId: string) {
    await this.findOne(productId);
    return this.prisma.productReview.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: reviewSelect,
    });
  }

  async createReview(productId: string, userId: string, dto: CreateProductReviewDto) {
    await this.findOne(productId);
    const purchased = await this.prisma.order.findFirst({
      where: {
        userId,
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED'] },
        items: { some: { productId } },
      },
      select: { id: true },
    });
    if (!purchased) {
      throw new ForbiddenException('Only customers who purchased this product can leave a review.');
    }

    return this.prisma.productReview.upsert({
      where: { productId_userId: { productId, userId } },
      create: {
        productId,
        userId,
        rating: dto.rating,
        comment: normalizeComment(dto.comment),
      },
      update: {
        rating: dto.rating,
        comment: normalizeComment(dto.comment),
      },
      select: reviewSelect,
    });
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
}

const productInclude = {
  variants: { include: { inventory: true }, orderBy: { createdAt: 'asc' as const } },
  featuredMedia: true,
  categories: { orderBy: { name: 'asc' as const } },
  tags: { orderBy: { name: 'asc' as const } },
};

const activeProductInclude = {
  ...productInclude,
  variants: {
    where: { isActive: true },
    include: { inventory: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

const reviewSelect = {
  id: true,
  rating: true,
  comment: true,
  createdAt: true,
  user: { select: { id: true, username: true, name: true } },
} as const;

function createProductData(dto: CreateProductDto): Prisma.ProductCreateInput {
  const regularPrice = dto.regularPrice ?? dto.price;
  return {
    name: dto.name,
    description: dto.description ? sanitizeCmsHtml(dto.description) : null,
    shortDescription: dto.shortDescription ?? null,
    price: dto.price,
    regularPrice,
    salePrice: dto.salePrice ?? null,
    saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : null,
    saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : null,
    currency: dto.currency ?? 'USD',
    minutesPack: dto.minutesPack,
    isActive: dto.isActive ?? true,
    weightOz: dto.weightOz ?? null,
    lengthIn: dto.lengthIn ?? null,
    widthIn: dto.widthIn ?? null,
    heightIn: dto.heightIn ?? null,
    trackStock: dto.trackStock ?? false,
    stockQuantity: dto.stockQuantity ?? 0,
    stockStatus: dto.stockStatus ?? 'IN_STOCK',
    imageUrl: dto.imageUrl ?? null,
    featuredMedia: dto.featuredMediaId
      ? { connect: { id: dto.featuredMediaId } }
      : undefined,
    categories: dto.categoryIds ? { connect: dto.categoryIds.map((id) => ({ id })) } : undefined,
    tags: dto.tagIds ? { connect: dto.tagIds.map((id) => ({ id })) } : undefined,
  };
}

function updateProductData(dto: UpdateProductDto): Prisma.ProductUpdateInput {
  return {
    ...(dto.name !== undefined ? { name: dto.name } : {}),
    ...(dto.description !== undefined ? { description: dto.description ? sanitizeCmsHtml(dto.description) : null } : {}),
    ...(dto.shortDescription !== undefined ? { shortDescription: dto.shortDescription || null } : {}),
    ...(dto.price !== undefined ? { price: dto.price } : {}),
    ...(dto.regularPrice !== undefined ? { regularPrice: dto.regularPrice } : {}),
    ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
    ...(dto.saleStartsAt !== undefined
      ? { saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : null }
      : {}),
    ...(dto.saleEndsAt !== undefined
      ? { saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : null }
      : {}),
    ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
    ...(dto.minutesPack !== undefined ? { minutesPack: dto.minutesPack } : {}),
    ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    ...(dto.weightOz !== undefined ? { weightOz: dto.weightOz } : {}),
    ...(dto.lengthIn !== undefined ? { lengthIn: dto.lengthIn } : {}),
    ...(dto.widthIn !== undefined ? { widthIn: dto.widthIn } : {}),
    ...(dto.heightIn !== undefined ? { heightIn: dto.heightIn } : {}),
    ...(dto.trackStock !== undefined ? { trackStock: dto.trackStock } : {}),
    ...(dto.stockQuantity !== undefined ? { stockQuantity: dto.stockQuantity } : {}),
    ...(dto.stockStatus !== undefined ? { stockStatus: dto.stockStatus } : {}),
    ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl || null } : {}),
    ...(dto.featuredMediaId !== undefined
      ? {
          featuredMedia: dto.featuredMediaId
            ? { connect: { id: dto.featuredMediaId } }
            : { disconnect: true },
        }
      : {}),
    ...(dto.categoryIds !== undefined
      ? { categories: { set: dto.categoryIds.map((id) => ({ id })) } }
      : {}),
    ...(dto.tagIds !== undefined ? { tags: { set: dto.tagIds.map((id) => ({ id })) } } : {}),
  };
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

function readNumber(item: Record<string, unknown>, keys: string[]) {
  const value = readString(item, keys);
  if (value == null) return null;
  const normalized = value.replace(/[$,]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function readBoolean(item: Record<string, unknown>, keys: string[], fallback = false) {
  const value = readString(item, keys);
  if (value == null) return fallback;
  return ['1', 'yes', 'true', 'publish', 'published', 'instock', 'in_stock'].includes(value.toLowerCase());
}

function readList(item: Record<string, unknown>, keys: string[]) {
  const value = readString(item, keys);
  if (!value) return [];
  return value.split(/[|,>]/).map((entry) => entry.trim()).filter(Boolean);
}

function normalizeStockStatus(value: string | null) {
  const normalized = value?.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  if (normalized === 'outofstock' || normalized === 'out_of_stock') return 'OUT_OF_STOCK';
  if (normalized === 'onbackorder' || normalized === 'backorder' || normalized === 'backorders_allowed') return 'BACKORDER';
  return 'IN_STOCK';
}

function applyEffectiveSalePrice<
  T extends {
    price: unknown;
    salePrice: unknown | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
  },
>(product: T) {
  const now = new Date();
  const startsOk = !product.saleStartsAt || product.saleStartsAt <= now;
  const endsOk = !product.saleEndsAt || product.saleEndsAt >= now;
  if (product.salePrice != null && startsOk && endsOk) {
    return { ...product, price: product.salePrice };
  }
  return product;
}

function normalizeComment(value?: string) {
  const comment = value?.trim();
  return comment || null;
}

function serializeProduct<
  T extends {
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
  },
>(product: T) {
  return {
    ...product,
    featuredMedia: product.featuredMedia ? serializeMediaAsset(product.featuredMedia) : null,
  };
}
