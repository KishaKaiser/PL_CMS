import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChartData } from './chart-engine';

export async function writeChartPdf(options: {
  chart: ChartData;
  reportText: string;
  reportsDir: string;
  fileName: string;
}) {
  if (options.chart.coordinateSource === 'fallback') {
    throw new Error('The birth location must resolve to valid coordinates before creating the astrology report PDF.');
  }

  await mkdir(options.reportsDir, { recursive: true });
  const lines = buildPdfLines(options.chart, options.reportText);
  const pdf = createSimplePdf(lines);
  const filePath = join(options.reportsDir, options.fileName);
  await writeFile(filePath, pdf);
  return filePath;
}

export function buildOllamaPrompt(chart: ChartData, notes?: string | null) {
  const sun = findPlanet(chart, 'Sun');
  const moon = findPlanet(chart, 'Moon');
  const mercury = findPlanet(chart, 'Mercury');
  const venus = findPlanet(chart, 'Venus');
  const mars = findPlanet(chart, 'Mars');
  const jupiter = findPlanet(chart, 'Jupiter');
  const saturn = findPlanet(chart, 'Saturn');
  const uranus = findPlanet(chart, 'Uranus');
  const neptune = findPlanet(chart, 'Neptune');
  const pluto = findPlanet(chart, 'Pluto');
  const risingSign = chart.houses.find((house) => house.number === 1)?.sign || 'Unknown';
  const mcSign = chart.houses.find((house) => house.number === 10)?.sign || 'Unknown';
  const elementCount = countElements(chart);
  const modalityCount = countModalities(chart);
  const aspectList = chart.aspects.length
    ? chart.aspects.map((aspect) => `${aspect.planet1} ${aspect.type} ${aspect.planet2} (orb: ${aspect.orb.toFixed(2)} deg)`).join('\n')
    : 'No major aspects found within the configured orbs.';
  const chartData = [
    `Birth Data: ${chart.name}, ${chart.date} at ${chart.time}, ${chart.location}`,
    `Coordinates: ${chart.latitude.toFixed(4)}, ${chart.longitude.toFixed(4)} (${chart.coordinateSource})`,
    `Ascendant: ${risingSign} ${chart.ascendant.toFixed(1)} deg | MC: ${mcSign} ${chart.midheaven.toFixed(1)} deg`,
    '',
    `Planets: Sun ${formatPlacement(sun)}, Moon ${formatPlacement(moon)}, Mercury ${formatPlacement(mercury)}, Venus ${formatPlacement(venus)}, Mars ${formatPlacement(mars)}, Jupiter ${formatPlacement(jupiter)}, Saturn ${formatPlacement(saturn)}, Uranus ${formatPlacement(uranus)}, Neptune ${formatPlacement(neptune)}, Pluto ${formatPlacement(pluto)}`,
    '',
    `Elements: Fire ${elementCount.Fire}, Earth ${elementCount.Earth}, Air ${elementCount.Air}, Water ${elementCount.Water}`,
    `Modalities: Cardinal ${modalityCount.Cardinal}, Fixed ${modalityCount.Fixed}, Mutable ${modalityCount.Mutable}`,
    '',
    `Major Aspects:\n${aspectList}`,
    notes ? `Client notes: ${notes}` : '',
  ].filter(Boolean).join('\n');

  return [
    'You are an expert professional astrologer writing a paid Psychic Link Charts natal report.',
    'Generate a complete, readable report for a general audience. Do not mention that you are an AI. Do not invent missing birth data.',
    'The report must include all 13 sections below, using the exact markdown headings shown. Each section should be 3-4 detailed paragraphs in a warm, professional tone.',
    '',
    chartData,
    '',
    '## 1. CHART OVERVIEW & DOMINANT THEMES',
    `Analyze the overall chart energy. Discuss dominant elements (Fire ${elementCount.Fire}, Earth ${elementCount.Earth}, Air ${elementCount.Air}, Water ${elementCount.Water}) and modalities (Cardinal ${modalityCount.Cardinal}, Fixed ${modalityCount.Fixed}, Mutable ${modalityCount.Mutable}).`,
    '',
    '## 2. CORE IDENTITY: SUN, MOON & RISING',
    `Sun in ${sun?.sign} House ${sun?.house}, Moon in ${moon?.sign} House ${moon?.house}, and Rising ${risingSign} at ${chart.ascendant.toFixed(1)} deg. Explain how these three create the essential nature.`,
    '',
    '## 3. COMMUNICATION & INTELLECT: MERCURY',
    `Mercury in ${mercury?.sign} House ${mercury?.house}: discuss communication style, thinking patterns, learning preferences, and how they share ideas.`,
    '',
    '## 4. LOVE & VALUES: VENUS',
    `Venus in ${venus?.sign} House ${venus?.house}: discuss love language, values, aesthetic preferences, pleasure, and relational harmony.`,
    '',
    '## 5. ACTION & DESIRE: MARS',
    `Mars in ${mars?.sign} House ${mars?.house}: discuss drive, assertiveness, anger expression, desire, and motivation.`,
    '',
    '## 6. EXPANSION & WISDOM: JUPITER',
    `Jupiter in ${jupiter?.sign} House ${jupiter?.house}: discuss growth, beliefs, optimism, luck, teaching gifts, and expansion of consciousness.`,
    '',
    '## 7. DISCIPLINE & LESSONS: SATURN',
    `Saturn in ${saturn?.sign} House ${saturn?.house}: discuss responsibilities, fears, discipline, karmic patterns, limits to overcome, and mastery over time.`,
    '',
    '## 8. TRANSFORMATION & OUTER PLANETS',
    `Uranus in ${uranus?.sign} House ${uranus?.house}, Neptune in ${neptune?.sign} House ${neptune?.house}, and Pluto in ${pluto?.sign} House ${pluto?.house}: discuss awakening, spirituality, imagination, shadow work, power, and transformation.`,
    '',
    '## 9. ASPECT PATTERNS & DYNAMICS',
    'Analyze the major aspects and internal dynamics. Discuss tensions, harmonies, talent configurations, and how different parts of the personality interact.',
    '',
    '## 10. LIFE PATH & CAREER',
    `MC in ${mcSign} at ${chart.midheaven.toFixed(1)} deg: discuss career path, public role, reputation, vocational direction, resources, and daily work.`,
    '',
    '## 11. RELATIONSHIPS & PARTNERSHIPS',
    'Analyze 7th house themes, Venus-Mars dynamics, romantic partnership patterns, marriage indicators, business partnerships, gifts, and challenges.',
    '',
    '## 12. SOUL PURPOSE & SPIRITUAL PATH',
    'Synthesize soul purpose, spiritual gifts, psychic abilities, past-life indicators, and areas for conscious evolution.',
    '',
    '## 13. PRACTICAL GUIDANCE & INTEGRATION',
    'Provide concrete, actionable advice for shadow work, gifts to develop, life areas requiring attention, practices that support growth, and integration of the full chart.',
  ].join('\n');
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
  const coordinateNote = `Coordinates: ${chart.latitude.toFixed(4)}, ${chart.longitude.toFixed(4)} (${chart.coordinateSource})`;

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

function findPlanet(chart: ChartData, name: string) {
  return chart.planets.find((planet) => planet.name === name);
}

function formatPlacement(planet: ReturnType<typeof findPlanet>) {
  return planet ? `${planet.sign} H${planet.house}` : 'unknown';
}

function countElements(chart: ChartData) {
  const counts = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  chart.planets.forEach((planet) => {
    if (['Aries', 'Leo', 'Sagittarius'].includes(planet.sign)) counts.Fire += 1;
    if (['Taurus', 'Virgo', 'Capricorn'].includes(planet.sign)) counts.Earth += 1;
    if (['Gemini', 'Libra', 'Aquarius'].includes(planet.sign)) counts.Air += 1;
    if (['Cancer', 'Scorpio', 'Pisces'].includes(planet.sign)) counts.Water += 1;
  });
  return counts;
}

function countModalities(chart: ChartData) {
  const counts = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  chart.planets.forEach((planet) => {
    if (['Aries', 'Cancer', 'Libra', 'Capricorn'].includes(planet.sign)) counts.Cardinal += 1;
    if (['Taurus', 'Leo', 'Scorpio', 'Aquarius'].includes(planet.sign)) counts.Fixed += 1;
    if (['Gemini', 'Virgo', 'Sagittarius', 'Pisces'].includes(planet.sign)) counts.Mutable += 1;
  });
  return counts;
}
