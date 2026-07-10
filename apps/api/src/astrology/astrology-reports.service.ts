import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { ConfigService } from '@nestjs/config';
import * as http from 'node:http';
import * as https from 'node:https';
import { PrismaService } from '../prisma/prisma.service';
import { AstrologyReportFormDto } from '../checkout/checkout.dto';

const ASTROLOGY_API_SETTINGS_KEY = 'astrology_api_settings';
const ASTROLOGY_API_TIMEOUT_MS = 45_000;

interface AstrologyApiSettings {
  endpointUrl?: string;
  apiKey?: string;
}

interface AstrologyApiResponse {
  reportUrl?: string;
  downloadUrl?: string;
  url?: string;
  reportText?: string;
  text?: string;
  fileName?: string;
}

interface AstrologyHttpResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

@Injectable()
export class AstrologyReportsService {
  private readonly logger = new Logger(AstrologyReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async listUserDownloads(userId: string) {
    return this.prisma.astrologyReport.findMany({
      where: { userId },
      include: {
        order: { select: { id: true, status: true, createdAt: true } },
        product: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReportsForOrder(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    orderItems: Array<{ id: string; productId: string; product: { digitalDelivery: string } }>,
    forms: AstrologyReportFormDto[] | undefined,
  ) {
    const formByProductId = new Map((forms ?? []).map((form) => [form.productId, form]));
    const reportItems = orderItems.filter((item) => item.product.digitalDelivery === 'ASTROLOGY_REPORT');

    for (const item of reportItems) {
      const form = formByProductId.get(item.productId);
      if (!form) {
        throw new BadRequestException('Astrology chart birth details are required before checkout.');
      }
      await tx.astrologyReport.create({
        data: {
          userId,
          orderId,
          orderItemId: item.id,
          productId: item.productId,
          status: 'AWAITING_PAYMENT',
          formData: cleanAstrologyForm(form) as Prisma.InputJsonObject,
        },
      });
    }
  }

  async generateReadyReports(orderId: string, userId: string) {
    const reports = await this.prisma.astrologyReport.findMany({
      where: { orderId, userId, status: { in: ['AWAITING_PAYMENT', 'PENDING', 'FAILED'] } },
      include: { product: { select: { name: true } }, order: { select: { id: true } } },
    });

    for (const report of reports) {
      await this.generateReport(report.id, userId).catch((error: unknown) => {
        this.logger.warn(`Astrology report ${report.id} generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    }
  }

  async generateReport(reportId: string, userId: string) {
    const report = await this.prisma.astrologyReport.findFirst({
      where: { id: reportId, userId },
      include: { product: { select: { name: true } }, order: { select: { id: true, status: true } } },
    });
    if (!report) throw new NotFoundException('Download not found');
    if (!['CONFIRMED', 'PROCESSING', 'COMPLETED'].includes(report.order.status)) {
      throw new BadRequestException('The order must be paid before this report can be generated.');
    }

    const settings = await this.getSettings();
    if (!settings.endpointUrl) {
      return this.prisma.astrologyReport.update({
        where: { id: report.id },
        data: {
          status: 'PENDING',
          errorMessage: 'Astrology API endpoint is not configured in Admin Settings.',
        },
      });
    }

    await this.prisma.astrologyReport.update({
      where: { id: report.id },
      data: { status: 'GENERATING', errorMessage: null },
    });

    try {
      const response = await postAstrologyRequest(settings, {
        reportId: report.id,
        orderId: report.order.id,
        productName: report.product.name,
        formData: report.formData,
      });

      const { payload, text } = await readAstrologyResponse(response);
      if (!response.ok) {
        throw new Error(payload.message ?? formatAstrologyApiError(response.status, text));
      }

      const reportUrl = payload.reportUrl ?? payload.downloadUrl ?? payload.url ?? null;
      const reportText = payload.reportText ?? payload.text ?? null;
      if (!reportUrl && !reportText) {
        throw new Error('Astrology API did not return a report URL or report text.');
      }

      return this.prisma.astrologyReport.update({
        where: { id: report.id },
        data: {
          status: 'READY',
          reportUrl,
          reportText,
          fileName: payload.fileName ?? `${slugify(report.product.name)}-${report.id}.pdf`,
          errorMessage: null,
          generatedAt: new Date(),
        },
      });
    } catch (error: unknown) {
      return this.prisma.astrologyReport.update({
        where: { id: report.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Astrology report generation failed.',
        },
      });
    }
  }

  private async getSettings(): Promise<AstrologyApiSettings> {
    const saved = await this.prisma.setting.findUnique({ where: { key: ASTROLOGY_API_SETTINGS_KEY } });
    const parsed = parseJson<AstrologyApiSettings>(saved?.value);
    return {
      endpointUrl: normalizeEndpoint(parsed?.endpointUrl || this.config.get<string>('ASTROLOGY_API_ENDPOINT') || ''),
      apiKey: parsed?.apiKey?.trim() || this.config.get<string>('ASTROLOGY_API_KEY') || '',
    };
  }
}

function cleanAstrologyForm(form: AstrologyReportFormDto) {
  return {
    productId: form.productId,
    fullName: form.fullName.trim(),
    birthDate: form.birthDate,
    birthTime: form.birthTime,
    birthCity: form.birthCity.trim(),
    birthState: form.birthState.trim(),
    birthCountry: form.birthCountry.trim(),
    timezone: form.timezone?.trim() || null,
    notes: form.notes?.trim() || null,
  };
}

function parseJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'astrology-report';
}

async function postAstrologyRequest(settings: AstrologyApiSettings, body: Record<string, unknown>) {
  const endpoints = getEndpointCandidates(settings.endpointUrl ?? '');
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ASTROLOGY_API_TIMEOUT_MS);
    try {
      return await requestAstrologyEndpoint(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error: unknown) {
      errors.push(`${endpoint}: ${formatFetchError(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Could not reach the astrology API. ${errors.join(' ')}`);
}

async function requestAstrologyEndpoint(
  endpoint: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
): Promise<AstrologyHttpResponse> {
  if (usesLocalLinkSelfSignedTls(endpoint)) {
    return requestLocalLinkEndpoint(endpoint, init);
  }

  return fetch(endpoint, init);
}

function usesLocalLinkSelfSignedTls(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && url.hostname.endsWith('.link');
  } catch {
    return false;
  }
}

function requestLocalLinkEndpoint(
  endpoint: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
  redirectsRemaining = 3,
): Promise<AstrologyHttpResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      url,
      {
        method: init.method,
        headers: {
          ...init.headers,
          'Content-Length': Buffer.byteLength(init.body),
        },
        ...(url.protocol === 'https:' ? { rejectUnauthorized: false } : {}),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (location && [301, 302, 303, 307, 308].includes(status) && redirectsRemaining > 0) {
          response.resume();
          const nextUrl = new URL(location, url).toString();
          requestLocalLinkEndpoint(nextUrl, init, redirectsRemaining - 1).then(resolve).catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => {
              try {
                return JSON.parse(text);
              } catch {
                return {};
              }
            },
            text: async () => text,
          });
        });
      },
    );

    const abort = () => request.destroy(new Error('request aborted'));
    init.signal.addEventListener('abort', abort, { once: true });
    request.on('error', reject);
    request.on('close', () => init.signal.removeEventListener('abort', abort));
    request.write(init.body);
    request.end();
  });
}

function normalizeEndpoint(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function getEndpointCandidates(endpoint: string) {
  const normalized = normalizeEndpoint(endpoint);
  if (!normalized) return [];
  const candidates = [normalized];

  try {
    const url = new URL(normalized);
    if (url.hostname.endsWith('.link') && url.protocol === 'https:') {
      url.protocol = 'http:';
      candidates.push(url.toString());
    }
  } catch {
    return candidates;
  }

  return Array.from(new Set(candidates));
}

function formatFetchError(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) return `${error.message} (${cause.message})`;
    if (cause && typeof cause === 'object') {
      const detail = cause as Record<string, unknown>;
      const code = typeof detail.code === 'string' ? detail.code : '';
      const syscall = typeof detail.syscall === 'string' ? detail.syscall : '';
      const hostname = typeof detail.hostname === 'string' ? detail.hostname : '';
      const message = [code, syscall, hostname].filter(Boolean).join(' ');
      return message ? `${error.message} (${message})` : error.message;
    }
    return error.name === 'AbortError' ? `request timed out after ${ASTROLOGY_API_TIMEOUT_MS / 1000} seconds` : error.message;
  }
  return 'fetch failed';
}

async function readAstrologyResponse(response: AstrologyHttpResponse) {
  const text = await response.text().catch(() => '');
  return {
    text,
    payload: parseJson<AstrologyApiResponse & { message?: string }>(text) ?? {},
  };
}

function formatAstrologyApiError(status: number, text: string) {
  const detail = cleanResponseText(text);
  return detail ? `Astrology API returned ${status}: ${detail}` : `Astrology API returned ${status}`;
}

function cleanResponseText(text: string) {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
