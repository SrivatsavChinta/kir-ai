export const APP_TIME_ZONE = "Asia/Kolkata";

const MS_PER_DAY = 86_400_000;

// Asia/Kolkata is a fixed UTC+05:30 with no daylight saving, so IST wall-clock
// time is computed arithmetically. This keeps server and browser output
// identical regardless of the ICU data either side ships.
const IST_OFFSET_MS = 330 * 60_000;

export type ISTParts = {
  /** YYYY-MM-DD */
  date: string;
  hour: number;
  minute: number;
};

/** The IST calendar date and time of day for an ISO 8601 timestamp. */
export function toISTParts(timestamp: string): ISTParts {
  const shifted = new Date(Date.parse(timestamp) + IST_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** Returns the IST calendar date (YYYY-MM-DD) for a timestamp. */
export function toCalendarDate(timestamp: string): string {
  return toISTParts(timestamp).date;
}

/** Whole days from one calendar date to another; negative if `toDate` is earlier. */
export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(
    (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) /
      MS_PER_DAY,
  );
}

/** True for a real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}
