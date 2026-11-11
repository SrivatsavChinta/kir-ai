export type FieldErrors<Values> = Partial<Record<keyof Values, string>>;

export type ValidationResult<Output, Values> =
  | { success: true; data: Output }
  | { success: false; errors: FieldErrors<Values> };

export const MAX_MONTHLY_RENT = 1_000_000;
export const MAX_SECURITY_DEPOSIT = 10_000_000;

export const PHONE_HINT = "Enter a 10-digit Indian mobile number, for example 98450 12345.";
export const EMAIL_HINT = "Enter a valid email address, for example name@example.com.";

export function hasErrors<Values>(errors: FieldErrors<Values>): boolean {
  return Object.values(errors).some(Boolean);
}

/** Parses a whole number, allowing Indian-style thousands separators. */
export function parseWholeNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, "");
  return /^-?\d+$/.test(cleaned) ? Number(cleaned) : null;
}

/** Normalises an Indian mobile number to "+91 98450 12345", or null if it isn't one. */
export function normalizeIndianMobile(raw: string): string | null {
  let digits = raw.replace(/[\s().-]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
