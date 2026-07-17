import { resolve } from 'node:path';

export function getAstrologyReportsDir() {
  return resolve(process.env.ASTROLOGY_REPORTS_DIR || 'storage/astrology-reports');
}

export function sanitizeReportFileName(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, '');
}
