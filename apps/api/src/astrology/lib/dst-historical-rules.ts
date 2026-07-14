export interface DSTHistoricalRule {
  startYear: number;
  endYear?: number;
  startMonth: number;
  startRule: { type: 'date'; day: number } | { type: 'week'; week: number; weekday: number } | { type: 'lastWeekday'; weekday: number };
  startTime: number;
  endMonth: number;
  endRule: { type: 'date'; day: number } | { type: 'week'; week: number; weekday: number } | { type: 'lastWeekday'; weekday: number };
  endTime: number;
  offset: number;
  description: string;
}

export interface RegionalDSTHistory {
  region: string;
  timezones: string[];
  rules: DSTHistoricalRule[];
  notes?: string;
}

export const DST_HISTORICAL_RULES: RegionalDSTHistory[] = [
  {
    region: 'Indiana (Indianapolis)',
    timezones: ['America/Indiana/Indianapolis', 'America/Indianapolis'],
    notes: 'Indianapolis/Indiana did not observe DST from 1970 until April 2, 2006',
    rules: [
      {
        startYear: 2006, startMonth: 2, startRule: { type: 'week', week: 2, weekday: 0 }, startTime: 2,
        endMonth: 10, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 2, offset: 1,
        description: 'Indiana adopted DST starting April 2, 2006 (Energy Policy Act of 2005)',
      },
      {
        startYear: 1970, endYear: 2005, startMonth: 0, startRule: { type: 'date', day: 1 }, startTime: 0,
        endMonth: 11, endRule: { type: 'date', day: 31 }, endTime: 23, offset: 0,
        description: 'Indiana did not observe DST (year-round Eastern Standard Time)',
      },
    ],
  },
  {
    region: 'United States',
    timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage'],
    notes: 'US DST history is complex with multiple federal acts and state variations',
    rules: [
      {
        startYear: 2007, startMonth: 2, startRule: { type: 'week', week: 2, weekday: 0 }, startTime: 2,
        endMonth: 10, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 2, offset: 1,
        description: 'Energy Policy Act of 2005 (implemented 2007-present)',
      },
      {
        startYear: 1987, endYear: 2006, startMonth: 3, startRule: { type: 'week', week: 1, weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Uniform Time Act amendments (1987-2006)',
      },
      {
        startYear: 1974, endYear: 1975, startMonth: 0, startRule: { type: 'date', day: 6 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Emergency Daylight Saving Time Energy Conservation Act (1974-1975)',
      },
      {
        startYear: 1967, endYear: 1973, startMonth: 3, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Uniform Time Act of 1966 (1967-1973)',
      },
      {
        startYear: 1945, endYear: 1966, startMonth: 3, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 8, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Post-WWII varied local DST (not federally standardized)',
      },
      {
        startYear: 1942, endYear: 1945, startMonth: 1, startRule: { type: 'date', day: 9 }, startTime: 2,
        endMonth: 8, endRule: { type: 'date', day: 30 }, endTime: 2, offset: 1,
        description: 'War Time (year-round DST during WWII)',
      },
      {
        startYear: 1918, endYear: 1919, startMonth: 2, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Standard Time Act of 1918 (WWI-era DST)',
      },
    ],
  },
  {
    region: 'United Kingdom',
    timezones: ['Europe/London'],
    notes: 'UK has a complex history including double summer time during wartime',
    rules: [
      {
        startYear: 1996, startMonth: 2, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 1,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 1, offset: 1,
        description: 'EU harmonized summer time (1996-present)',
      },
      {
        startYear: 1981, endYear: 1995, startMonth: 2, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 1,
        endMonth: 9, endRule: { type: 'week', week: 4, weekday: 0 }, endTime: 1, offset: 1,
        description: 'British Summer Time directive (1981-1995)',
      },
      {
        startYear: 1972, endYear: 1980, startMonth: 2, startRule: { type: 'week', week: 3, weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'week', week: 4, weekday: 0 }, endTime: 2, offset: 1,
        description: 'British Summer Time (1972-1980)',
      },
      {
        startYear: 1968, endYear: 1971, startMonth: 0, startRule: { type: 'date', day: 1 }, startTime: 0,
        endMonth: 11, endRule: { type: 'date', day: 31 }, endTime: 23, offset: 1,
        description: 'British Standard Time experiment (year-round BST, 1968-1971)',
      },
      {
        startYear: 1916, endYear: 1939, startMonth: 4, startRule: { type: 'week', week: 3, weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 2, offset: 1,
        description: 'Original British Summer Time (1916-1939)',
      },
    ],
  },
  {
    region: 'European Union',
    timezones: ['Europe/Paris', 'Europe/Berlin', 'Europe/Rome', 'Europe/Madrid', 'Europe/Athens', 'Europe/Helsinki'],
    notes: 'EU countries harmonized DST rules in 1996',
    rules: [
      {
        startYear: 1996, startMonth: 2, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 1,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 1, offset: 1,
        description: 'EU harmonized summer time (1996-present)',
      },
      {
        startYear: 1981, endYear: 1995, startMonth: 2, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 1,
        endMonth: 8, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 1, offset: 1,
        description: 'EU summer time directive (1981-1995)',
      },
      {
        startYear: 1977, endYear: 1980, startMonth: 3, startRule: { type: 'week', week: 1, weekday: 0 }, startTime: 1,
        endMonth: 8, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 1, offset: 1,
        description: 'Initial EU summer time coordination (1977-1980)',
      },
    ],
  },
  {
    region: 'Australia',
    timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Adelaide'],
    notes: 'Australian states have different DST adoption histories',
    rules: [
      {
        startYear: 2008, startMonth: 9, startRule: { type: 'week', week: 1, weekday: 0 }, startTime: 2,
        endMonth: 3, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 3, offset: 1,
        description: 'Current Australian DST (2008-present)',
      },
      {
        startYear: 2001, endYear: 2007, startMonth: 9, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 2, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 3, offset: 1,
        description: 'Extended DST for Sydney Olympics (2000-2007)',
      },
      {
        startYear: 1986, endYear: 2000, startMonth: 9, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 2, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 3, offset: 1,
        description: 'Standardized Australian DST (1986-2000)',
      },
      {
        startYear: 1971, endYear: 1985, startMonth: 9, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 2, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 3, offset: 1,
        description: 'Early Australian DST (varied by state)',
      },
    ],
  },
  {
    region: 'New Zealand',
    timezones: ['Pacific/Auckland'],
    notes: 'New Zealand has observed DST since 1974',
    rules: [
      {
        startYear: 2007, startMonth: 8, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 3, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 3, offset: 1,
        description: 'Extended DST period (2007-present)',
      },
      {
        startYear: 1990, endYear: 2006, startMonth: 9, startRule: { type: 'week', week: 1, weekday: 0 }, startTime: 2,
        endMonth: 2, endRule: { type: 'week', week: 3, weekday: 0 }, endTime: 3, offset: 1,
        description: 'Standard DST period (1990-2006)',
      },
      {
        startYear: 1974, endYear: 1989, startMonth: 9, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 2, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 3, offset: 1,
        description: 'Initial DST adoption (1974-1989)',
      },
    ],
  },
  {
    region: 'Canada',
    timezones: ['America/Toronto', 'America/Vancouver', 'America/Halifax'],
    notes: 'Canada generally follows US DST rules but with provincial variations',
    rules: [
      {
        startYear: 2007, startMonth: 2, startRule: { type: 'week', week: 2, weekday: 0 }, startTime: 2,
        endMonth: 10, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 2, offset: 1,
        description: 'Aligned with US Energy Policy Act (2007-present)',
      },
      {
        startYear: 1987, endYear: 2006, startMonth: 3, startRule: { type: 'week', week: 1, weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Following US rules (1987-2006)',
      },
      {
        startYear: 1974, endYear: 1986, startMonth: 3, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Provincial variations (1974-1986)',
      },
    ],
  },
  {
    region: 'Russia',
    timezones: ['Europe/Moscow'],
    notes: 'Russia has undergone multiple DST policy changes',
    rules: [
      {
        startYear: 2014, startMonth: 0, startRule: { type: 'date', day: 1 }, startTime: 0,
        endMonth: 11, endRule: { type: 'date', day: 31 }, endTime: 23, offset: 0,
        description: 'Permanent standard time (2014-present, no DST)',
      },
      {
        startYear: 2011, endYear: 2013, startMonth: 0, startRule: { type: 'date', day: 1 }, startTime: 0,
        endMonth: 11, endRule: { type: 'date', day: 31 }, endTime: 23, offset: 1,
        description: 'Permanent DST experiment (2011-2013)',
      },
      {
        startYear: 1996, endYear: 2010, startMonth: 2, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 3, offset: 1,
        description: 'Post-Soviet DST (1996-2010)',
      },
    ],
  },
  {
    region: 'Brazil',
    timezones: ['America/Sao_Paulo'],
    notes: 'Brazil discontinued DST in 2019',
    rules: [
      {
        startYear: 2019, startMonth: 0, startRule: { type: 'date', day: 1 }, startTime: 0,
        endMonth: 11, endRule: { type: 'date', day: 31 }, endTime: 23, offset: 0,
        description: 'DST abolished (2019-present)',
      },
      {
        startYear: 2008, endYear: 2018, startMonth: 9, startRule: { type: 'week', week: 3, weekday: 0 }, startTime: 0,
        endMonth: 1, endRule: { type: 'week', week: 3, weekday: 0 }, endTime: 0, offset: 1,
        description: 'Standardized Brazilian DST (2008-2018)',
      },
      {
        startYear: 1985, endYear: 2007, startMonth: 9, startRule: { type: 'week', week: 2, weekday: 0 }, startTime: 0,
        endMonth: 1, endRule: { type: 'week', week: 2, weekday: 0 }, endTime: 0, offset: 1,
        description: 'Earlier Brazilian DST (1985-2007, varied annually)',
      },
    ],
  },
  {
    region: 'Chile',
    timezones: ['America/Santiago'],
    notes: 'Chile has modified DST rules multiple times',
    rules: [
      {
        startYear: 2019, startMonth: 8, startRule: { type: 'week', week: 1, weekday: 6 }, startTime: 24,
        endMonth: 3, endRule: { type: 'week', week: 1, weekday: 6 }, endTime: 24, offset: 1,
        description: 'Current Chilean DST (2019-present)',
      },
      {
        startYear: 2016, endYear: 2018, startMonth: 7, startRule: { type: 'week', week: 2, weekday: 6 }, startTime: 24,
        endMonth: 4, endRule: { type: 'week', week: 2, weekday: 6 }, endTime: 24, offset: 1,
        description: 'Modified DST period (2016-2018)',
      },
      {
        startYear: 2011, endYear: 2015, startMonth: 7, startRule: { type: 'week', week: 3, weekday: 6 }, startTime: 24,
        endMonth: 4, endRule: { type: 'week', week: 1, weekday: 6 }, endTime: 24, offset: 1,
        description: 'Extended DST (2011-2015)',
      },
      {
        startYear: 1999, endYear: 2010, startMonth: 9, startRule: { type: 'week', week: 2, weekday: 6 }, startTime: 24,
        endMonth: 2, endRule: { type: 'week', week: 2, weekday: 6 }, endTime: 24, offset: 1,
        description: 'Standard Chilean DST (1999-2010)',
      },
    ],
  },
  {
    region: 'Mexico',
    timezones: ['America/Mexico_City', 'America/Tijuana'],
    notes: 'Mexico abolished DST in 2022 except in border regions',
    rules: [
      {
        startYear: 2022, startMonth: 0, startRule: { type: 'date', day: 1 }, startTime: 0,
        endMonth: 11, endRule: { type: 'date', day: 31 }, endTime: 23, offset: 0,
        description: 'DST abolished except border regions (2022-present)',
      },
      {
        startYear: 2007, endYear: 2021, startMonth: 2, startRule: { type: 'week', week: 2, weekday: 0 }, startTime: 2,
        endMonth: 10, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 2, offset: 1,
        description: 'Aligned with US rules (2007-2021)',
      },
      {
        startYear: 1996, endYear: 2006, startMonth: 3, startRule: { type: 'week', week: 1, weekday: 0 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Earlier Mexican DST (1996-2006)',
      },
    ],
  },
  {
    region: 'Israel',
    timezones: ['Asia/Jerusalem'],
    notes: 'Israel DST dates vary based on Hebrew calendar and legislation',
    rules: [
      {
        startYear: 2013, startMonth: 2, startRule: { type: 'lastWeekday', weekday: 5 }, startTime: 2,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 2, offset: 1,
        description: 'Current Israeli DST (2013-present)',
      },
      {
        startYear: 2005, endYear: 2012, startMonth: 3, startRule: { type: 'date', day: 1 }, startTime: 2,
        endMonth: 8, endRule: { type: 'date', day: 30 }, endTime: 2, offset: 1,
        description: 'Extended DST period (2005-2012)',
      },
      {
        startYear: 1992, endYear: 2004, startMonth: 2, startRule: { type: 'week', week: 3, weekday: 5 }, startTime: 2,
        endMonth: 8, endRule: { type: 'week', week: 1, weekday: 0 }, endTime: 2, offset: 1,
        description: 'Standard Israeli DST (1992-2004)',
      },
    ],
  },
  {
    region: 'Turkey',
    timezones: ['Europe/Istanbul'],
    notes: 'Turkey moved to permanent DST in 2016',
    rules: [
      {
        startYear: 2016, startMonth: 0, startRule: { type: 'date', day: 1 }, startTime: 0,
        endMonth: 11, endRule: { type: 'date', day: 31 }, endTime: 23, offset: 1,
        description: 'Permanent DST/UTC+3 (2016-present)',
      },
      {
        startYear: 1996, endYear: 2015, startMonth: 2, startRule: { type: 'lastWeekday', weekday: 0 }, startTime: 1,
        endMonth: 9, endRule: { type: 'lastWeekday', weekday: 0 }, endTime: 1, offset: 1,
        description: 'EU-aligned DST (1996-2015)',
      },
    ],
  },
  {
    region: 'Egypt',
    timezones: ['Africa/Cairo'],
    notes: 'Egypt has frequently changed DST policies',
    rules: [
      {
        startYear: 2015, startMonth: 0, startRule: { type: 'date', day: 1 }, startTime: 0,
        endMonth: 11, endRule: { type: 'date', day: 31 }, endTime: 23, offset: 0,
        description: 'No DST (2015-present, with brief exceptions)',
      },
      {
        startYear: 2010, endYear: 2014, startMonth: 3, startRule: { type: 'lastWeekday', weekday: 5 }, startTime: 0,
        endMonth: 8, endRule: { type: 'lastWeekday', weekday: 4 }, endTime: 24, offset: 1,
        description: 'Recent DST period (2010-2014)',
      },
      {
        startYear: 1988, endYear: 2009, startMonth: 3, startRule: { type: 'lastWeekday', weekday: 5 }, startTime: 0,
        endMonth: 8, endRule: { type: 'lastWeekday', weekday: 4 }, endTime: 24, offset: 1,
        description: 'Standard Egyptian DST (1988-2009)',
      },
    ],
  },
];

export function getHistoricalDSTRule(timezone: string, date: Date): DSTHistoricalRule | null {
  const year = date.getFullYear();
  const regionalHistory = DST_HISTORICAL_RULES.find((region) => region.timezones.includes(timezone));
  if (!regionalHistory) return null;

  for (const rule of regionalHistory.rules) {
    if (year >= rule.startYear && (!rule.endYear || year <= rule.endYear)) {
      return rule;
    }
  }

  return null;
}
