import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@pl-cms/db';
import type { Express } from 'express';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { AstrologyReportFormDto } from '../checkout/checkout.dto';
import { AstrologyChartsService } from './astrology-charts.service';
import { PreviewAstrologyChartDto } from './astrology.dto';
import { resolveBirthCoordinates } from './birth-data.util';
import { generateChartData } from './chart-engine';
import { OllamaClient } from './ollama-client';
import { getOllamaSettings } from './ollama-settings.util';
import { getAstrologyReportsDir, sanitizeReportFileName } from './report-storage.util';

@Injectable()
export class AstrologyReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ollama: OllamaClient,
    private readonly chartsService: AstrologyChartsService,
  ) {}

  async testOllamaConnection(overrides?: { ollamaBaseUrl?: string; ollamaModel?: string }) {
    const settings = await this.getSettings();
    return this.ollama.testConnection({
      baseUrl: overrides?.ollamaBaseUrl?.trim() || settings.ollamaBaseUrl,
      model: overrides?.ollamaModel?.trim() || settings.ollamaModel,
    });
  }

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

  /** Marks paid reports as awaiting manual fulfillment by an admin (chart run + PDF upload). */
  async markReportsAwaitingFulfillment(orderId: string, userId: string) {
    await this.prisma.astrologyReport.updateMany({
      where: { orderId, userId, status: { in: ['AWAITING_PAYMENT', 'FAILED'] } },
      data: { status: 'PENDING', errorMessage: null },
    });
  }

  async listAllReports(status?: string) {
    const reports = await this.prisma.astrologyReport.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true } },
        order: { select: { id: true, status: true, createdAt: true } },
      },
      orderBy: { submittedAt: 'asc' },
    });

    return reports.map((report) => {
      try {
        return { ...report, formData: parseAstrologyForm(report.formData) };
      } catch {
        return report;
      }
    });
  }

  async getReportForAdmin(id: string) {
    const report = await this.prisma.astrologyReport.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true } },
        order: { select: { id: true, status: true, createdAt: true } },
      },
    });
    if (!report) throw new NotFoundException('Report not found');
    return { ...report, formData: parseAstrologyForm(report.formData) };
  }

  async uploadReportFile(id: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('A PDF file is required.');
    const report = await this.prisma.astrologyReport.findUnique({ where: { id }, select: { id: true } });
    if (!report) throw new NotFoundException('Report not found');

    const fileName = sanitizeReportFileName(file.filename);
    return this.prisma.astrologyReport.update({
      where: { id },
      data: {
        status: 'READY',
        reportUrl: `/api/proxy/account/downloads/${id}/file`,
        fileName,
        errorMessage: null,
        generatedAt: new Date(),
      },
    });
  }

  async markReportFailed(id: string, message: string) {
    const report = await this.prisma.astrologyReport.findUnique({ where: { id }, select: { id: true } });
    if (!report) throw new NotFoundException('Report not found');
    return this.prisma.astrologyReport.update({
      where: { id },
      data: { status: 'FAILED', errorMessage: message },
    });
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

    const fileName = sanitizeReportFileName(report.fileName);
    const filePath = join(getAstrologyReportsDir(), fileName);
    await access(filePath).catch(() => {
      throw new NotFoundException('Report file not found');
    });

    return { fileName, filePath };
  }

  private getSettings() {
    return getOllamaSettings(this.prisma, this.config);
  }
}

export interface ParsedLifeEvent {
  description: string;
  date: string;
}

export interface ParsedAstrologyForm {
  fullName: string;
  birthDate: string;
  birthTime: string;
  timeUnknown: boolean;
  lifeEvents: ParsedLifeEvent[];
  birthCity: string;
  birthState: string;
  birthCountry: string;
  birthLatitude?: number | null;
  birthLongitude?: number | null;
  timezone?: string | null;
  notes?: string | null;
}

const REQUIRED_LIFE_EVENT_COUNT = 3;

function cleanAstrologyForm(form: AstrologyReportFormDto) {
  const timeUnknown = Boolean(form.timeUnknown);

  if (timeUnknown) {
    const events = (form.lifeEvents ?? []).filter((event) => event.description?.trim() && event.date?.trim());
    if (events.length < REQUIRED_LIFE_EVENT_COUNT) {
      throw new BadRequestException(
        `Please provide ${REQUIRED_LIFE_EVENT_COUNT} significant life events (with dates) when the birth time is unknown.`,
      );
    }
  } else if (!form.birthTime?.trim()) {
    throw new BadRequestException('Birth time is required unless "I don\'t know my birth time" is selected.');
  }

  return {
    productId: form.productId,
    fullName: form.fullName.trim(),
    birthDate: form.birthDate,
    birthTime: timeUnknown ? '' : (form.birthTime ?? '').trim(),
    timeUnknown,
    lifeEvents: timeUnknown
      ? form.lifeEvents!.map((event) => ({ description: event.description.trim(), date: event.date.trim() }))
      : [],
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
  const timeUnknown = form.timeUnknown === true;
  const parsed: ParsedAstrologyForm = {
    fullName: readRequiredString(form.fullName, 'fullName'),
    birthDate: readRequiredString(form.birthDate, 'birthDate'),
    birthTime: readOptionalString(form.birthTime) ?? '',
    timeUnknown,
    lifeEvents: parseLifeEvents(form.lifeEvents),
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

function parseLifeEvents(value: unknown): ParsedLifeEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      description: readOptionalString(entry.description) ?? '',
      date: readOptionalString(entry.date) ?? '',
    }))
    .filter((event) => event.description && event.date);
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

