import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChartData } from '@pl-cms/shared';
import { Prisma } from '@pl-cms/db';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaClient } from './ollama-client';
import { getOllamaSettings } from './ollama-settings.util';
import { buildOllamaPrompt, hasCompleteInterpretation, writeChartPdf } from './report-renderer';

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
    const chart = chartData && 'id' in chartData ? (chartData as unknown as ChartData) : undefined;

    if (!chart) {
      throw new BadRequestException('This chart has no computed chart data to render as a PDF.');
    }

    const reportsDir = resolve(this.config.get<string>('ASTROLOGY_REPORTS_DIR') || 'storage/astrology-reports');
    const fileName = `${record.reportType}-${record.id}.pdf`;

    const filePath = await writeChartPdf({
      chart,
      reportText: record.aiText ?? '',
      reportsDir,
      fileName,
    });

    return { fileName, filePath };
  }

  /**
   * Generates (or regenerates) the AI-written natal interpretation for a
   * Chart Library entry, using the exact same Ollama prompt as the paid
   * checkout report flow. Only the free preview text was missing this step —
   * this lets an admin get the full interpretation without a purchase.
   */
  async generateInterpretation(id: string) {
    const record = await this.getChart(id);
    if (record.reportType !== 'natal') {
      throw new BadRequestException('AI interpretation is only available for natal charts.');
    }

    const chart = record.chartData as unknown as ChartData;
    const inputData = record.inputData as unknown as { notes?: string | null } | null;
    const settings = await getOllamaSettings(this.prisma, this.config);
    const prompt = buildOllamaPrompt(chart, inputData?.notes ?? null);
    const text = await this.ollama.generate(prompt, { baseUrl: settings.ollamaBaseUrl, model: settings.ollamaModel });

    if (!text) {
      throw new BadRequestException(
        'The astrology interpretation could not be generated. Check the Ollama URL and model settings, then try again.',
      );
    }
    if (!hasCompleteInterpretation(text)) {
      throw new BadRequestException(
        'The astrology interpretation was incomplete. Try again, or use a larger Ollama model/context window.',
      );
    }

    return this.prisma.astrologyChart.update({
      where: { id },
      data: { aiText: text },
    });
  }

}
