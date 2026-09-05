/** Portuguese mandatory national holidays for operational SLA calendars. */

const FIXED_MONTH_DAYS = [
  "01-01", "04-25", "05-01", "06-10", "08-15", "10-05", "11-01", "12-01", "12-08", "12-25",
] as const;

/** Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Mandatory Portuguese national holidays for a specific Gregorian year. */
export function getHolidaysPt(year: number): string[] {
  const easter = easterSunday(year);
  return [
    ...FIXED_MONTH_DAYS.map((monthDay) => `${year}-${monthDay}`),
    addDays(easter, -2),
    addDays(easter, 0),
    addDays(easter, 60),
  ];
}

/** Optional holidays intentionally disabled by default. */
export const OPTIONAL_HOLIDAYS_PT = ["Carnaval", "feriado municipal"] as const;

export function isHolidayPt(date: Date): boolean {
  const isoDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  return getHolidaysPt(Number(isoDate.slice(0, 4))).includes(isoDate);
}
