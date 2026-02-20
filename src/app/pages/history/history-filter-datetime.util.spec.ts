import { normalizeFilterDateTimeValue, parseFilterDateTime } from './history-filter-datetime.util';

describe('history filter datetime utils', () => {
  it('normalizes datetime values to local minute precision', () => {
    const raw = '2026-02-21T15:45:38.000Z';

    const normalized = normalizeFilterDateTimeValue(raw);

    expect(normalized).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(normalized).not.toContain('Z');

    const expected = new Date(raw);
    expected.setSeconds(0, 0);
    expect(new Date(normalized ?? '').getTime()).toBe(expected.getTime());
  });

  it('keeps local datetime strings stable', () => {
    const raw = '2026-06-10T08:30';

    const normalized = normalizeFilterDateTimeValue(raw);

    expect(normalized).toBe(raw);
  });

  it('returns null for invalid values', () => {
    expect(normalizeFilterDateTimeValue('valor-invalido')).toBeNull();
    expect(normalizeFilterDateTimeValue(null)).toBeNull();
    expect(parseFilterDateTime('')).toBeNull();
    expect(parseFilterDateTime('x')).toBeNull();
  });

  it('parses valid datetime values into epoch time', () => {
    const value = '2026-06-10T08:30';

    const parsed = parseFilterDateTime(value);

    expect(parsed).toBe(new Date(value).getTime());
  });
});
