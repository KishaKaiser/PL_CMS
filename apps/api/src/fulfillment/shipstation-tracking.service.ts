import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { carrierKind, mapTrackingResponse, shipStationCarrierCodes, type LiveTracking } from './order-progress';

/** ShipStation's tracking service (the ShipEngine API that comes with ShipStation). It uses its own API key. */
const TRACKING_BASE = 'https://api.shipengine.com';
export const TRACKING_API_KEY_SETTING = 'shipstation_tracking_api_key';

const SUCCESS_CACHE_MS = 10 * 60 * 1000;
const DELIVERED_CACHE_MS = 24 * 60 * 60 * 1000;
const FAILURE_CACHE_MS = 3 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

export type TrackingLookup =
  | { live: LiveTracking; unavailable?: undefined }
  /** not_configured: no key saved. unsupported: a carrier ShipStation tracking is not asked about. unavailable: it did not answer. */
  | { live: null; unavailable: 'not_configured' | 'unsupported' | 'unavailable' };

@Injectable()
export class ShipStationTrackingService {
  private readonly logger = new Logger(ShipStationTrackingService.name);
  private readonly cache = new Map<string, { expires: number; value: TrackingLookup }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async getApiKey() {
    const saved = await this.prisma.setting.findUnique({ where: { key: TRACKING_API_KEY_SETTING } });
    return saved?.value?.trim() || this.config.get<string>('SHIPSTATION_TRACKING_API_KEY')?.trim() || '';
  }

  /** What the carrier says about a package, through ShipStation. Never throws: the tracking page works without it. */
  async lookup(carrier: string | null | undefined, trackingNumber: string): Promise<TrackingLookup> {
    if (carrierKind(carrier) === 'other') return { live: null, unavailable: 'unsupported' };
    const apiKey = await this.getApiKey();
    if (!apiKey) return { live: null, unavailable: 'not_configured' };

    const cacheKey = `${carrierKind(carrier)}:${trackingNumber}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.value;

    const value = await this.fetchFromShipStation(apiKey, carrier, trackingNumber);
    const ttl = value.live ? (value.live.delivered ? DELIVERED_CACHE_MS : SUCCESS_CACHE_MS) : FAILURE_CACHE_MS;
    this.cache.set(cacheKey, { expires: Date.now() + ttl, value });
    if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value as string);
    return value;
  }

  private async fetchFromShipStation(apiKey: string, carrier: string | null | undefined, trackingNumber: string): Promise<TrackingLookup> {
    for (const code of shipStationCarrierCodes(carrier)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const url = `${TRACKING_BASE}/v1/tracking?carrier_code=${encodeURIComponent(code)}&tracking_number=${encodeURIComponent(trackingNumber)}`;
        const response = await fetch(url, { headers: { 'API-Key': apiKey, Accept: 'application/json' }, signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          this.logger.warn(
            'ShipStation refused the tracking key. Check that it is the API v2 key (ShipStation → Account → API Settings) and that the plan includes tracking.',
          );
          return { live: null, unavailable: 'unavailable' };
        }
        if (!response.ok) {
          // Most likely this carrier code is not the one the account uses: try the next one.
          this.logger.debug(`ShipStation tracking answered ${response.status} for carrier code ${code}`);
          continue;
        }
        const live = mapTrackingResponse(await response.json());
        if (live) return { live };
      } catch (error) {
        this.logger.warn(`ShipStation tracking lookup failed: ${error instanceof Error ? error.message : String(error)}`);
        return { live: null, unavailable: 'unavailable' };
      } finally {
        clearTimeout(timer);
      }
    }
    return { live: null, unavailable: 'unavailable' };
  }
}
