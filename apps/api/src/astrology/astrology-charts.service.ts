import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChartData } from '@pl-cms/shared';
import { Prisma } from '@pl-cms/db';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import {
  BirthDataDto,
  ElectionalDto,
  FamilyChartDto,
  KarmicChartDto,
  KarmicDebtDto,
  RectificationDto,
  SynastryChartDto,
  TransitDto,
} from './astrology.dto';
import { resolveBirthCoordinates, resolveBirthTimezone } from './birth-data.util';
import { generateChartData } from './chart-engine';
import { type EventType, findOptimalTiming } from './lib/electional-calc';
import { generateFamilyAnalysis } from './lib/family-compatibility';
import { calculateKarmicDebt } from './lib/karmic-debt-calc';
import { generateKarmicRelationshipData } from './lib/karmic-calc';
import { rectifyBirthTime } from './lib/rectification';
import { analyzeSoulmateConnection } from './lib/soulmate-detection';
import { generateSynastryData } from './lib/synastry-calc';
import { calculateTransitsForDate } from './lib/transits';
import { OllamaClient } from './ollama-client';
import { getOllamaSettings } from './ollama-settings.util';
import { buildResultSummaryLines, writeChartPdf } from './report-renderer';

@Injectable()
export class AstrologyChartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly ollama: OllamaClient,
  ) {}

  async createChart(options: {
    id?: string;
    createdById: string;
    reportType: string;
    title: string;
    inputData: unknown;
    chartData: unknown;
    resultData?: unknown;
    aiText?: string | null;
  }) {
    return this.prisma.astrologyChart.create({
      data: {
        ...(options.id ? { id: options.id } : {}),
        createdById: options.createdById,
        reportType: options.reportType,
        title: options.title,
        inputData: options.inputData as object,
        chartData: options.chartData as object,
        resultData: (options.resultData ?? Prisma.JsonNull) as object,
        aiText: options.aiText ?? null,
      },
    });
  }

  async listCharts(reportType?: string) {
    return this.prisma.astrologyChart.findMany({
      where: reportType ? { reportType } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        reportType: true,
        title: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getChart(id: string) {
    const chart = await this.prisma.astrologyChart.findUnique({ where: { id } });
    if (!chart) throw new NotFoundException('Chart not found');
    return chart;
  }

  async deleteChart(id: string) {
    await this.getChart(id);
    await this.prisma.astrologyChart.delete({ where: { id } });
    return { deleted: true };
  }

  async exportChartPdf(id: string) {
    const record = await this.getChart(id);
    const chartData = record.chartData as unknown as Record<string, unknown>;

    let chart: ChartData | undefined;
    let chart2: ChartData | undefined;

    if (chartData && 'chart1' in chartData) {
      chart = (chartData as { chart1: ChartData }).chart1;
      chart2 = (chartData as { chart2: ChartData }).chart2;
    } else if (chartData && 'natal' in chartData) {
      chart = (chartData as { natal: ChartData }).natal;
    } else if (chartData && 'bestChart' in chartData && chartData.bestChart) {
      chart = (chartData as { bestChart: ChartData }).bestChart;
    } else if (chartData && 'id' in chartData) {
      chart = chartData as unknown as ChartData;
    }

    if (!chart) {
      throw new BadRequestException('This chart has no computed chart data to render as a PDF.');
    }

    const reportsDir = resolve(this.config.get<string>('ASTROLOGY_REPORTS_DIR') || 'storage/astrology-reports');
    const fileName = `${record.reportType}-${record.id}.pdf`;
    const extraLines = buildResultSummaryLines(record.reportType, record.resultData);

    const filePath = await writeChartPdf({
      chart,
      chart2,
      reportText: record.aiText ?? '',
      extraLines,
      reportsDir,
      fileName,
    });

    return { fileName, filePath };
  }

  async createSynastryChart(userId: string, dto: SynastryChartDto) {
    const chart1 = await this.buildChart(dto.person1);
    const chart2 = await this.buildChart(dto.person2);
    const synastry = generateSynastryData(chart1, chart2, dto.relationshipType);
    const soulmate = analyzeSoulmateConnection(chart1, chart2, synastry.aspects);

    return this.createChart({
      createdById: userId,
      reportType: 'synastry',
      title: `${chart1.name} & ${chart2.name} — Synastry`,
      inputData: dto,
      chartData: { chart1, chart2 },
      resultData: { ...synastry, soulmate },
    });
  }

  async createKarmicChart(userId: string, dto: KarmicChartDto) {
    const chart1 = await this.buildChart(dto.person1);
    const chart2 = await this.buildChart(dto.person2);
    const result = generateKarmicRelationshipData(chart1, chart2);

    return this.createChart({
      createdById: userId,
      reportType: 'karmic',
      title: `${chart1.name} & ${chart2.name} — Karmic Relationship`,
      inputData: dto,
      chartData: { chart1, chart2 },
      resultData: result,
    });
  }

  async createKarmicDebtChart(userId: string, dto: KarmicDebtDto) {
    const chart = await this.buildChart(dto.birthData);
    const settings = await getOllamaSettings(this.prisma, this.config);
    const result = await calculateKarmicDebt(
      chart,
      dto.birthName,
      (prompt) => this.ollama.generate(prompt, { baseUrl: settings.ollamaBaseUrl, model: settings.ollamaModel }),
    );

    return this.createChart({
      createdById: userId,
      reportType: 'karmic_debt',
      title: `${chart.name} — Karmic Debt`,
      inputData: dto,
      chartData: chart,
      resultData: result,
      aiText: result.aiGuidance ?? null,
    });
  }

  async createFamilyChart(userId: string, dto: FamilyChartDto) {
    const chart1 = await this.buildChart(dto.person1);
    const chart2 = await this.buildChart(dto.person2);
    const result = generateFamilyAnalysis(chart1, chart2, dto.relationType);

    return this.createChart({
      createdById: userId,
      reportType: 'family',
      title: `${chart1.name} & ${chart2.name} — Family (${dto.relationType})`,
      inputData: dto,
      chartData: { chart1, chart2 },
      resultData: result,
    });
  }

  async createTransitChart(userId: string, dto: TransitDto) {
    let natalChart: ChartData;

    if (dto.chartId) {
      const existing = await this.getChart(dto.chartId);
      if (existing.reportType !== 'natal') {
        throw new BadRequestException('Transits require a natal chart id.');
      }
      natalChart = existing.chartData as unknown as ChartData;
    } else if (dto.birthData) {
      natalChart = await this.buildChart(dto.birthData);
    } else {
      throw new BadRequestException('Provide either chartId or birthData.');
    }

    const asOfDate = dto.asOfDate ? new Date(dto.asOfDate) : new Date();
    const transitData = calculateTransitsForDate(natalChart, asOfDate);

    return this.createChart({
      createdById: userId,
      reportType: 'transit',
      title: `${natalChart.name} — Transits (${asOfDate.toISOString().slice(0, 10)})`,
      inputData: dto,
      chartData: { natal: natalChart },
      resultData: transitData,
    });
  }

  async createElectionalChart(userId: string, dto: ElectionalDto) {
    const timezone = dto.timezone?.trim() || resolveBirthTimezone(dto.latitude, dto.longitude, dto.startDate);
    const analysis = await findOptimalTiming({
      eventType: dto.eventType as EventType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      location: dto.location,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezone,
      avoidRetrograde: dto.avoidRetrograde,
    });

    return this.createChart({
      createdById: userId,
      reportType: 'electional',
      title: `${dto.eventType.replace(/_/g, ' ')} — Best Timing`,
      inputData: dto,
      chartData: { bestChart: analysis.bestDate?.chart ?? null },
      resultData: analysis,
    });
  }

  async createRectificationChart(userId: string, dto: RectificationDto) {
    const resolved = await resolveBirthCoordinates({
      city: dto.city,
      state: dto.state,
      country: dto.country,
      date: dto.birthDate,
      latitude: dto.latitude,
      longitude: dto.longitude,
      timezoneOverride: dto.timezone,
    });
    const settings = await getOllamaSettings(this.prisma, this.config);
    const events = dto.events.map((event, index) => ({
      id: String(index),
      type: event.type,
      date: event.date,
      description: event.description ?? '',
    }));

    const results = await rectifyBirthTime(
      dto.birthDate,
      resolved.location,
      resolved.latitude,
      resolved.longitude,
      resolved.timezone,
      events,
      (prompt) => this.ollama.generate(prompt, { baseUrl: settings.ollamaBaseUrl, model: settings.ollamaModel }, { json: true }),
    );

    return this.createChart({
      createdById: userId,
      reportType: 'rectification',
      title: `Birth Time Rectification — ${dto.birthDate}`,
      inputData: dto,
      chartData: {},
      resultData: results,
    });
  }

  private async buildChart(birthData: BirthDataDto): Promise<ChartData> {
    const resolved = await resolveBirthCoordinates({
      city: birthData.city,
      state: birthData.state,
      country: birthData.country,
      date: birthData.date,
      time: birthData.time,
      latitude: birthData.latitude,
      longitude: birthData.longitude,
      timezoneOverride: birthData.timezone,
    });

    return generateChartData({
      name: birthData.name,
      date: birthData.date,
      time: birthData.time,
      location: resolved.location,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      timezone: resolved.timezone,
      coordinateSource: resolved.coordinateSource,
      notes: birthData.notes,
    });
  }
}
