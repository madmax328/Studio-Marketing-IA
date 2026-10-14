/**
 * Dates « locales » (YYYY-MM-DD et HH:MM dans un fuseau IANA) ↔ instants UTC.
 * Sans dépendance : s'appuie sur Intl, qui connaît les règles de changement d'heure.
 */

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ZonedParts {
  date: string;
  time: string;
  /** 1 = lundi … 7 = dimanche. */
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Date et heure locales d'un instant UTC dans un fuseau. */
export function toZoned(instant: Date, timeZone: string): ZonedParts {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAYS[parts.weekday as string] ?? 1,
  };
}

/** Décalage du fuseau (en minutes) à un instant donné. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

export type ZonedToUtcResult = { ok: true; instant: Date } | { ok: false; reason: "invalid" | "nonexistent" };

/**
 * Convertit une date et une heure locales en instant UTC.
 * - Heure inexistante (passage à l'heure d'été, ex. 02:30 le dernier dimanche de mars à Paris) : refusée.
 * - Heure ambiguë (passage à l'heure d'hiver, ex. 02:30 qui existe deux fois) : la première occurrence est retenue.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): ZonedToUtcResult {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) return { ok: false, reason: "invalid" };
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  if (new Date(naive).getUTCDate() !== d) return { ok: false, reason: "invalid" };

  // Deux candidats possibles selon le décalage avant/après un éventuel changement d'heure.
  const candidates = new Set<number>();
  for (const probe of [naive - 36 * 3600_000, naive + 36 * 3600_000, naive]) {
    candidates.add(naive - offsetMinutes(new Date(probe), timeZone) * 60000);
  }
  const matches = [...candidates]
    .filter((t) => {
      const z = toZoned(new Date(t), timeZone);
      return z.date === date && z.time === time;
    })
    .sort((a, b) => a - b);
  const first = matches[0];
  return first === undefined ? { ok: false, reason: "nonexistent" } : { ok: true, instant: new Date(first) };
}

/** Ajoute des jours à une date locale (sans fuseau : pure arithmétique de calendrier). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Jour de la semaine d'une date (1 = lundi … 7 = dimanche). */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

export function daysBetween(from: string, to: string): number {
  const toTime = (s: string) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toTime(to) - toTime(from)) / 86_400_000);
}

/** Semaines (lundi → dimanche) couvrant un mois donné « YYYY-MM ». */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const start = startOfWeek(first);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const weeks: string[][] = [];
  for (let cursor = start; daysBetween(cursor, last) >= 0; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
  }
  return weeks;
}

/**
 * Répartit des créneaux réguliers entre deux dates incluses :
 * `perWeek` publications par semaine, aux jours les plus espacés possible.
 */
export function spreadSlots(startDate: string, endDate: string, perWeek: number, time: string): { date: string; time: string }[] {
  const total = daysBetween(startDate, endDate) + 1;
  if (total <= 0 || perWeek <= 0) return [];
  const count = Math.max(1, Math.round((total / 7) * perWeek));
  const step = total / count;
  const slots: { date: string; time: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = addDays(startDate, Math.min(total - 1, Math.floor(i * step)));
    if (!slots.some((slot) => slot.date === date)) slots.push({ date, time });
  }
  return slots;
}
