import type { SourceDate } from "./types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// The calendar `YYYY-MM-DD` prefix of the source string. Source dates carry
// fixed +10:00/+08:00 offsets, so parsing them with `Date` would shift the
// day (or month, or year) for anyone west of the source timezone.
// Approximate dates sort at their first day.
export const dateSortKey = (date: SourceDate): string | null =>
  date ? date.iso.slice(0, 10) : null;

// `day` → "18 May 2021", `month` → "Jun 2026", `year` → "2022". Slicing only.
export function formatSourceDate(date: SourceDate): string | null {
  if (!date) return null;
  const year = date.iso.slice(0, 4);
  const month = MONTHS[Number(date.iso.slice(5, 7)) - 1];
  if (date.precision === "year" || month === undefined) return year;
  if (date.precision === "month") return `${month} ${year}`;
  return `${Number(date.iso.slice(8, 10))} ${month} ${year}`;
}

export const isApproximate = (date: SourceDate): boolean =>
  date !== null && date.precision !== "day";

const integer = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// "1,234 MW" below 10 GW, "12.3 GW" above; small values keep one decimal.
export function formatMw(mw: number): string {
  if (mw >= 10_000) return `${oneDecimal.format(mw / 1000)} GW`;
  if (mw >= 100 || Number.isInteger(mw)) return `${integer.format(mw)} MW`;
  return `${oneDecimal.format(mw)} MW`;
}

export function formatMwh(mwh: number): string {
  if (mwh >= 10_000) return `${oneDecimal.format(mwh / 1000)} GWh`;
  return `${integer.format(mwh)} MWh`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// `ymd` minus `months`, clamped to the target month's last day. Pure string
// and integer math, no Date: calendar strings must never shift by timezone
export function monthsBefore(ymd: string, months: number): string {
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10));
  const total = year * 12 + (month - 1) - months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const maxDay = m === 2 ? (isLeapYear(y) ? 29 : 28) : DAYS_IN_MONTH[m - 1];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(y).padStart(4, "0")}-${pad(m)}-${pad(Math.min(day, maxDay))}`;
}

// Strict YYYY-MM-DD with a real day in a real month (leap-aware). Anything
// else — bad lengths, month 13, 31 April, a longer ISO string — is not a
// calendar date
export function isCalendarDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10));
  if (month < 1 || month > 12 || day < 1) return false;
  const maxDay =
    month === 2
      ? isLeapYear(Number(ymd.slice(0, 4)))
        ? 29
        : 28
      : DAYS_IN_MONTH[month - 1];
  return day <= maxDay;
}

export const formatCount = (n: number): string => integer.format(n);

// Instants (`created_at`, `fetchedAt`) are real points in time, so parsing
// them and showing local time is correct here.
export function formatInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
