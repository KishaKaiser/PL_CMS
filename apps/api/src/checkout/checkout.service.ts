import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './checkout.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(userId: string, dto: CreateCheckoutDto) {
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products are invalid or inactive');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalAmount = new Decimal(0);
    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = product.price;
      totalAmount = totalAmount.add(unitPrice.mul(item.quantity));
      return { productId: item.productId, quantity: item.quantity, unitPrice };
    });

    return this.prisma.order.create({
      data: {
        userId,
        totalAmount,
        currency: 'USD',
        items: {
          create: items,
        },
      },
      include: { items: true },
    });
  }
}
