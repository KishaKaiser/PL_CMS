import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetShippingQuoteDto,
  ShippingAddressDto,
  TestShippingQuoteDto,
  WarehouseAddressDto,
} from './shipping.dto';

const SHIPSTATION_BASE = 'https://ssapi.shipstation.com';
const WAREHOUSE_ADDRESS_KEY = 'warehouse_address';
const SHIPPING_API_SETTINGS_KEY = 'shipping_api_settings';
const SHIPSTATION_SERVICES = [
  { carrierCode: 'usps', carrierName: 'United States Post Office', serviceCode: 'usps_ground_advantage', serviceName: 'USPS Ground Advantage' },
  { carrierCode: 'usps', carrierName: 'United States Post Office', serviceCode: 'usps_priority_mail', serviceName: 'USPS Priority Mail' },
  { carrierCode: 'ups', carrierName: 'UPS', serviceCode: 'ups_ground', serviceName: 'UPS Ground' },
  { carrierCode: 'ups', carrierName: 'UPS', serviceCode: 'ups_2nd_day_air', serviceName: 'UPS 2nd Day Air' },
  { carrierCode: 'fedex', carrierName: 'FedEx', serviceCode: 'fedex_ground', serviceName: 'FedEx Ground' },
  { carrierCode: 'fedex', carrierName: 'FedEx', serviceCode: 'fedex_2day', serviceName: 'FedEx 2Day' },
  { carrierCode: 'global_post', carrierName: 'GlobalPost', serviceCode: 'globalpost_economy_intl', serviceName: 'GlobalPost Economy International' },
  { carrierCode: 'global_post', carrierName: 'GlobalPost', serviceCode: 'globalpost_standard_intl', serviceName: 'GlobalPost Standard International' },
];
const SHIPSTATION_CARRIER_ALIASES: Record<string, string[]> = {
  usps: ['stamps_com', 'usps'],
  stamps_com: ['stamps_com', 'usps'],
  ups: ['ups_walleted', 'ups'],
  ups_walleted: ['ups_walleted', 'ups'],
  fedex: ['fedex'],
  global_post: ['global_post', 'globalpost'],
  globalpost: ['global_post', 'globalpost'],
};
/** Default weight per item when no weight is provided by the product (16 oz = 1 lb). */
const DEFAULT_ITEM_WEIGHT_OZ = 16;
const USPS_FIRST_CLASS_MAX_WEIGHT_OZ = 16;

export interface ShippingRate {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number;
  otherCost: number;
}

interface ShipStationRate {
  serviceName?: string;
  serviceCode?: string;
  carrierCode?: string;
  carrierName?: string;
  shipmentCost?: number;
  otherCost?: number;
  deliveryDays?: number;
  deliveryDate?: string;
}

interface ShipStationValidateResponse {
  isValid: boolean;
  addressVerified?: boolean;
  address?: {
    name?: string;
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  message?: string;
}

interface ShippingApiSettings {
  apiKey?: string;
  apiSecret?: string;
  enabledCarrierCodes?: string[];
}

export interface ShipStationQuoteAttempt {
  carrierCode: string;
  requestBody: unknown;
  status?: number;
  rateCount?: number;
  error?: string;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async getAuthHeader(): Promise<string> {
    const saved = await this.getSavedShippingApiSettings();
    const key = saved.apiKey || this.config.get<string>('SHIPSTATION_API_KEY') || '';
    const secret = saved.apiSecret || this.config.get<string>('SHIPSTATION_API_SECRET') || '';
    if (!key || !secret) {
      throw new BadRequestException(
        'ShipStation API credentials are not configured. ' +
          'Add them in Admin → Settings → API settings → Shipping.',
      );
    }
    return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
  }

  private async getSavedShippingApiSettings(): Promise<ShippingApiSettings> {
    const setting = await this.prisma.setting.findUnique({ where: { key: SHIPPING_API_SETTINGS_KEY } });
    if (!setting) return {};
    try {
      const parsed = JSON.parse(setting.value) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      const candidate = parsed as Record<string, unknown>;
      return {
        apiKey: typeof candidate.apiKey === 'string' ? candidate.apiKey.trim() : '',
        apiSecret: typeof candidate.apiSecret === 'string' ? candidate.apiSecret.trim() : '',
        enabledCarrierCodes: Array.isArray(candidate.enabledCarrierCodes)
          ? candidate.enabledCarrierCodes.filter((value): value is string => typeof value === 'string')
          : ['usps'],
      };
    } catch {
      return {};
    }
  }

  /** Returns the stored warehouse origin address or null if not set. */
  async getWarehouseAddress(): Promise<WarehouseAddressDto | null> {
    const setting = await this.prisma.setting.findUnique({
      where: { key: WAREHOUSE_ADDRESS_KEY },
    });
    if (!setting) return null;
    try {
      return JSON.parse(setting.value) as WarehouseAddressDto;
    } catch {
      this.logger.warn('warehouse_address setting is not valid JSON');
      return null;
    }
  }

  /** Upserts the warehouse origin address in the Settings table. */
  async upsertWarehouseAddress(dto: WarehouseAddressDto): Promise<WarehouseAddressDto> {
    await this.prisma.setting.upsert({
      where: { key: WAREHOUSE_ADDRESS_KEY },
      create: { key: WAREHOUSE_ADDRESS_KEY, value: JSON.stringify(dto) },
      update: { value: JSON.stringify(dto) },
    });
    return dto;
  }

  getShipStationServices() {
    return SHIPSTATION_SERVICES;
  }

  async getDiagnostics() {
    const warehouse = await this.getWarehouseAddress();
    const saved = await this.getSavedShippingApiSettings();
    const envKey = this.config.get<string>('SHIPSTATION_API_KEY') || '';
    const envSecret = this.config.get<string>('SHIPSTATION_API_SECRET') || '';

    return {
      warehouseConfigured: Boolean(warehouse),
      warehousePostalCode: warehouse?.postalCode ?? null,
      warehouseState: warehouse?.state ?? null,
      savedApiKeyConfigured: Boolean(saved.apiKey),
      savedApiSecretConfigured: Boolean(saved.apiSecret),
      envApiKeyConfigured: Boolean(envKey),
      envApiSecretConfigured: Boolean(envSecret),
      credentialsSource: saved.apiKey && saved.apiSecret ? 'admin-settings' : envKey && envSecret ? 'environment' : 'missing',
      carriersRequested: this.getEnabledCarrierCodes(saved),
    };
  }

  async testShippingQuote(dto: TestShippingQuoteDto) {
    const attempts: ShipStationQuoteAttempt[] = [];
    const quoteDto: GetShippingQuoteDto = {
      address: dto.address,
      items: [
        {
          productId: '__manual_test__',
          quantity: 1,
          weightOz: dto.weightOz ?? DEFAULT_ITEM_WEIGHT_OZ,
          lengthIn: dto.lengthIn ?? 10,
          widthIn: dto.widthIn ?? 10,
          heightIn: dto.heightIn ?? 10,
        },
      ],
    };

    try {
      const rates = await this.getShippingQuoteFromShipStation(quoteDto, attempts);
      return { success: true, rates, attempts };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown ShipStation quote error',
        attempts,
      };
    }
  }

  /** Calls ShipStation /shipments/getrates and returns available rates. */
  async getShippingQuote(dto: GetShippingQuoteDto): Promise<ShippingRate[]> {
    try {
      return await this.getShippingQuoteFromShipStation(dto);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = error instanceof Error ? error.message : 'Unknown shipping error';
      this.logger.error(`Shipping quote failed: ${message}`);
      throw new BadRequestException(`Shipping quote failed before ShipStation returned rates: ${message}`);
    }
  }

  private async getShippingQuoteFromShipStation(
    dto: GetShippingQuoteDto,
    debugAttempts: ShipStationQuoteAttempt[] = [],
  ): Promise<ShippingRate[]> {
    const warehouse = await this.getWarehouseAddress();
    if (!warehouse) {
      throw new NotFoundException(
        'Warehouse origin address is not configured. ' +
          'Please set it in Admin → Settings → Shipping.',
      );
    }

    const packageDetails = await this.getPackageDetails(dto.items);

    const baseRequestBody = {
      fromPostalCode: warehouse.postalCode,
      fromCity: warehouse.city,
      fromState: warehouse.state,
      fromCountry: warehouse.country,
      toState: dto.address.state,
      toCountry: dto.address.country,
      toPostalCode: dto.address.postalCode,
      toCity: dto.address.city,
      weight: { value: packageDetails.weightOz, units: 'ounces' },
      dimensions: { ...packageDetails.dimensions, units: 'inches' },
      confirmation: 'none',
      residential: false,
    };

    const authHeader = await this.getAuthHeader();
    const shippingSettings = await this.getSavedShippingApiSettings();
    const carrierCodes = this.getEnabledCarrierCodes(shippingSettings);
    const rates: ShipStationRate[] = [];
    const failures: string[] = [];

    const shouldSkipUps = ['US', 'CA'].includes(dto.address.country) && !dto.address.state.trim();

    for (const carrierCode of carrierCodes) {
      if (carrierCode === 'ups' && shouldSkipUps) {
        failures.push('ups: Destination state is required for US/CA UPS rates.');
        continue;
      }
      for (const candidateCode of this.getCarrierCodeCandidates(carrierCode)) {
        const requestBody = { ...baseRequestBody, carrierCode: candidateCode };
        const attempt: ShipStationQuoteAttempt = { carrierCode: candidateCode, requestBody };
        debugAttempts.push(attempt);
        let response: Response;
        try {
          response = await fetch(`${SHIPSTATION_BASE}/shipments/getrates`, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to reach ShipStation';
          attempt.error = message;
          this.logger.warn(`ShipStation getrates request failed for ${candidateCode}: ${message}`);
          failures.push(`${candidateCode}: Unable to reach ShipStation (${message})`);
          continue;
        }

        attempt.status = response.status;

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          const detail = formatShipStationError(text);
          attempt.error = detail || `HTTP ${response.status}`;
          this.logger.warn(`ShipStation getrates failed for ${candidateCode}: ${response.status} ${text}`);
          if (response.status === 401 || response.status === 403) {
            throw new BadRequestException(
              `ShipStation rejected the API credentials (${response.status}). ${detail}`,
            );
          }
          failures.push(`${candidateCode}: ${detail || `HTTP ${response.status}`}`);
          continue;
        }

        const carrierRates = (await response.json().catch(() => [])) as unknown;
        if (Array.isArray(carrierRates) && carrierRates.length > 0) {
          attempt.rateCount = carrierRates.length;
          rates.push(...(carrierRates as ShipStationRate[]));
          break;
        }
        if (Array.isArray(carrierRates)) {
          attempt.rateCount = 0;
          failures.push(`${candidateCode}: ShipStation returned no rates.`);
        } else {
          attempt.error = 'ShipStation returned an unexpected response.';
          failures.push(`${candidateCode}: ShipStation returned an unexpected response.`);
        }
      }
    }

    const supportedRates = rates
      .map((r) => ({
        serviceName: formatRateLabel(r),
        serviceCode: r.serviceCode ?? '',
        carrierCode: r.carrierCode ?? inferCarrierCode(r.serviceCode, r.serviceName),
        shipmentCost: Number(r.shipmentCost ?? 0),
        otherCost: Number(r.otherCost ?? 0),
      }))
      .filter((rate) => rate.serviceCode && isSupportedCarrier(rate.carrierCode))
      .filter((rate) => !isOverweightUspsFirstClass(rate, packageDetails.weightOz));

    if (supportedRates.length === 0 && failures.length > 0) {
      throw new BadRequestException(
        `ShipStation could not return rates. ${failures.join(' ')}`,
      );
    }

    return supportedRates;
  }

  private async getPackageDetails(items: GetShippingQuoteDto['items']) {
    const productIds = Array.from(new Set(items.map((item) => item.productId).filter(Boolean)));
    const products = productIds.length > 0
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, weightOz: true, lengthIn: true, widthIn: true, heightIn: true },
        })
      : [];
    const productMap = new Map(products.map((product) => [product.id, product]));

    let weightOz = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let totalHeight = 0;
    let hasDimensions = false;

    for (const item of items) {
      const product = productMap.get(item.productId);
      const itemWeight = Number(product?.weightOz ?? item.weightOz ?? DEFAULT_ITEM_WEIGHT_OZ);
      weightOz += Math.max(1, itemWeight) * item.quantity;

      const length = Number(product?.lengthIn ?? item.lengthIn ?? 0);
      const width = Number(product?.widthIn ?? item.widthIn ?? 0);
      const height = Number(product?.heightIn ?? item.heightIn ?? 0);
      if (length > 0 && width > 0 && height > 0) {
        hasDimensions = true;
        maxLength = Math.max(maxLength, length);
        maxWidth = Math.max(maxWidth, width);
        totalHeight += height * item.quantity;
      }
    }

    return {
      weightOz: Math.max(1, Math.ceil(weightOz)),
      dimensions: {
        length: Math.max(1, Math.ceil(hasDimensions ? maxLength : 10)),
        width: Math.max(1, Math.ceil(hasDimensions ? maxWidth : 10)),
        height: Math.max(1, Math.ceil(hasDimensions ? totalHeight : 10)),
      },
    };
  }

  private getEnabledCarrierCodes(settings: ShippingApiSettings) {
    const supported = Array.from(new Set(SHIPSTATION_SERVICES.map((service) => service.carrierCode)));
    const selected = settings.enabledCarrierCodes?.map((code) => normalizeCarrierCode(code)).filter((code) => supported.includes(code)) ?? [];
    return selected.length > 0 ? Array.from(new Set(selected)) : ['usps'];
  }

  private getCarrierCodeCandidates(carrierCode: string) {
    return SHIPSTATION_CARRIER_ALIASES[carrierCode] ?? [carrierCode];
  }

  /** Calls ShipStation /addresses/validate and returns the result. */
  async validateAddress(address: ShippingAddressDto): Promise<{
    isValid: boolean;
    normalized?: ShippingAddressDto;
    message?: string;
  }> {
    const authHeader = await this.getAuthHeader();
    const response = await fetch(`${SHIPSTATION_BASE}/addresses/validate`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: address.fullName,
        street1: address.line1,
        street2: address.line2 ?? null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn(`ShipStation validate-address failed: ${response.status} ${text}`);
      throw new BadRequestException(
        `ShipStation address validation returned an error (${response.status}). ${formatShipStationError(text)}`,
      );
    }

    const data = (await response.json()) as ShipStationValidateResponse;
    const normalized: ShippingAddressDto | undefined = data.address
      ? {
          fullName: data.address.name ?? address.fullName,
          phone: address.phone,
          line1: data.address.street1 ?? address.line1,
          line2: data.address.street2 ?? address.line2,
          city: data.address.city ?? address.city,
          state: data.address.state ?? address.state,
          postalCode: data.address.postalCode ?? address.postalCode,
          country: data.address.country ?? address.country,
          email: address.email,
        }
      : undefined;

    return {
      isValid: data.isValid ?? data.addressVerified ?? false,
      normalized,
      message: data.message,
    };
  }
}

function isSupportedCarrier(carrierCode?: string | null) {
  if (!carrierCode) return false;
  const normalized = normalizeCarrierCode(carrierCode);
  return ['usps', 'ups', 'fedex', 'global_post'].some((carrier) => normalized.includes(carrier));
}

function normalizeCarrierCode(carrierCode: string) {
  const normalized = carrierCode.toLowerCase();
  if (normalized === 'stamps_com') return 'usps';
  if (normalized === 'ups_walleted') return 'ups';
  if (normalized === 'globalpost') return 'global_post';
  return normalized;
}

function inferCarrierCode(serviceCode?: string, serviceName?: string) {
  const haystack = `${serviceCode ?? ''} ${serviceName ?? ''}`.toLowerCase();
  if (haystack.includes('usps') || haystack.includes('first class') || haystack.includes('priority mail')) return 'usps';
  if (haystack.includes('ups')) return 'ups';
  if (haystack.includes('fedex')) return 'fedex';
  if (haystack.includes('globalpost') || haystack.includes('global post')) return 'global_post';
  return '';
}

function isOverweightUspsFirstClass(rate: ShippingRate, weightOz: number) {
  if (normalizeCarrierCode(rate.carrierCode) !== 'usps') return false;
  if (weightOz <= USPS_FIRST_CLASS_MAX_WEIGHT_OZ) return false;
  const haystack = `${rate.serviceCode} ${rate.serviceName}`.toLowerCase();
  return haystack.includes('first_class') || haystack.includes('first class');
}

function formatRateLabel(rate: ShipStationRate) {
  const label = rate.serviceName ?? rate.serviceCode ?? 'Shipping';
  if (rate.deliveryDate) {
    const timestamp = Date.parse(rate.deliveryDate);
    if (!Number.isNaN(timestamp)) {
      return `${label} (Est. Delivery: ${new Date(timestamp).toLocaleDateString('en-US')})`;
    }
  }
  if (rate.deliveryDays && rate.deliveryDays > 0) {
    return `${label} (${rate.deliveryDays} ${rate.deliveryDays === 1 ? 'day' : 'days'})`;
  }
  return label;
}

function formatShipStationError(text: string) {
  if (!text) return 'No error details were returned.';
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => formatShipStationErrorObject(item)).filter(Boolean).join(' ');
    }
    return formatShipStationErrorObject(parsed) || text;
  } catch {
    return text;
  }
}

function formatShipStationErrorObject(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const object = value as Record<string, unknown>;
  const parts = [
    object.message,
    object.Message,
    object.error,
    object.Error,
    object.ExceptionMessage,
  ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  const errors = object.errors ?? object.Errors;
  if (Array.isArray(errors)) {
    parts.push(
      ...errors
        .map((item) => (typeof item === 'string' ? item : formatShipStationErrorObject(item)))
        .filter(Boolean),
    );
  }
  return parts.join(' ').trim();
}
