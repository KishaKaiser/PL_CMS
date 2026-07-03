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
  WarehouseAddressDto,
} from './shipping.dto';

const SHIPSTATION_BASE = 'https://ssapi.shipstation.com';
const WAREHOUSE_ADDRESS_KEY = 'warehouse_address';
const SHIPPING_API_SETTINGS_KEY = 'shipping_api_settings';
const SHIPSTATION_SERVICES = [
  { carrierCode: 'stamps_com', carrierName: 'United States Post Office', serviceCode: 'usps_ground_advantage', serviceName: 'USPS Ground Advantage' },
  { carrierCode: 'stamps_com', carrierName: 'United States Post Office', serviceCode: 'usps_priority_mail', serviceName: 'USPS Priority Mail' },
  { carrierCode: 'ups', carrierName: 'UPS', serviceCode: 'ups_ground', serviceName: 'UPS Ground' },
  { carrierCode: 'ups', carrierName: 'UPS', serviceCode: 'ups_2nd_day_air', serviceName: 'UPS 2nd Day Air' },
  { carrierCode: 'fedex', carrierName: 'FedEx', serviceCode: 'fedex_ground', serviceName: 'FedEx Ground' },
  { carrierCode: 'fedex', carrierName: 'FedEx', serviceCode: 'fedex_2day', serviceName: 'FedEx 2Day' },
  { carrierCode: 'globalpost', carrierName: 'GlobalPost', serviceCode: 'globalpost_economy_intl', serviceName: 'GlobalPost Economy International' },
  { carrierCode: 'globalpost', carrierName: 'GlobalPost', serviceCode: 'globalpost_standard_intl', serviceName: 'GlobalPost Standard International' },
];
/** Default weight per item when no weight is provided by the product (16 oz = 1 lb). */
const DEFAULT_ITEM_WEIGHT_OZ = 16;

export interface ShippingRate {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number;
  otherCost: number;
}

interface ShipStationRate {
  serviceName: string;
  serviceCode: string;
  carrierCode: string;
  shipmentCost: number;
  otherCost: number;
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
      carriersRequested: Array.from(new Set(SHIPSTATION_SERVICES.map((service) => service.carrierCode))),
    };
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

  private async getShippingQuoteFromShipStation(dto: GetShippingQuoteDto): Promise<ShippingRate[]> {
    const warehouse = await this.getWarehouseAddress();
    if (!warehouse) {
      throw new NotFoundException(
        'Warehouse origin address is not configured. ' +
          'Please set it in Admin → Settings → Shipping.',
      );
    }

    const totalWeightOz = dto.items.reduce(
      (sum, item) => sum + (item.weightOz ?? DEFAULT_ITEM_WEIGHT_OZ) * item.quantity,
      0,
    );

    const baseRequestBody = {
      serviceCode: null,
      packageCode: 'package',
      fromPostalCode: warehouse.postalCode,
      toState: dto.address.state,
      toCountry: dto.address.country,
      toPostalCode: dto.address.postalCode,
      toCity: dto.address.city,
      weight: { value: totalWeightOz, units: 'ounces' },
      residential: true,
    };

    const authHeader = await this.getAuthHeader();
    const carrierCodes = Array.from(new Set(SHIPSTATION_SERVICES.map((service) => service.carrierCode)));
    const rates: ShipStationRate[] = [];
    const failures: string[] = [];

    for (const carrierCode of carrierCodes) {
      let response: Response;
      try {
        response = await fetch(`${SHIPSTATION_BASE}/shipments/getrates`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...baseRequestBody, carrierCode }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to reach ShipStation';
        this.logger.warn(`ShipStation getrates request failed for ${carrierCode}: ${message}`);
        failures.push(`${carrierCode}: Unable to reach ShipStation (${message})`);
        continue;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        const detail = formatShipStationError(text);
        this.logger.warn(`ShipStation getrates failed for ${carrierCode}: ${response.status} ${text}`);
        if (response.status === 401 || response.status === 403) {
          throw new BadRequestException(
            `ShipStation rejected the API credentials (${response.status}). ${detail}`,
          );
        }
        failures.push(`${carrierCode}: ${detail || `HTTP ${response.status}`}`);
        continue;
      }

      const carrierRates = (await response.json().catch(() => [])) as unknown;
      if (Array.isArray(carrierRates)) {
        rates.push(...(carrierRates as ShipStationRate[]));
      } else {
        failures.push(`${carrierCode}: ShipStation returned an unexpected response.`);
      }
    }

    const supportedRates = rates.map((r) => ({
      serviceName: r.serviceName,
      serviceCode: r.serviceCode,
      carrierCode: r.carrierCode,
      shipmentCost: r.shipmentCost,
      otherCost: r.otherCost,
    })).filter((rate) => isSupportedCarrier(rate.carrierCode));

    if (supportedRates.length === 0 && failures.length > 0) {
      throw new BadRequestException(
        `ShipStation could not return rates. ${failures.slice(0, 3).join(' ')}`,
      );
    }

    return supportedRates;
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

function isSupportedCarrier(carrierCode: string) {
  const normalized = carrierCode.toLowerCase();
  return ['stamps', 'usps', 'ups', 'fedex', 'globalpost'].some((carrier) => normalized.includes(carrier));
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
