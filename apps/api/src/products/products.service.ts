import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: productInclude,
    });
  }

  async findActive() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: activeProductInclude,
    });
    return products.map(applyEffectiveSalePrice);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return applyEffectiveSalePrice(product);
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: createProductData(dto),
      include: productInclude,
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: updateProductData(dto),
      include: productInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
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

function createProductData(dto: CreateProductDto): Prisma.ProductCreateInput {
  const regularPrice = dto.regularPrice ?? dto.price;
  return {
    name: dto.name,
    description: dto.description,
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
    ...(dto.description !== undefined ? { description: dto.description || null } : {}),
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
