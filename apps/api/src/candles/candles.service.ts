import { BadRequestException, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { buildMediaAssetUrl, isImageMimeType } from '../admin/admin-media/media.util';
import { uniqueProductSlug } from '../products/product-slug';
import {
  CandleSelectionDto,
  SaveCandleColorDto,
  SaveCandleHerbDto,
  SaveCandleTypeDto,
} from './candles.dto';

import { CUSTOM_PRODUCT_LISTED_SETTING_KEY, CUSTOM_PRODUCT_SETTING_KEY } from './custom-product';

/** The product that every custom candle order line points at (an order line needs a product). It is also the shop's card. */
const CUSTOM_PRODUCT_NAME = 'Custom Candle';
const CUSTOM_PRODUCT_DESCRIPTION =
  'Design your own candle: choose the candle, its color or colors, the height and herbs, and watch it change as you choose.';
/** What the product's description said when it was hidden from the shop. */
const OLD_HIDDEN_DESCRIPTION =
  'Used by the custom candle page. Each order line records what the customer chose. Please do not delete.';

export interface ResolvedCandle {
  /** The price of one candle, worked out here from what was chosen (never taken from the customer's browser). */
  unitPrice: Decimal;
  weightOz: number | null;
  /** Kept on the order line so the order still says what was chosen if the options are changed or removed later. */
  snapshot: Record<string, unknown>;
}

const money = (value: unknown) => new Decimal(String(value ?? 0));
const num = (value: unknown) => Number(value ?? 0);

@Injectable()
export class CandlesService implements OnModuleInit {
  private readonly logger = new Logger(CandlesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Puts the custom candle product in the shop, once, so it can be shown there with a "Customize Candle" button. */
  async onModuleInit() {
    try {
      const productId = await this.ensureCustomProductId();
      const listed = await this.prisma.setting.findUnique({ where: { key: CUSTOM_PRODUCT_LISTED_SETTING_KEY } });
      if (listed) return;

      const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { description: true } });
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          hiddenFromShop: false,
          ...(product?.description === OLD_HIDDEN_DESCRIPTION ? { description: CUSTOM_PRODUCT_DESCRIPTION } : {}),
        },
      });
      await this.prisma.setting.upsert({
        where: { key: CUSTOM_PRODUCT_LISTED_SETTING_KEY },
        create: { key: CUSTOM_PRODUCT_LISTED_SETTING_KEY, value: '1' },
        update: { value: '1' },
      });
    } catch (error) {
      // The shop card is a nicety: never stop the API from starting over it.
      this.logger.warn(`Could not list the custom candle product in the shop: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ── What the shop sells ────────────────────────────────────────────────────────────

  /** Everything the custom candle page needs: the candle types with their heights, the colors and the herbs. */
  async getPublicConfig() {
    const [types, colors, herbs, productId] = await Promise.all([
      this.prisma.candleType.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { sizes: { orderBy: [{ sortOrder: 'asc' }, { extraPrice: 'asc' }] }, photo: true, waxMask: true },
      }),
      this.prisma.candleColor.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.candleHerb.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.ensureCustomProductId(),
    ]);

    return {
      productId,
      types: types.map((type) => ({
        id: type.id,
        name: type.name,
        description: type.description,
        basePrice: num(type.basePrice),
        photoUrl: type.photo && isImageMimeType(type.photo.mimeType) ? buildMediaAssetUrl(type.photo.id) : null,
        waxMaskUrl: type.waxMask && isImageMimeType(type.waxMask.mimeType) ? buildMediaAssetUrl(type.waxMask.id) : null,
        allowTwoColors: type.allowTwoColors,
        twoColorExtra: num(type.twoColorExtra),
        allowHerbs: type.allowHerbs,
        waxTopPercent: type.waxTopPercent,
        weightOz: type.weightOz == null ? null : num(type.weightOz),
        sizes: type.sizes.map((size) => ({ id: size.id, label: size.label, extraPrice: num(size.extraPrice), heightPercent: size.heightPercent })),
      })),
      colors: colors.map((color) => ({ id: color.id, name: color.name, hex: color.hex })),
      herbs: herbs.map((herb) => ({ id: herb.id, name: herb.name, price: num(herb.price), hex: herb.hex })),
    };
  }

  /** The "Custom Candle" product, created the first time it is needed. */
  async ensureCustomProductId(): Promise<string> {
    const saved = await this.prisma.setting.findUnique({ where: { key: CUSTOM_PRODUCT_SETTING_KEY } });
    if (saved) {
      const existing = await this.prisma.product.findUnique({ where: { id: saved.value }, select: { id: true } });
      if (existing) return existing.id;
    }

    const product = await this.prisma.product.create({
      data: {
        name: CUSTOM_PRODUCT_NAME,
        slug: await uniqueProductSlug(this.prisma, CUSTOM_PRODUCT_NAME),
        type: 'PHYSICAL',
        description: CUSTOM_PRODUCT_DESCRIPTION,
        // The price of each order line is worked out from the customer's choices, not from here.
        price: 0,
        regularPrice: 0,
        currency: 'USD',
        isActive: true,
        // Shown in the shop with a "Customize Candle" button; the Hidden checkbox on the product still hides it.
        hiddenFromShop: false,
        stockStatus: 'IN_STOCK',
      },
      select: { id: true },
    });
    await this.prisma.setting.upsert({
      where: { key: CUSTOM_PRODUCT_SETTING_KEY },
      create: { key: CUSTOM_PRODUCT_SETTING_KEY, value: product.id },
      update: { value: product.id },
    });
    return product.id;
  }

  // ── Checking and pricing a customer's choices ──────────────────────────────────────

  /**
   * Checks a customer's choices against what is currently on offer and works out the price of one candle:
   * the type's price, plus the height, plus the two-color charge, plus each herb.
   */
  async resolveSelection(selection: CandleSelectionDto): Promise<ResolvedCandle> {
    const type = await this.prisma.candleType.findFirst({
      where: { id: selection.typeId, isActive: true },
      include: { sizes: { orderBy: [{ sortOrder: 'asc' }, { extraPrice: 'asc' }] } },
    });
    if (!type) throw new BadRequestException('That candle is no longer available. Please choose again.');

    // Two different colors make a two-color candle; the same color twice is just one color.
    const color2Id = selection.color2Id && selection.color2Id !== selection.colorId ? selection.color2Id : undefined;
    if (color2Id && !type.allowTwoColors) throw new BadRequestException(`${type.name} comes in one color only.`);

    const colorIds = [selection.colorId, ...(color2Id ? [color2Id] : [])];
    const colors = await this.prisma.candleColor.findMany({ where: { id: { in: colorIds }, isActive: true } });
    const color1 = colors.find((color) => color.id === selection.colorId);
    const color2 = color2Id ? colors.find((color) => color.id === color2Id) : undefined;
    if (!color1 || (color2Id && !color2)) throw new BadRequestException('One of the colors is no longer available. Please choose again.');

    let size: (typeof type.sizes)[number] | undefined;
    if (type.sizes.length > 0) {
      size = type.sizes.find((entry) => entry.id === selection.sizeId);
      if (!size) throw new BadRequestException(`Please choose a height for the ${type.name}.`);
    } else if (selection.sizeId) {
      throw new BadRequestException(`${type.name} does not come in different heights.`);
    }

    const herbIds = [...new Set(selection.herbIds ?? [])];
    if (herbIds.length > 0 && !type.allowHerbs) throw new BadRequestException(`Herbs cannot be added to the ${type.name}.`);
    const herbs = herbIds.length > 0 ? await this.prisma.candleHerb.findMany({ where: { id: { in: herbIds }, isActive: true } }) : [];
    if (herbs.length !== herbIds.length) throw new BadRequestException('One of the herbs is no longer available. Please choose again.');
    // Keep them in the order the shop lists them, not the order they arrived in.
    herbs.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    let unitPrice = money(type.basePrice);
    if (size) unitPrice = unitPrice.add(money(size.extraPrice));
    if (color2) unitPrice = unitPrice.add(money(type.twoColorExtra));
    for (const herb of herbs) unitPrice = unitPrice.add(money(herb.price));

    const colorText = color2 ? `${color1.name} (top) / ${color2.name} (bottom)` : color1.name;
    const summary = [type.name, colorText, size?.label, herbs.length > 0 ? `Herbs: ${herbs.map((herb) => herb.name).join(', ')}` : null]
      .filter(Boolean)
      .join(' · ');

    return {
      unitPrice: unitPrice.toDecimalPlaces(2),
      weightOz: type.weightOz == null ? null : num(type.weightOz),
      snapshot: {
        kind: 'CUSTOM_CANDLE',
        summary,
        typeId: type.id,
        typeName: type.name,
        colors: [color1, ...(color2 ? [color2] : [])].map((color) => ({ id: color.id, name: color.name, hex: color.hex })),
        size: size ? { id: size.id, label: size.label } : null,
        herbs: herbs.map((herb) => ({ id: herb.id, name: herb.name })),
      },
    };
  }

  // ── Admin: everything, including what is switched off ──────────────────────────────

  async getAdminOverview() {
    const [types, colors, herbs] = await Promise.all([
      this.prisma.candleType.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { sizes: { orderBy: [{ sortOrder: 'asc' }, { extraPrice: 'asc' }] }, photo: true, waxMask: true },
      }),
      this.prisma.candleColor.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.candleHerb.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    ]);
    return {
      types: types.map((type) => ({
        id: type.id,
        name: type.name,
        description: type.description,
        basePrice: num(type.basePrice),
        photoMediaId: type.photoMediaId,
        photoUrl: type.photo ? buildMediaAssetUrl(type.photo.id) : null,
        waxMaskMediaId: type.waxMaskMediaId,
        waxMaskUrl: type.waxMask ? buildMediaAssetUrl(type.waxMask.id) : null,
        allowTwoColors: type.allowTwoColors,
        twoColorExtra: num(type.twoColorExtra),
        allowHerbs: type.allowHerbs,
        waxTopPercent: type.waxTopPercent,
        weightOz: type.weightOz == null ? null : num(type.weightOz),
        isActive: type.isActive,
        sortOrder: type.sortOrder,
        sizes: type.sizes.map((size) => ({ id: size.id, label: size.label, extraPrice: num(size.extraPrice), heightPercent: size.heightPercent })),
      })),
      colors: colors.map((color) => ({ id: color.id, name: color.name, hex: color.hex, isActive: color.isActive, sortOrder: color.sortOrder })),
      herbs: herbs.map((herb) => ({ id: herb.id, name: herb.name, price: num(herb.price), hex: herb.hex, isActive: herb.isActive, sortOrder: herb.sortOrder })),
    };
  }

  async createType(dto: SaveCandleTypeDto) {
    await this.assertImages(dto);
    const type = await this.prisma.candleType.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        basePrice: dto.basePrice,
        photoMediaId: dto.photoMediaId || null,
        waxMaskMediaId: dto.waxMaskMediaId || null,
        allowTwoColors: dto.allowTwoColors ?? false,
        twoColorExtra: dto.twoColorExtra ?? 0,
        allowHerbs: dto.allowHerbs ?? false,
        waxTopPercent: dto.waxTopPercent ?? 0,
        weightOz: dto.weightOz ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        sizes: {
          create: (dto.sizes ?? []).map((size, index) => ({
            label: size.label.trim(),
            extraPrice: size.extraPrice ?? 0,
            heightPercent: size.heightPercent ?? 100,
            sortOrder: index,
          })),
        },
      },
      select: { id: true },
    });
    return this.getType(type.id);
  }

  async updateType(id: string, dto: SaveCandleTypeDto) {
    const existing = await this.prisma.candleType.findUnique({ where: { id }, include: { sizes: true } });
    if (!existing) throw new NotFoundException('Candle type not found.');
    await this.assertImages(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.candleType.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          basePrice: dto.basePrice,
          ...(dto.photoMediaId !== undefined ? { photoMediaId: dto.photoMediaId || null } : {}),
          ...(dto.waxMaskMediaId !== undefined ? { waxMaskMediaId: dto.waxMaskMediaId || null } : {}),
          ...(dto.allowTwoColors !== undefined ? { allowTwoColors: dto.allowTwoColors } : {}),
          ...(dto.twoColorExtra !== undefined ? { twoColorExtra: dto.twoColorExtra } : {}),
          ...(dto.allowHerbs !== undefined ? { allowHerbs: dto.allowHerbs } : {}),
          ...(dto.waxTopPercent !== undefined ? { waxTopPercent: dto.waxTopPercent } : {}),
          ...(dto.weightOz !== undefined ? { weightOz: dto.weightOz } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });

      if (dto.sizes) {
        // Heights that already exist keep their id (carts may mention them); new ones are added; ones left out are removed.
        const keep = new Set(dto.sizes.map((size) => size.id).filter((sizeId): sizeId is string => !!sizeId && existing.sizes.some((entry) => entry.id === sizeId)));
        const removed = existing.sizes.filter((size) => !keep.has(size.id)).map((size) => size.id);
        if (removed.length > 0) await tx.candleSize.deleteMany({ where: { id: { in: removed } } });
        for (const [index, size] of dto.sizes.entries()) {
          const data = { label: size.label.trim(), extraPrice: size.extraPrice ?? 0, heightPercent: size.heightPercent ?? 100, sortOrder: index };
          if (size.id && keep.has(size.id)) await tx.candleSize.update({ where: { id: size.id }, data });
          else await tx.candleSize.create({ data: { ...data, typeId: id } });
        }
      }
    });
    return this.getType(id);
  }

  async deleteType(id: string) {
    const existing = await this.prisma.candleType.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Candle type not found.');
    await this.prisma.candleType.delete({ where: { id } });
    return { success: true };
  }

  async createColor(dto: SaveCandleColorDto) {
    const color = await this.prisma.candleColor.create({
      data: { name: dto.name.trim(), hex: dto.hex.toLowerCase(), isActive: dto.isActive ?? true, sortOrder: dto.sortOrder ?? 0 },
    });
    return { id: color.id, name: color.name, hex: color.hex, isActive: color.isActive, sortOrder: color.sortOrder };
  }

  async updateColor(id: string, dto: SaveCandleColorDto) {
    await this.assertExists(this.prisma.candleColor.findUnique({ where: { id }, select: { id: true } }), 'Color');
    const color = await this.prisma.candleColor.update({
      where: { id },
      data: { name: dto.name.trim(), hex: dto.hex.toLowerCase(), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}), ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}) },
    });
    return { id: color.id, name: color.name, hex: color.hex, isActive: color.isActive, sortOrder: color.sortOrder };
  }

  async deleteColor(id: string) {
    await this.assertExists(this.prisma.candleColor.findUnique({ where: { id }, select: { id: true } }), 'Color');
    await this.prisma.candleColor.delete({ where: { id } });
    return { success: true };
  }

  async createHerb(dto: SaveCandleHerbDto) {
    const herb = await this.prisma.candleHerb.create({
      data: { name: dto.name.trim(), price: dto.price ?? 0, ...(dto.hex ? { hex: dto.hex.toLowerCase() } : {}), isActive: dto.isActive ?? true, sortOrder: dto.sortOrder ?? 0 },
    });
    return { id: herb.id, name: herb.name, price: num(herb.price), hex: herb.hex, isActive: herb.isActive, sortOrder: herb.sortOrder };
  }

  async updateHerb(id: string, dto: SaveCandleHerbDto) {
    await this.assertExists(this.prisma.candleHerb.findUnique({ where: { id }, select: { id: true } }), 'Herb');
    const herb = await this.prisma.candleHerb.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.hex ? { hex: dto.hex.toLowerCase() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return { id: herb.id, name: herb.name, price: num(herb.price), hex: herb.hex, isActive: herb.isActive, sortOrder: herb.sortOrder };
  }

  async deleteHerb(id: string) {
    await this.assertExists(this.prisma.candleHerb.findUnique({ where: { id }, select: { id: true } }), 'Herb');
    await this.prisma.candleHerb.delete({ where: { id } });
    return { success: true };
  }

  private async getType(id: string) {
    const overview = await this.getAdminOverview();
    const type = overview.types.find((entry) => entry.id === id);
    if (!type) throw new NotFoundException('Candle type not found.');
    return type;
  }

  private async assertExists(lookup: Promise<unknown>, label: string) {
    if (!(await lookup)) throw new NotFoundException(`${label} not found.`);
  }

  /** The photo and the wax picture must be pictures from the media library. */
  private async assertImages(dto: { photoMediaId?: string | null; waxMaskMediaId?: string | null }) {
    for (const mediaId of [dto.photoMediaId, dto.waxMaskMediaId]) {
      if (!mediaId) continue;
      const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId }, select: { mimeType: true } });
      if (!asset || !isImageMimeType(asset.mimeType)) throw new BadRequestException('Choose pictures from the media library.');
    }
  }
}
