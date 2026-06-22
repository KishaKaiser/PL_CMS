import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, CreateProductReviewDto, UpdateProductDto } from './products.dto';
import { sanitizeCmsHtml } from '../admin/admin-content/cms-content.util';
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
