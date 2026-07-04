import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AstrologyReportFormDto } from '../checkout/checkout.dto';

const ASTROLOGY_API_SETTINGS_KEY = 'astrology_api_settings';

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
      const response = await fetch(settings.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
        },
        body: JSON.stringify({
          reportId: report.id,
          orderId: report.order.id,
          productName: report.product.name,
          formData: report.formData,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AstrologyApiResponse & { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? `Astrology API returned ${response.status}`);
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
      endpointUrl: parsed?.endpointUrl || this.config.get<string>('ASTROLOGY_API_ENDPOINT') || '',
      apiKey: parsed?.apiKey || this.config.get<string>('ASTROLOGY_API_KEY') || '',
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
