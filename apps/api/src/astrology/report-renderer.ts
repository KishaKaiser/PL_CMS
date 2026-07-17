import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ChartData, Planet } from '@pl-cms/shared';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

/** The natal interpretation prompt (see buildOllamaPrompt) asks for exactly 13 numbered sections; treat anything short of that as a failed/truncated generation. */
export function hasCompleteInterpretation(value: string) {
  const sectionMatches = value.match(/##\s*(?:1[0-3]|[1-9])\./g);
  return new Set(sectionMatches ?? []).size >= 13;
}

export async function writeChartPdf(options: {
  chart: ChartData;
  chart2?: ChartData;
  reportText?: string;
  extraLines?: string[];
  reportsDir: string;
  fileName: string;
  includeChartWheel?: boolean;
}) {
  if (options.chart.coordinateSource === 'fallback') {
    throw new Error('The birth location must resolve to valid coordinates before creating the astrology report PDF.');
  }

  await mkdir(options.reportsDir, { recursive: true });

  const includeChartWheel = options.includeChartWheel ?? true;
  const textLines = buildPdfLines(options.chart, options.reportText ?? '', options.extraLines ?? []);
  const pageContents = includeChartWheel
    ? [buildWheelPageContent([options.chart, ...(options.chart2 ? [options.chart2] : [])]), buildTextPageContent(textLines)]
    : [buildTextPageContent(textLines)];

  const pdf = createPdf(pageContents);
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

function buildPdfLines(chart: ChartData, reportText: string, extraLines: string[]) {
  const interpretationLines = reportText
    ? ['', 'Interpretation', ...reportText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)]
    : [];

  return [
    'Psychic Link Astrology Report',
    '',
    ...buildChartSummary(chart),
    ...(extraLines.length ? ['', ...extraLines] : []),
    ...interpretationLines,
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

// ──────────────────────────────────────────────
// PDF construction (hand-rolled: no external PDF library dependency)
// ──────────────────────────────────────────────

function createPdf(pageContents: string[]) {
  const pageCount = pageContents.length;
  const pageObjStart = 3;
  const contentObjStart = pageObjStart + pageCount;
  const fontObjIndex = contentObjStart + pageCount;

  const objects: string[] = [];
  const kids = Array.from({ length: pageCount }, (_, i) => `${pageObjStart + i} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

  for (let i = 0; i < pageCount; i += 1) {
    const contentObjNum = contentObjStart + i;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontObjIndex} 0 R >> >> /Contents ${contentObjNum} 0 R >>`,
    );
  }

  for (const content of pageContents) {
    // Encoding must match the 'binary' encoding used for the final Buffer.from below —
    // Buffer.byteLength's default (utf8) would overcount any non-ASCII character (em
    // dashes, curly quotes, etc. are common in AI-generated report text), corrupting
    // both this /Length value and every xref offset computed further down.
    objects.push(`<< /Length ${Buffer.byteLength(content, 'binary')} >>\nstream\n${content}\nendstream`);
  }

  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function buildTextPageContent(lines: string[]): string {
  const escapedLines = lines.flatMap((line) => wrapLine(line, 92)).map(escapePdfText);
  return [
    'BT',
    '/F1 11 Tf',
    '50 760 Td',
    '14 TL',
    ...escapedLines.map((line, index) => `${index === 0 ? '' : 'T*'}(${line}) Tj`),
    'ET',
  ].join('\n');
}

// ──────────────────────────────────────────────
// Chart wheel vector graphics (drawn directly with PDF path operators —
// no external SVG/canvas dependency, since this runs headless in NestJS).
// Coordinates mirror the geometry in apps/web's ChartWheel.tsx component,
// adapted for PDF's bottom-left-origin, y-up coordinate space.
// ──────────────────────────────────────────────

function buildWheelPageContent(charts: ChartData[]): string {
  const twoUp = charts.length > 1;
  const radius = twoUp ? 130 : 220;
  const centers = twoUp
    ? [
      { x: PAGE_WIDTH * 0.28, y: PAGE_HEIGHT / 2 },
      { x: PAGE_WIDTH * 0.72, y: PAGE_HEIGHT / 2 },
    ]
    : [{ x: PAGE_WIDTH / 2, y: PAGE_HEIGHT / 2 }];

  const ops: string[] = [];
  charts.forEach((chart, index) => {
    const center = centers[index];
    ops.push(...buildWheelOperators(chart, center.x, center.y, radius));
    ops.push('BT', '/F1 13 Tf', `${(center.x - radius).toFixed(2)} ${(center.y + radius + 24).toFixed(2)} Td`, `(${escapePdfText(chart.name)}) Tj`, 'ET');
  });
  return ops.join('\n');
}

function buildWheelOperators(chart: ChartData, cx: number, cy: number, outerRadius: number): string[] {
  const innerRadius = outerRadius * 0.35;
  const houseRadius = outerRadius * 0.75;
  const planetRadius = outerRadius * 0.85;
  const ops: string[] = [];

  ops.push('0.4 0.4 0.4 RG', '1 w', ...circlePath(cx, cy, outerRadius), 'S');
  ops.push(...circlePath(cx, cy, innerRadius), 'S');

  ops.push('0.7 0.7 0.7 RG', '0.5 w');
  for (let i = 0; i < 12; i += 1) {
    const angle = i * 30;
    const inner = polarToCartesianPdf(angle, innerRadius, cx, cy);
    const outer = polarToCartesianPdf(angle, outerRadius, cx, cy);
    ops.push(`${inner.x.toFixed(2)} ${inner.y.toFixed(2)} m`, `${outer.x.toFixed(2)} ${outer.y.toFixed(2)} l`, 'S');
  }

  ops.push('0.15 0.15 0.15 RG', '1.25 w');
  chart.houses.forEach((house) => {
    const inner = polarToCartesianPdf(house.cusp, innerRadius, cx, cy);
    const outer = polarToCartesianPdf(house.cusp, houseRadius, cx, cy);
    ops.push(`${inner.x.toFixed(2)} ${inner.y.toFixed(2)} m`, `${outer.x.toFixed(2)} ${outer.y.toFixed(2)} l`, 'S');
  });

  ops.push('0.6 0.6 0.85 RG', '0.5 w');
  chart.aspects.forEach((aspect) => {
    const p1 = chart.planets.find((p) => p.name === aspect.planet1);
    const p2 = chart.planets.find((p) => p.name === aspect.planet2);
    if (!p1 || !p2) return;
    const pos1 = polarToCartesianPdf(p1.longitude, planetRadius, cx, cy);
    const pos2 = polarToCartesianPdf(p2.longitude, planetRadius, cx, cy);
    ops.push(`${pos1.x.toFixed(2)} ${pos1.y.toFixed(2)} m`, `${pos2.x.toFixed(2)} ${pos2.y.toFixed(2)} l`, 'S');
  });

  chart.planets.forEach((planet) => {
    const pos = polarToCartesianPdf(planet.longitude, planetRadius, cx, cy);
    ops.push('1 1 1 rg', '0 0 0 RG', '0.75 w', ...circlePath(pos.x, pos.y, 9), 'B');
    ops.push(
      'BT',
      '/F1 6 Tf',
      `${(pos.x - 7).toFixed(2)} ${(pos.y - 2.5).toFixed(2)} Td`,
      `(${escapePdfText(planetAbbreviation(planet.name))}) Tj`,
      'ET',
    );
  });

  ops.push('0 0 0 RG', 'BT', '/F1 9 Tf', `${(cx - 12).toFixed(2)} ${(cy - outerRadius - 16).toFixed(2)} Td`, `(ASC ${chart.ascendant.toFixed(1)}) Tj`, 'ET');

  return ops;
}

function polarToCartesianPdf(angle: number, radius: number, cx: number, cy: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
}

/** 4-arc Bezier approximation of a circle (path only — caller appends the paint operator: S/f/B). */
function circlePath(cx: number, cy: number, r: number): string[] {
  const k = r * 0.5522847498;
  const fmt = (n: number) => n.toFixed(2);
  return [
    `${fmt(cx + r)} ${fmt(cy)} m`,
    `${fmt(cx + r)} ${fmt(cy + k)} ${fmt(cx + k)} ${fmt(cy + r)} ${fmt(cx)} ${fmt(cy + r)} c`,
    `${fmt(cx - k)} ${fmt(cy + r)} ${fmt(cx - r)} ${fmt(cy + k)} ${fmt(cx - r)} ${fmt(cy)} c`,
    `${fmt(cx - r)} ${fmt(cy - k)} ${fmt(cx - k)} ${fmt(cy - r)} ${fmt(cx)} ${fmt(cy - r)} c`,
    `${fmt(cx + k)} ${fmt(cy - r)} ${fmt(cx + r)} ${fmt(cy - k)} ${fmt(cx + r)} ${fmt(cy)} c`,
    'h',
  ];
}

const PLANET_ABBREVIATIONS: Record<string, string> = {
  Sun: 'Su',
  Moon: 'Mo',
  Mercury: 'Me',
  Venus: 'Ve',
  Mars: 'Ma',
  Jupiter: 'Ju',
  Saturn: 'Sa',
  Uranus: 'Ur',
  Neptune: 'Ne',
  Pluto: 'Pl',
  Chiron: 'Ch',
  'North Node': 'NN',
  'South Node': 'SN',
  'Part of Fortune': 'PF',
};

function planetAbbreviation(name: string) {
  return PLANET_ABBREVIATIONS[name] || name.slice(0, 2);
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
  // The PDF is written as latin1/binary and uses the base Helvetica font (no
  // embedded Unicode support), so common AI-generated typographic punctuation
  // is transliterated to its ASCII equivalent first — otherwise those code
  // points get truncated to the wrong byte and render as garbled glyphs.
  const asciiSafe = value
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, '\'')
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7E]/g, '?');
  return asciiSafe.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatDegree(value: number) {
  return `${value.toFixed(2)} deg`;
}

function findPlanet(chart: ChartData, name: string): Planet | undefined {
  return chart.planets.find((planet) => planet.name === name);
}

function formatPlacement(planet: Planet | undefined) {
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
