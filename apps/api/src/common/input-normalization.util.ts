export function normalizeEmailInput(value: string): string;
export function normalizeEmailInput(value: unknown): unknown;
export function normalizeEmailInput(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function normalizeOptionalStringInput(value: string): string;
export function normalizeOptionalStringInput(value: unknown): unknown;
export function normalizeOptionalStringInput(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}
