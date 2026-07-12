import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChartData } from './chart-engine';

export async function writeChartPdf(options: {
  chart: ChartData;
  reportText: string;
  reportsDir: string;
  fileName: string;
}) {
  await mkdir(options.reportsDir, { recursive: true });
  const lines = buildPdfLines(options.chart, options.reportText);
  const pdf = createSimplePdf(lines);
  const filePath = join(options.reportsDir, options.fileName);
  await writeFile(filePath, pdf);
  return filePath;
}

export function buildFallbackReportText(chart: ChartData) {
  const sun = chart.planets.find((planet) => planet.name === 'Sun');
  const moon = chart.planets.find((planet) => planet.name === 'Moon');
  const mercury = chart.planets.find((planet) => planet.name === 'Mercury');
  const venus = chart.planets.find((planet) => planet.name === 'Venus');
  const mars = chart.planets.find((planet) => planet.name === 'Mars');
  const strongestAspects = chart.aspects.slice(0, 6);

  return [
    `${chart.name}'s chart centers on ${sun ? `a ${sun.sign} Sun in House ${sun.house}` : 'the solar life path'}, with emotional needs shaped by ${moon ? `a ${moon.sign} Moon in House ${moon.house}` : 'the Moon placement'}.`,
    mercury ? `Mercury in ${mercury.sign} points to a communication style that works through ${mercury.sign} themes and House ${mercury.house} concerns.` : '',
    venus ? `Venus in ${venus.sign} describes affection, attraction, and values through House ${venus.house}.` : '',
    mars ? `Mars in ${mars.sign} shows how motivation and desire are expressed, especially around House ${mars.house} matters.` : '',
    strongestAspects.length
      ? `Key aspect patterns include ${strongestAspects.map((aspect) => `${aspect.planet1} ${aspect.type} ${aspect.planet2}`).join(', ')}.`
      : 'No major aspects were found within the configured orbs, so house and sign placements carry extra interpretive weight.',
    'Use this chart as a foundation for a fuller intuitive reading, with special attention to repeated signs, emphasized houses, and the relationship between the Sun, Moon, Ascendant, and Midheaven.',
  ].filter(Boolean).join('\n\n');
}

export function buildOllamaPrompt(chart: ChartData, notes?: string | null) {
  return [
    'Write a professional astrology report for this natal chart.',
    'Use a warm, practical tone. Include strengths, growth themes, emotional patterns, relationship style, and life direction.',
    'Do not mention that you are an AI. Do not invent missing birth data.',
    '',
    ...buildChartSummary(chart),
    notes ? `Client notes: ${notes}` : '',
  ].filter(Boolean).join('\n');
}

function buildPdfLines(chart: ChartData, reportText: string) {
  return [
    'Psychic Link Astrology Report',
    '',
    ...buildChartSummary(chart),
    '',
    'Interpretation',
    ...reportText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
  ];
}

function buildChartSummary(chart: ChartData) {
  const coordinateNote = chart.coordinateSource === 'fallback'
    ? 'Coordinates could not be resolved. House placements use 0,0 and should be reviewed.'
    : `Coordinates: ${chart.latitude.toFixed(4)}, ${chart.longitude.toFixed(4)} (${chart.coordinateSource})`;

  return [
    `Name: ${chart.name}`,
    `Birth date: ${chart.date}`,
    `Birth time: ${chart.time} (${chart.timezone})`,
    `Birth location: ${chart.location}`,
    coordinateNote,
    `House system: ${chart.houseSystem}`,
    `Ascendant: ${formatDegree(chart.ascendant)}`,
    `Midheaven: ${formatDegree(chart.midheaven)}`,
    '',
    'Planet Positions',
    ...chart.planets.map((planet) => `${planet.name}: ${planet.degree.toFixed(2)} ${planet.sign}, House ${planet.house}`),
    '',
    'House Cusps',
    ...chart.houses.map((house) => `House ${house.number}: ${formatDegree(house.cusp)} ${house.sign}`),
    '',
    'Major Aspects',
    ...(chart.aspects.length
      ? chart.aspects.map((aspect) => `${aspect.planet1} ${aspect.type} ${aspect.planet2} (orb ${aspect.orb.toFixed(2)})`)
      : ['No major aspects found within the configured orbs.']),
  ];
}

function createSimplePdf(lines: string[]) {
  const objects: string[] = [];
  const escapedLines = lines.flatMap((line) => wrapLine(line, 92)).map(escapePdfText);
  const content = [
    'BT',
    '/F1 11 Tf',
    '50 760 Td',
    '14 TL',
    ...escapedLines.map((line, index) => `${index === 0 ? '' : 'T*'}(${line}) Tj`),
    'ET',
  ].join('\n');

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function wrapLine(line: string, maxLength: number) {
  if (line.length <= maxLength) return [line];
  const words = line.split(' ');
  const wrapped: string[] = [];
  let current = '';
  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxLength) {
      if (current) wrapped.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatDegree(value: number) {
  return `${value.toFixed(2)} deg`;
}
