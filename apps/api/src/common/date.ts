export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDateOnly(value?: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}
