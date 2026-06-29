import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CartRecoverySettingsDto,
  FreeShippingSettingsDto,
  StoreCouponDto,
  StoreEmailTemplateDto,
  TrackCartDto,
} from './store.dto';

const COUPONS_KEY = 'store_coupons';
const FREE_SHIPPING_KEY = 'store_free_shipping';
const CART_RECOVERY_KEY = 'store_cart_recovery_settings';
const CART_RECOVERY_RECORDS_KEY = 'store_cart_recovery_records';
const STORE_EMAILS_KEY = 'store_email_templates';

export interface StoreCoupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  amount: number;
  minimumSubtotal: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidation {
  valid: boolean;
  code: string;
  discountAmount: number;
  message: string;
}

const DEFAULT_FREE_SHIPPING: FreeShippingSettingsDto = {
  enabled: false,
  minimumSubtotal: 75,
  label: 'Free shipping',
};

const DEFAULT_CART_RECOVERY: CartRecoverySettingsDto = {
  enabled: false,
  delayMinutes: 60,
  expiresDays: 7,
};

const DEFAULT_EMAILS: StoreEmailTemplateDto[] = [
  {
    key: 'order_confirmation',
    subject: 'Your order has been received',
    body: 'Hi {{customerName}}, your order {{orderId}} has been received.',
    enabled: true,
  },
  {
    key: 'order_shipped',
    subject: 'Your order has shipped',
    body: 'Hi {{customerName}}, your order {{orderId}} has shipped. Tracking: {{trackingNumber}}',
    enabled: true,
  },
  {
    key: 'cart_recovery',
    subject: 'You left something in your cart',
    body: 'Your cart is waiting for you. Complete your order here: {{cartUrl}}',
    enabled: false,
  },
];

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  async listCoupons() {
    return this.readJson<StoreCoupon[]>(COUPONS_KEY, []);
  }

  async saveCoupon(dto: StoreCouponDto) {
    const coupons = await this.listCoupons();
    const now = new Date().toISOString();
    const code = normalizeCode(dto.code);
    if (!code) throw new BadRequestException('Coupon code is required.');

    const next: StoreCoupon = {
      id: dto.id || randomUUID(),
      code,
      type: dto.type,
      amount: Number(dto.amount),
      minimumSubtotal: Number(dto.minimumSubtotal ?? 0),
      startsAt: dto.startsAt || '',
      endsAt: dto.endsAt || '',
      enabled: dto.enabled,
      createdAt: coupons.find((coupon) => coupon.id === dto.id)?.createdAt ?? now,
      updatedAt: now,
    };

    const duplicate = coupons.find((coupon) => coupon.code === code && coupon.id !== next.id);
    if (duplicate) throw new BadRequestException(`Coupon ${code} already exists.`);

    const updated = [next, ...coupons.filter((coupon) => coupon.id !== next.id)];
    await this.writeJson(COUPONS_KEY, updated);
    return next;
  }

  async deleteCoupon(id: string) {
    const coupons = await this.listCoupons();
    const next = coupons.filter((coupon) => coupon.id !== id);
    if (next.length === coupons.length) throw new NotFoundException('Coupon not found.');
    await this.writeJson(COUPONS_KEY, next);
    return { success: true };
  }

  async validateCoupon(code: string, subtotal: number): Promise<CouponValidation> {
    const normalized = normalizeCode(code);
    const coupon = (await this.listCoupons()).find((item) => item.code === normalized);
    if (!coupon || !coupon.enabled) return { valid: false, code: normalized, discountAmount: 0, message: 'Coupon is not valid.' };

    const now = Date.now();
    if (coupon.startsAt && Date.parse(coupon.startsAt) > now) {
      return { valid: false, code: normalized, discountAmount: 0, message: 'Coupon is not active yet.' };
    }
    if (coupon.endsAt && Date.parse(coupon.endsAt) < now) {
      return { valid: false, code: normalized, discountAmount: 0, message: 'Coupon has expired.' };
    }
    if (subtotal < coupon.minimumSubtotal) {
      return { valid: false, code: normalized, discountAmount: 0, message: `Minimum subtotal is $${coupon.minimumSubtotal.toFixed(2)}.` };
    }

    const discount = coupon.type === 'percent' ? subtotal * (coupon.amount / 100) : coupon.amount;
    const discountAmount = Math.max(0, Math.min(subtotal, roundCurrency(discount)));
    return { valid: true, code: normalized, discountAmount, message: `Coupon ${normalized} applied.` };
  }

  async getFreeShippingSettings() {
    return this.readJson<FreeShippingSettingsDto>(FREE_SHIPPING_KEY, DEFAULT_FREE_SHIPPING);
  }

  async saveFreeShippingSettings(dto: FreeShippingSettingsDto) {
    const next = {
      enabled: Boolean(dto.enabled),
      minimumSubtotal: Number(dto.minimumSubtotal ?? 0),
      label: dto.label || DEFAULT_FREE_SHIPPING.label,
    };
    await this.writeJson(FREE_SHIPPING_KEY, next);
    return next;
  }

  async getCartRecoverySettings() {
    return this.readJson<CartRecoverySettingsDto>(CART_RECOVERY_KEY, DEFAULT_CART_RECOVERY);
  }

  async saveCartRecoverySettings(dto: CartRecoverySettingsDto) {
    const next = {
      enabled: Boolean(dto.enabled),
      delayMinutes: Number(dto.delayMinutes),
      expiresDays: Number(dto.expiresDays),
    };
    await this.writeJson(CART_RECOVERY_KEY, next);
    return next;
  }

  async listRecoveredCarts() {
    return this.readJson<unknown[]>(CART_RECOVERY_RECORDS_KEY, []);
  }

  async trackCart(dto: TrackCartDto) {
    const settings = await this.getCartRecoverySettings();
    if (!settings.enabled || dto.items.length === 0) return { success: true, stored: false };
    const records = await this.listRecoveredCarts();
    const now = new Date();
    const record = {
      id: randomUUID(),
      email: dto.email || '',
      subtotal: roundCurrency(dto.subtotal),
      items: dto.items,
      status: 'OPEN',
      recoverAfter: new Date(now.getTime() + settings.delayMinutes * 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + settings.expiresDays * 24 * 60 * 60_000).toISOString(),
      createdAt: now.toISOString(),
    };
    await this.writeJson(CART_RECOVERY_RECORDS_KEY, [record, ...records].slice(0, 500));
    return { success: true, stored: true };
  }

  async getEmailTemplates() {
    return this.readJson<StoreEmailTemplateDto[]>(STORE_EMAILS_KEY, DEFAULT_EMAILS);
  }

  async saveEmailTemplates(templates: StoreEmailTemplateDto[]) {
    await this.writeJson(STORE_EMAILS_KEY, templates);
    return templates;
  }

  private async readJson<T>(key: string, fallback: T): Promise<T> {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) return fallback;
    try {
      return JSON.parse(setting.value) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(key: string, value: unknown) {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: { value: JSON.stringify(value) },
    });
  }
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
