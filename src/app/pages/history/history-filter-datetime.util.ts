export function normalizeFilterDateTimeValue(
  value: string | string[] | null | undefined
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return buildLocalDateTimeValue(date);
}

export function parseFilterDateTime(value: string): number | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.getTime();
}

function buildLocalDateTimeValue(date: Date): string {
  const year = `${date.getFullYear()}`.padStart(4, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
