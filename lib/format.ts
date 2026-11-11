import { toISTParts } from "@/lib/dates";
import { normalizeIndianMobile } from "@/lib/validation";

// Presentation helpers shared by every module. They avoid Intl's locale data on
// purpose: Node and browsers ship different ICU versions, and differences such
// as "pm" vs "PM" or "₹ 1,000" vs "₹1,000" cause hydration mismatches.

export const APP_CURRENCY = "INR";

export const DATE_FORMATS = ["d MMM yyyy", "dd/MM/yyyy", "yyyy-MM-dd"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export const DEFAULT_DATE_FORMAT: DateFormat = "d MMM yyyy";

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Groups digits the Indian way: 1234567 → "12,34,567". */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${digits.slice(-3)}`;
}

/** Whole rupees with Indian grouping, e.g. "₹1,60,000" or "-₹500". */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}₹${groupIndian(String(Math.abs(rounded)))}`;
}

/** Formats a calendar date (YYYY-MM-DD), by default as "30 Nov 2026". */
export function formatDate(calendarDate: string, format: DateFormat = DEFAULT_DATE_FORMAT): string {
  const [year, month, day] = calendarDate.split("-");
  if (!year || !month || !day) return calendarDate;
  switch (format) {
    case "dd/MM/yyyy":
      return `${day}/${month}/${year}`;
    case "yyyy-MM-dd":
      return calendarDate;
    default:
      return `${Number(day)} ${SHORT_MONTHS[Number(month) - 1]} ${year}`;
  }
}

/** Formats a timestamp in IST, e.g. "11 Nov 2026, 6:30 pm". */
export function formatDateTime(timestamp: string, format: DateFormat = DEFAULT_DATE_FORMAT): string {
  const { date, hour, minute } = toISTParts(timestamp);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour < 12 ? "am" : "pm";
  return `${formatDate(date, format)}, ${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

/** "2026-11" → "November 2026". */
export function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `${LONG_MONTHS[Number(monthNumber) - 1]} ${year}`;
}

/** "just now", "5 minutes ago", "yesterday", "in 3 days" and so on. */
export function formatRelativeTime(timestamp: string, relativeTo: string): string {
  const seconds = (Date.parse(timestamp) - Date.parse(relativeTo)) / 1000;
  const absSeconds = Math.abs(seconds);
  if (absSeconds < 60) return "just now";

  const [value, unit]: [number, string] =
    absSeconds < 3600
      ? [Math.trunc(seconds / 60), "minute"]
      : absSeconds < 86400
        ? [Math.trunc(seconds / 3600), "hour"]
        : [Math.trunc(seconds / 86400), "day"];
  if (unit === "day" && value === -1) return "yesterday";
  if (unit === "day" && value === 1) return "tomorrow";
  const amount = pluralize(Math.abs(value), unit);
  return value < 0 ? `${amount} ago` : `in ${amount}`;
}

/** "820 bytes", "245 KB", "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  const kb = bytes / 1024;
  if (Math.round(kb) < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Indian mobile numbers as "+91 98450 12345"; anything else is shown as entered. */
export function formatPhone(phone: string): string {
  return normalizeIndianMobile(phone) ?? phone.trim();
}

/** A `tel:` link target for a phone number. */
export function phoneHref(phone: string): string {
  return `tel:${formatPhone(phone).replace(/[^\d+]/g, "")}`;
}

/** "Jamie Sample" → "JS". */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
