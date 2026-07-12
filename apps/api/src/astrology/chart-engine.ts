export interface ChartPlanet {
  name: string;
  longitude: number;
  sign: string;
  degree: number;
  house: number;
}

export interface ChartHouse {
  number: number;
  cusp: number;
  sign: string;
}

export interface ChartAspect {
  planet1: string;
  planet2: string;
  type: string;
  orb: number;
  angle: number;
}

export interface ChartData {
  name: string;
  date: string;
  time: string;
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  coordinateSource: 'provided' | 'fallback';
  planets: ChartPlanet[];
  houses: ChartHouse[];
  aspects: ChartAspect[];
  ascendant: number;
  midheaven: number;
  houseSystem: string;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const PLANETS = [
  { id: 0, name: 'Sun' },
  { id: 1, name: 'Moon' },
  { id: 2, name: 'Mercury' },
  { id: 3, name: 'Venus' },
  { id: 4, name: 'Mars' },
  { id: 5, name: 'Jupiter' },
  { id: 6, name: 'Saturn' },
  { id: 7, name: 'Uranus' },
  { id: 8, name: 'Neptune' },
  { id: 9, name: 'Pluto' },
];

const ASPECTS = [
  { angle: 0, orb: 8, name: 'Conjunction' },
  { angle: 180, orb: 8, name: 'Opposition' },
  { angle: 120, orb: 8, name: 'Trine' },
  { angle: 90, orb: 7, name: 'Square' },
  { angle: 60, orb: 6, name: 'Sextile' },
];

export function generateChartData(input: {
  name: string;
  date: string;
  time: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
}): ChartData {
  const hasCoordinates = Number.isFinite(input.latitude) && Number.isFinite(input.longitude);
  const latitude = hasCoordinates ? Number(input.latitude) : 0;
  const longitude = hasCoordinates ? Number(input.longitude) : 0;
  const timezone = input.timezone?.trim() || '+00:00';
  const dateTime = toUtcDate(input.date, input.time, timezone);
  const jd = julianDay(dateTime);
  const houseData = calculatePlacidusHouses(jd, latitude, longitude);
  const houses = houseData.cusps.slice(1, 13).map((cusp, index) => ({
    number: index + 1,
    cusp: normalizeAngle(cusp),
    sign: getZodiacSign(cusp),
  }));

  const planets = PLANETS.map((planet) => {
    const position = calculatePlanetPosition(jd, planet.id);
    const planetLongitude = normalizeAngle(position.longitude);
    return {
      name: planet.name,
      longitude: planetLongitude,
      sign: getZodiacSign(planetLongitude),
      degree: planetLongitude % 30,
      house: calculateHouseForPlanet(planetLongitude, houses),
    };
  });

  return {
    name: input.name,
    date: input.date,
    time: input.time,
    location: input.location,
    latitude,
    longitude,
    timezone,
    coordinateSource: hasCoordinates ? 'provided' : 'fallback',
    planets,
    houses,
    aspects: calculateAspects(planets),
    ascendant: normalizeAngle(houseData.ascendant),
    midheaven: normalizeAngle(houseData.mc),
    houseSystem: 'Placidus',
  };
}

function toUtcDate(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const match = timezone.match(/([+-])(\d{2}):?(\d{2})?/);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error('Invalid birth date or birth time');
  }

  const sign = match?.[1] || '+';
  const offsetHours = Number(match?.[2] || 0);
  const offsetMinutes = Number(match?.[3] || 0);
  const offset = (offsetHours * 60 + offsetMinutes) * (sign === '-' ? -1 : 1);
  return new Date(Date.UTC(year, month - 1, day, hour, minute - offset, 0, 0));
}

function julianDay(date: Date): number {
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds();

  if (month <= 2) {
    year -= 1;
    month += 12;
  }

  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716))
    + Math.floor(30.6001 * (month + 1))
    + day
    + b
    - 1524.5
    + (hour + minute / 60 + second / 3600) / 24;
}

function calculatePlanetPosition(jd: number, planet: number) {
  const t = (jd - 2451545.0) / 36525;

  if (planet === 0) {
    const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
    const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
    const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m * DEG_TO_RAD)
      + (0.019993 - 0.000101 * t) * Math.sin(2 * m * DEG_TO_RAD)
      + 0.000289 * Math.sin(3 * m * DEG_TO_RAD);
    const omega = 125.04 - 1934.136 * t;
    return { longitude: normalizeAngle(l0 + c - 0.00569 - 0.00478 * Math.sin(omega * DEG_TO_RAD)) };
  }

  const planetData: Record<number, { l: number[]; p: number[]; e: number[]; a: number }> = {
    1: { l: [218.3164, 481267.8813], p: [83.3532, 4069.0137], e: [0.0549, -0.0001], a: 384400 },
    2: { l: [252.2509, 149472.6746], p: [77.4561, 1.5550], e: [0.2056, -0.0006], a: 0.3871 },
    3: { l: [181.9798, 58517.8156], p: [131.5637, 1.4022], e: [0.0068, -0.0005], a: 0.7233 },
    4: { l: [355.4330, 19140.2993], p: [336.0602, 1.8495], e: [0.0934, 0.0009], a: 1.5237 },
    5: { l: [34.3515, 3034.9056], p: [14.3312, 1.6126], e: [0.0484, 0.0001], a: 5.2026 },
    6: { l: [50.0774, 1222.1138], p: [93.0568, 1.9637], e: [0.0542, -0.0003], a: 9.5549 },
    7: { l: [314.0550, 428.4677], p: [173.0051, 1.4863], e: [0.0472, -0.0001], a: 19.2184 },
    8: { l: [304.3487, 218.4862], p: [48.1237, 1.4262], e: [0.0086, 0.0001], a: 30.1104 },
    9: { l: [238.9290, 145.1879], p: [224.0670, 1.3971], e: [0.2488, 0.0000], a: 39.4821 },
  };

  const data = planetData[planet];
  const l = (data.l[0] + data.l[1] * t) % 360;
  const p = data.p[0] + data.p[1] * t;
  const e = data.e[0] + data.e[1] * t;
  const m = (l - p) % 360;
  let eccentricAnomaly = m;

  for (let i = 0; i < 10; i += 1) {
    const er = eccentricAnomaly * DEG_TO_RAD;
    const delta = (eccentricAnomaly - e * RAD_TO_DEG * Math.sin(er) - m) / (1 - e * Math.cos(er));
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 0.0001) break;
  }

  const er = eccentricAnomaly * DEG_TO_RAD;
  const xv = data.a * (Math.cos(er) - e);
  const yv = data.a * (Math.sqrt(1 - e * e) * Math.sin(er));
  return { longitude: normalizeAngle(Math.atan2(yv, xv) * RAD_TO_DEG + p) };
}

function calculatePlacidusHouses(jd: number, lat: number, lon: number) {
  const t = (jd - 2451545.0) / 36525;
  const theta0 = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + t * t * (0.000387933 - t / 38710000);
  const lst = normalizeAngle(theta0 + lon);
  const epsilon = 23.439292 - 0.0130125 * t;
  const epsRad = epsilon * DEG_TO_RAD;
  const lstRad = lst * DEG_TO_RAD;
  const mc = normalizeAngle(Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(epsRad)) * RAD_TO_DEG);
  const latRad = lat * DEG_TO_RAD;
  const asc = normalizeAngle(Math.atan2(
    -Math.sin(lstRad) * Math.cos(epsRad),
    Math.cos(lstRad) * Math.cos(latRad) - Math.sin(epsRad) * Math.sin(latRad),
  ) * RAD_TO_DEG);

  const cusps = [0];
  for (let i = 1; i <= 12; i += 1) {
    cusps.push(normalizeAngle(mc + (i - 10) * 30));
  }
  cusps[1] = asc;
  cusps[10] = mc;
  cusps[4] = normalizeAngle(cusps[10] + 180);
  cusps[7] = normalizeAngle(cusps[1] + 180);
  return { cusps, ascendant: asc, mc };
}

function calculateHouseForPlanet(planetLong: number, houses: ChartHouse[]) {
  for (let i = 0; i < houses.length; i += 1) {
    const current = houses[i];
    const next = houses[(i + 1) % 12];
    if (next.cusp < current.cusp) {
      if (planetLong >= current.cusp || planetLong < next.cusp) return current.number;
    } else if (planetLong >= current.cusp && planetLong < next.cusp) {
      return current.number;
    }
  }
  return 1;
}

function calculateAspects(planets: ChartPlanet[]) {
  const aspects: ChartAspect[] = [];
  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      let angle = Math.abs(planets[i].longitude - planets[j].longitude);
      if (angle > 180) angle = 360 - angle;
      for (const aspect of ASPECTS) {
        const orb = Math.abs(angle - aspect.angle);
        if (orb <= aspect.orb) {
          aspects.push({ planet1: planets[i].name, planet2: planets[j].name, type: aspect.name, angle: aspect.angle, orb });
        }
      }
    }
  }
  return aspects;
}

function getZodiacSign(longitude: number) {
  return ZODIAC_SIGNS[Math.floor(normalizeAngle(longitude) / 30)];
}

function normalizeAngle(angle: number) {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
