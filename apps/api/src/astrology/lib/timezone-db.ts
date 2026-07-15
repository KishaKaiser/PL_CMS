export interface TimezoneData {
  name: string;
  offset: string;
  countries: string[];
  dstObserved?: boolean;
  dstOffset?: string;
  dstRules?: string;
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

export const TIMEZONE_DATABASE: Record<string, TimezoneData> = {
  'America/New_York': {
    name: 'Eastern Time', offset: '-05:00', dstObserved: true, dstOffset: '-04:00',
    dstRules: 'Second Sunday in March to First Sunday in November', countries: ['US', 'CA'],
    bounds: { minLat: 24.5, maxLat: 47.5, minLon: -87.5, maxLon: -67 },
  },
  'America/Indiana/Indianapolis': {
    name: 'Eastern Time (Indianapolis)', offset: '-05:00', dstObserved: true, dstOffset: '-04:00',
    dstRules: 'Second Sunday in March to First Sunday in November (since April 2, 2006)', countries: ['US'],
    bounds: { minLat: 38.5, maxLat: 41.5, minLon: -88, maxLon: -84.5 },
  },
  'America/Chicago': {
    name: 'Central Time', offset: '-06:00', dstObserved: true, dstOffset: '-05:00',
    dstRules: 'Second Sunday in March to First Sunday in November', countries: ['US', 'CA', 'MX'],
    bounds: { minLat: 25, maxLat: 49, minLon: -106, maxLon: -87.5 },
  },
  'America/Denver': {
    name: 'Mountain Time', offset: '-07:00', dstObserved: true, dstOffset: '-06:00',
    dstRules: 'Second Sunday in March to First Sunday in November', countries: ['US', 'CA', 'MX'],
    bounds: { minLat: 31, maxLat: 49, minLon: -116, maxLon: -102 },
  },
  'America/Los_Angeles': {
    name: 'Pacific Time', offset: '-08:00', dstObserved: true, dstOffset: '-07:00',
    dstRules: 'Second Sunday in March to First Sunday in November', countries: ['US', 'CA'],
    bounds: { minLat: 32, maxLat: 49, minLon: -125, maxLon: -114 },
  },
  'America/Anchorage': {
    name: 'Alaska Time', offset: '-09:00', dstObserved: true, dstOffset: '-08:00',
    dstRules: 'Second Sunday in March to First Sunday in November', countries: ['US'],
    bounds: { minLat: 51, maxLat: 71, minLon: -180, maxLon: -130 },
  },
  'Pacific/Honolulu': {
    name: 'Hawaii-Aleutian Time', offset: '-10:00', dstObserved: false, countries: ['US'],
    bounds: { minLat: 18, maxLat: 23, minLon: -161, maxLon: -154 },
  },
  'America/Phoenix': {
    name: 'Mountain Time (no DST)', offset: '-07:00', dstObserved: false, countries: ['US'],
    bounds: { minLat: 31, maxLat: 37, minLon: -115, maxLon: -109 },
  },
  'Europe/London': {
    name: 'Greenwich Mean Time', offset: '+00:00', dstObserved: true, dstOffset: '+01:00',
    dstRules: 'Last Sunday in March to Last Sunday in October', countries: ['GB', 'IE'],
    bounds: { minLat: 49.5, maxLat: 61, minLon: -11, maxLon: 2 },
  },
  'Europe/Paris': {
    name: 'Central European Time', offset: '+01:00', dstObserved: true, dstOffset: '+02:00',
    dstRules: 'Last Sunday in March to Last Sunday in October', countries: ['FR', 'ES', 'IT', 'DE', 'NL', 'BE', 'CH', 'AT', 'NO', 'SE', 'DK'],
    bounds: { minLat: 36, maxLat: 71, minLon: -5, maxLon: 24 },
  },
  'Europe/Berlin': {
    name: 'Central European Time', offset: '+01:00', dstObserved: true, dstOffset: '+02:00',
    dstRules: 'Last Sunday in March to Last Sunday in October', countries: ['DE', 'PL', 'CZ', 'SK'],
    bounds: { minLat: 47, maxLat: 55, minLon: 6, maxLon: 24 },
  },
  'Europe/Rome': {
    name: 'Central European Time', offset: '+01:00', dstObserved: true, dstOffset: '+02:00',
    dstRules: 'Last Sunday in March to Last Sunday in October', countries: ['IT'],
    bounds: { minLat: 36, maxLat: 47, minLon: 6, maxLon: 19 },
  },
  'Europe/Madrid': {
    name: 'Central European Time', offset: '+01:00', dstObserved: true, dstOffset: '+02:00',
    dstRules: 'Last Sunday in March to Last Sunday in October', countries: ['ES'],
    bounds: { minLat: 36, maxLat: 44, minLon: -10, maxLon: 5 },
  },
  'Europe/Athens': {
    name: 'Eastern European Time', offset: '+02:00', dstObserved: true, dstOffset: '+03:00',
    dstRules: 'Last Sunday in March to Last Sunday in October', countries: ['GR', 'RO', 'BG'],
    bounds: { minLat: 34, maxLat: 48, minLon: 19, maxLon: 30 },
  },
  'Europe/Helsinki': {
    name: 'Eastern European Time', offset: '+02:00', dstObserved: true, dstOffset: '+03:00',
    dstRules: 'Last Sunday in March to Last Sunday in October', countries: ['FI', 'EE', 'LV', 'LT'],
    bounds: { minLat: 54, maxLat: 70, minLon: 20, maxLon: 32 },
  },
  'Europe/Moscow': {
    name: 'Moscow Time', offset: '+03:00', countries: ['RU'],
    bounds: { minLat: 41, maxLat: 82, minLon: 27, maxLon: 180 },
  },
  'Asia/Dubai': {
    name: 'Gulf Standard Time', offset: '+04:00', countries: ['AE', 'OM'],
    bounds: { minLat: 16, maxLat: 26, minLon: 51, maxLon: 60 },
  },
  'Asia/Karachi': {
    name: 'Pakistan Time', offset: '+05:00', countries: ['PK'],
    bounds: { minLat: 23, maxLat: 37, minLon: 60, maxLon: 78 },
  },
  'Asia/Kolkata': {
    name: 'India Standard Time', offset: '+05:30', countries: ['IN', 'LK'],
    bounds: { minLat: 6, maxLat: 35, minLon: 68, maxLon: 97 },
  },
  'Asia/Dhaka': {
    name: 'Bangladesh Time', offset: '+06:00', countries: ['BD'],
    bounds: { minLat: 20, maxLat: 27, minLon: 88, maxLon: 93 },
  },
  'Asia/Bangkok': {
    name: 'Indochina Time', offset: '+07:00', countries: ['TH', 'VN', 'KH', 'LA'],
    bounds: { minLat: 5, maxLat: 24, minLon: 97, maxLon: 110 },
  },
  'Asia/Singapore': {
    name: 'Singapore Time', offset: '+08:00', countries: ['SG', 'MY'],
    bounds: { minLat: 1, maxLat: 7, minLon: 99, maxLon: 120 },
  },
  'Asia/Shanghai': {
    name: 'China Standard Time', offset: '+08:00', countries: ['CN', 'TW', 'HK', 'MO'],
    bounds: { minLat: 18, maxLat: 54, minLon: 73, maxLon: 135 },
  },
  'Asia/Hong_Kong': {
    name: 'Hong Kong Time', offset: '+08:00', countries: ['HK'],
    bounds: { minLat: 22, maxLat: 23, minLon: 113, maxLon: 115 },
  },
  'Asia/Tokyo': {
    name: 'Japan Standard Time', offset: '+09:00', countries: ['JP'],
    bounds: { minLat: 24, maxLat: 46, minLon: 123, maxLon: 146 },
  },
  'Asia/Seoul': {
    name: 'Korea Standard Time', offset: '+09:00', countries: ['KR'],
    bounds: { minLat: 33, maxLat: 39, minLon: 124, maxLon: 132 },
  },
  'Australia/Sydney': {
    name: 'Australian Eastern Time', offset: '+10:00', dstObserved: true, dstOffset: '+11:00',
    dstRules: 'First Sunday in October to First Sunday in April', countries: ['AU'],
    bounds: { minLat: -44, maxLat: -28, minLon: 141, maxLon: 154 },
  },
  'Australia/Melbourne': {
    name: 'Australian Eastern Time', offset: '+10:00', dstObserved: true, dstOffset: '+11:00',
    dstRules: 'First Sunday in October to First Sunday in April', countries: ['AU'],
    bounds: { minLat: -39, maxLat: -34, minLon: 140, maxLon: 150 },
  },
  'Australia/Brisbane': {
    name: 'Australian Eastern Time (no DST)', offset: '+10:00', dstObserved: false, countries: ['AU'],
    bounds: { minLat: -29, maxLat: -10, minLon: 138, maxLon: 154 },
  },
  'Australia/Perth': {
    name: 'Australian Western Time', offset: '+08:00', dstObserved: false, countries: ['AU'],
    bounds: { minLat: -35, maxLat: -13, minLon: 113, maxLon: 129 },
  },
  'Australia/Adelaide': {
    name: 'Australian Central Time', offset: '+09:30', dstObserved: true, dstOffset: '+10:30',
    dstRules: 'First Sunday in October to First Sunday in April', countries: ['AU'],
    bounds: { minLat: -38, maxLat: -26, minLon: 129, maxLon: 141 },
  },
  'Pacific/Auckland': {
    name: 'New Zealand Time', offset: '+12:00', dstObserved: true, dstOffset: '+13:00',
    dstRules: 'Last Sunday in September to First Sunday in April', countries: ['NZ'],
    bounds: { minLat: -47, maxLat: -34, minLon: 166, maxLon: 179 },
  },
  'America/Sao_Paulo': {
    name: 'Brasilia Time', offset: '-03:00', countries: ['BR'],
    bounds: { minLat: -34, maxLat: -1, minLon: -74, maxLon: -35 },
  },
  'America/Buenos_Aires': {
    name: 'Argentina Time', offset: '-03:00', countries: ['AR'],
    bounds: { minLat: -55, maxLat: -22, minLon: -74, maxLon: -53 },
  },
  'America/Santiago': {
    name: 'Chile Time', offset: '-04:00', countries: ['CL'],
    bounds: { minLat: -56, maxLat: -17, minLon: -76, maxLon: -66 },
  },
  'America/Lima': {
    name: 'Peru Time', offset: '-05:00', countries: ['PE'],
    bounds: { minLat: -18, maxLat: 0, minLon: -82, maxLon: -68 },
  },
  'America/Bogota': {
    name: 'Colombia Time', offset: '-05:00', countries: ['CO'],
    bounds: { minLat: -4, maxLat: 13, minLon: -79, maxLon: -66 },
  },
  'America/Caracas': {
    name: 'Venezuela Time', offset: '-04:00', countries: ['VE'],
    bounds: { minLat: 0, maxLat: 12, minLon: -74, maxLon: -59 },
  },
  'America/Mexico_City': {
    name: 'Central Time (Mexico)', offset: '-06:00', countries: ['MX'],
    bounds: { minLat: 14, maxLat: 33, minLon: -118, maxLon: -86 },
  },
  'America/Tijuana': {
    name: 'Pacific Time (Mexico)', offset: '-08:00', countries: ['MX'],
    bounds: { minLat: 28, maxLat: 33, minLon: -117, maxLon: -109 },
  },
  'America/Toronto': {
    name: 'Eastern Time (Canada)', offset: '-05:00', countries: ['CA'],
    bounds: { minLat: 41, maxLat: 57, minLon: -95, maxLon: -74 },
  },
  'America/Vancouver': {
    name: 'Pacific Time (Canada)', offset: '-08:00', countries: ['CA'],
    bounds: { minLat: 48, maxLat: 60, minLon: -139, maxLon: -114 },
  },
  'America/Halifax': {
    name: 'Atlantic Time', offset: '-04:00', countries: ['CA'],
    bounds: { minLat: 43, maxLat: 47, minLon: -67, maxLon: -59 },
  },
  'Africa/Cairo': {
    name: 'Eastern European Time', offset: '+02:00', countries: ['EG'],
    bounds: { minLat: 22, maxLat: 32, minLon: 25, maxLon: 37 },
  },
  'Africa/Johannesburg': {
    name: 'South Africa Time', offset: '+02:00', countries: ['ZA', 'BW', 'ZW', 'MZ', 'LS', 'SZ'],
    bounds: { minLat: -35, maxLat: -22, minLon: 16, maxLon: 33 },
  },
  'Africa/Lagos': {
    name: 'West Africa Time', offset: '+01:00', countries: ['NG', 'GH', 'CM', 'BJ', 'TG', 'CI'],
    bounds: { minLat: -1, maxLat: 14, minLon: -17, maxLon: 15 },
  },
  'Africa/Nairobi': {
    name: 'East Africa Time', offset: '+03:00', countries: ['KE', 'TZ', 'UG', 'ET', 'SO'],
    bounds: { minLat: -12, maxLat: 15, minLon: 29, maxLon: 52 },
  },
  'Asia/Jerusalem': {
    name: 'Israel Time', offset: '+02:00', countries: ['IL'],
    bounds: { minLat: 29, maxLat: 34, minLon: 34, maxLon: 36 },
  },
  'Asia/Riyadh': {
    name: 'Arabia Standard Time', offset: '+03:00', countries: ['SA', 'KW', 'BH', 'QA', 'YE'],
    bounds: { minLat: 12, maxLat: 32, minLon: 34, maxLon: 56 },
  },
  'Asia/Tehran': {
    name: 'Iran Time', offset: '+03:30', countries: ['IR'],
    bounds: { minLat: 25, maxLat: 40, minLon: 44, maxLon: 64 },
  },
  'Asia/Kabul': {
    name: 'Afghanistan Time', offset: '+04:30', countries: ['AF'],
    bounds: { minLat: 29, maxLat: 39, minLon: 60, maxLon: 75 },
  },
  'Asia/Kathmandu': {
    name: 'Nepal Time', offset: '+05:45', countries: ['NP'],
    bounds: { minLat: 26, maxLat: 31, minLon: 80, maxLon: 89 },
  },
  'Asia/Yangon': {
    name: 'Myanmar Time', offset: '+06:30', countries: ['MM'],
    bounds: { minLat: 9, maxLat: 29, minLon: 92, maxLon: 102 },
  },
  'Asia/Jakarta': {
    name: 'Western Indonesia Time', offset: '+07:00', countries: ['ID'],
    bounds: { minLat: -11, maxLat: 6, minLon: 95, maxLon: 120 },
  },
  'Asia/Makassar': {
    name: 'Central Indonesia Time', offset: '+08:00', countries: ['ID'],
    bounds: { minLat: -8, maxLat: 3, minLon: 117, maxLon: 126 },
  },
  'Asia/Jayapura': {
    name: 'Eastern Indonesia Time', offset: '+09:00', countries: ['ID'],
    bounds: { minLat: -9, maxLat: 1, minLon: 130, maxLon: 141 },
  },
  'Asia/Manila': {
    name: 'Philippine Time', offset: '+08:00', countries: ['PH'],
    bounds: { minLat: 4, maxLat: 21, minLon: 116, maxLon: 127 },
  },
  'Pacific/Fiji': {
    name: 'Fiji Time', offset: '+12:00', countries: ['FJ'],
    bounds: { minLat: -21, maxLat: -12, minLon: 177, maxLon: -177 },
  },
  'Pacific/Guam': {
    name: 'Chamorro Time', offset: '+10:00', countries: ['GU', 'MP'],
    bounds: { minLat: 13, maxLat: 21, minLon: 144, maxLon: 146 },
  },
  'Atlantic/Reykjavik': {
    name: 'Greenwich Mean Time', offset: '+00:00', countries: ['IS'],
    bounds: { minLat: 63, maxLat: 67, minLon: -25, maxLon: -13 },
  },
  'Atlantic/Azores': {
    name: 'Azores Time', offset: '-01:00', countries: ['PT'],
    bounds: { minLat: 36, maxLat: 40, minLon: -32, maxLon: -24 },
  },
  'Atlantic/Cape_Verde': {
    name: 'Cape Verde Time', offset: '-01:00', countries: ['CV'],
    bounds: { minLat: 14, maxLat: 18, minLon: -26, maxLon: -22 },
  },
  'Indian/Mauritius': {
    name: 'Mauritius Time', offset: '+04:00', countries: ['MU'],
    bounds: { minLat: -21, maxLat: -19, minLon: 57, maxLon: 58 },
  },
  'Indian/Maldives': {
    name: 'Maldives Time', offset: '+05:00', countries: ['MV'],
    bounds: { minLat: -1, maxLat: 8, minLon: 72, maxLon: 74 },
  },
};

export function findTimezoneByCoordinates(latitude: number, longitude: number): string {
  let bestMatch: { timezone: string; score: number } | null = null;

  for (const [timezone, data] of Object.entries(TIMEZONE_DATABASE)) {
    if (!data.bounds) continue;

    const { minLat, maxLat, minLon, maxLon } = data.bounds;

    if (latitude >= minLat && latitude <= maxLat && longitude >= minLon && longitude <= maxLon) {
      const latCenter = (minLat + maxLat) / 2;
      const lonCenter = (minLon + maxLon) / 2;
      const latDistance = Math.abs(latitude - latCenter);
      const lonDistance = Math.abs(longitude - lonCenter);
      const distance = Math.sqrt(latDistance ** 2 + lonDistance ** 2);

      let score = 1 / (distance + 0.1);
      if (timezone === 'America/Indiana/Indianapolis') {
        score *= 1.5;
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { timezone, score };
      }
    }
  }

  if (bestMatch) return bestMatch.timezone;

  const lonOffset = Math.round(longitude / 15);
  const sign = lonOffset >= 0 ? '+' : '-';
  const absOffset = Math.abs(lonOffset);
  return `${sign}${absOffset.toString().padStart(2, '0')}:00`;
}

export function getTimezoneOffset(timezone: string): string {
  const data = TIMEZONE_DATABASE[timezone];
  if (data) return data.offset;
  if (timezone.match(/^[+-]\d{2}:\d{2}$/)) return timezone;
  return '+00:00';
}
