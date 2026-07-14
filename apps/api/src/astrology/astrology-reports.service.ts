import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@pl-cms/db';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { AstrologyReportFormDto } from '../checkout/checkout.dto';
import { AstrologyChartsService } from './astrology-charts.service';
import { PreviewAstrologyChartDto } from './astrology.dto';
import { resolveBirthCoordinates } from './birth-data.util';
import { generateChartData } from './chart-engine';
import { OllamaClient } from './ollama-client';
import { getOllamaSettings } from './ollama-settings.util';
import { buildOllamaPrompt, writeChartPdf } from './report-renderer';

@Injectable()
export class AstrologyReportsService {
  private readonly logger = new Logger(AstrologyReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ollama: OllamaClient,
    private readonly chartsService: AstrologyChartsService,
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

  async previewChart(dto: PreviewAstrologyChartDto, userId: string) {
    const name = readRequiredString(dto.name, 'name');
    const date = readRequiredString(dto.date, 'date');
    const time = readRequiredString(dto.time, 'time');
    const city = readRequiredString(dto.city, 'city');
    const country = readRequiredString(dto.country, 'country');
    const state = readOptionalString(dto.state) ?? '';
    const resolved = await resolveBirthCoordinates({
      city,
      state,
      country,
      date,
      time,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezoneOverride: dto.timezone,
    });

    const notes = readOptionalString(dto.notes);
    const chart = generateChartData({
      name,
      date,
      time,
      location: resolved.location,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      timezone: resolved.timezone,
      coordinateSource: resolved.coordinateSource,
      notes,
    });

    await this.chartsService.createChart({
      id: chart.id,
      createdById: userId,
      reportType: 'natal',
      title: chart.name,
      inputData: dto as unknown as object,
      chartData: chart as unknown as object,
    });

    return chart;
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

    await this.prisma.astrologyReport.update({
      where: { id: report.id },
      data: { status: 'GENERATING', errorMessage: null },
    });

    try {
      const formData = parseAstrologyForm(report.formData);
      const settings = await this.getSettings();
      const resolved = await resolveBirthCoordinates({
        city: formData.birthCity,
        state: formData.birthState,
        country: formData.birthCountry,
        date: formData.birthDate,
        time: formData.birthTime,
        latitude: formData.birthLatitude,
        longitude: formData.birthLongitude,
        timezoneOverride: formData.timezone,
      });

      const chart = generateChartData({
        name: formData.fullName,
        date: formData.birthDate,
        time: formData.birthTime,
        location: resolved.location,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        timezone: resolved.timezone,
        coordinateSource: resolved.coordinateSource,
      });
      const prompt = buildOllamaPrompt(chart, formData.notes);
      const ollamaReportText = await this.ollama.generate(prompt, {
        baseUrl: settings.ollamaBaseUrl,
        model: settings.ollamaModel,
      });
      if (!ollamaReportText) {
        throw new Error(
          'The astrology interpretation could not be generated. Check the Ollama URL and model settings, then try generating the report again.',
        );
      }
      if (!hasCompleteInterpretation(ollamaReportText)) {
        throw new Error(
          'The astrology interpretation was incomplete. Try generating the report again, or use a larger Ollama model/context window.',
        );
      }

      const reportText = ollamaReportText;
      const fileName = `${slugify(report.product.name)}-${report.id}.pdf`;
      await writeChartPdf({
        chart,
        reportText,
        reportsDir: this.getReportsDir(),
        fileName,
      });

      return this.prisma.astrologyReport.update({
        where: { id: report.id },
        data: {
          status: 'READY',
          reportUrl: `/api/proxy/account/downloads/${report.id}/file`,
          reportText,
          fileName,
          formData: {
            ...formData,
            birthLatitude: resolved.latitude,
            birthLongitude: resolved.longitude,
            timezone: resolved.timezone,
            geocodedLocation: resolved.coordinateSource === 'geocoded' ? resolved.location : null,
          } as Prisma.InputJsonObject,
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

  async getReportFile(reportId: string, userId: string) {
    const report = await this.prisma.astrologyReport.findFirst({
      where: { id: reportId, userId },
      select: { fileName: true, status: true },
    });
    if (!report) throw new NotFoundException('Download not found');
    if (report.status !== 'READY' || !report.fileName) {
      throw new NotFoundException('Report file is not ready');
    }

    const fileName = sanitizeFileName(report.fileName);
    const filePath = join(this.getReportsDir(), fileName);
    await access(filePath).catch(() => {
      throw new NotFoundException('Report file not found');
    });

    return { fileName, filePath };
  }

  private getReportsDir() {
    return resolve(this.config.get<string>('ASTROLOGY_REPORTS_DIR') || 'storage/astrology-reports');
  }

  private getSettings() {
    return getOllamaSettings(this.prisma, this.config);
  }
}

interface ParsedAstrologyForm {
  fullName: string;
  birthDate: string;
  birthTime: string;
  birthCity: string;
  birthState: string;
  birthCountry: string;
  birthLatitude?: number | null;
  birthLongitude?: number | null;
  timezone?: string | null;
  notes?: string | null;
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
    birthLatitude: readOptionalNumber(form.birthLatitude),
    birthLongitude: readOptionalNumber(form.birthLongitude),
    timezone: form.timezone?.trim() || null,
    notes: form.notes?.trim() || null,
  };
}

function parseAstrologyForm(value: Prisma.JsonValue): ParsedAstrologyForm {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Astrology form data is invalid.');
  }
  const form = value as Record<string, unknown>;
  const parsed = {
    fullName: readRequiredString(form.fullName, 'fullName'),
    birthDate: readRequiredString(form.birthDate, 'birthDate'),
    birthTime: readRequiredString(form.birthTime, 'birthTime'),
    birthCity: readRequiredString(form.birthCity, 'birthCity'),
    birthState: readRequiredString(form.birthState, 'birthState'),
    birthCountry: readRequiredString(form.birthCountry, 'birthCountry'),
    birthLatitude: readOptionalNumber(form.birthLatitude),
    birthLongitude: readOptionalNumber(form.birthLongitude),
    timezone: readOptionalString(form.timezone),
    notes: readOptionalString(form.notes),
  };
  return parsed;
}

function readRequiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Astrology form is missing ${field}.`);
  }
  return value.trim();
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'astrology-report';
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '');
}

function hasCompleteInterpretation(value: string) {
  const sectionMatches = value.match(/##\s*(?:1[0-3]|[1-9])\./g);
  return new Set(sectionMatches ?? []).size >= 13;
}
