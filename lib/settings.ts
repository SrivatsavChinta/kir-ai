import { APP_TIME_ZONE } from "@/lib/dates";
import { APP_CURRENCY, DEFAULT_DATE_FORMAT, DATE_FORMATS, type DateFormat } from "@/lib/format";
import { sampleUser } from "@/lib/sample-user";
import {
  EMAIL_HINT,
  hasErrors,
  isValidEmail,
  normalizeIndianMobile,
  PHONE_HINT,
  type FieldErrors,
  type ValidationResult,
} from "@/lib/validation";

export type LandlordProfile = {
  fullName: string;
  email: string;
  phone: string;
  /** Only landlord accounts exist in this prototype. */
  accountType: "Landlord";
};

export type TimestampDisplay = "relative" | "exact";

export type PortfolioPreferences = {
  portfolioName: string;
  /** Fixed for the prototype; rent is always billed in rupees. */
  currency: typeof APP_CURRENCY;
  dateFormat: DateFormat;
  /** Fixed for the prototype; every date is interpreted in IST. */
  timeZone: typeof APP_TIME_ZONE;
};

export type NotificationPreferences = {
  rentOverdue: boolean;
  agreementEnding: boolean;
  maintenanceUpdates: boolean;
  weeklySummary: boolean;
};

export type DashboardView = "rent-first" | "attention-first";

export type ApplicationPreferences = {
  timestampDisplay: TimestampDisplay;
  /** Stored only; notifications aren't sent by the prototype. */
  notifications: NotificationPreferences;
  /** Which dashboard card leads the main column. */
  dashboardView: DashboardView;
};

export type AppSettings = {
  profile: LandlordProfile;
  portfolio: PortfolioPreferences;
  application: ApplicationPreferences;
};

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  "d MMM yyyy": "Day month year (30 Nov 2026)",
  "dd/MM/yyyy": "DD/MM/YYYY (30/11/2026)",
  "yyyy-MM-dd": "YYYY-MM-DD (2026-11-30)",
};

export const TIMESTAMP_DISPLAY_LABELS: Record<TimestampDisplay, string> = {
  relative: "Relative (2 hours ago)",
  exact: "Exact date and time",
};

export const DASHBOARD_VIEW_LABELS: Record<DashboardView, string> = {
  "rent-first": "Rent collection first",
  "attention-first": "Needs attention first",
};

export const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, { label: string; description: string }> = {
  rentOverdue: { label: "Overdue rent", description: "When a tenant's rent passes its due date unpaid." },
  agreementEnding: { label: "Agreements ending", description: "When an agreement is within 60 days of ending." },
  maintenanceUpdates: { label: "Maintenance updates", description: "When a request is created, resolved or overdue." },
  weeklySummary: { label: "Weekly summary", description: "A digest of rent collected and open items." },
};

export const DEFAULT_SETTINGS: AppSettings = {
  profile: { ...sampleUser },
  portfolio: {
    portfolioName: "Sample Portfolio",
    currency: APP_CURRENCY,
    dateFormat: DEFAULT_DATE_FORMAT,
    timeZone: APP_TIME_ZONE,
  },
  application: {
    timestampDisplay: "relative",
    notifications: {
      rentOverdue: true,
      agreementEnding: true,
      maintenanceUpdates: true,
      weeklySummary: false,
    },
    dashboardView: "rent-first",
  },
};

const MAX_NAME_LENGTH = 80;
const MAX_PORTFOLIO_NAME_LENGTH = 60;

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export type ProfileFormValues = { fullName: string; email: string; phone: string };

export function profileToFormValues(profile: LandlordProfile): ProfileFormValues {
  return { fullName: profile.fullName, email: profile.email, phone: profile.phone };
}

export function validateProfileForm(
  values: ProfileFormValues,
): ValidationResult<ProfileFormValues, ProfileFormValues> {
  const errors: FieldErrors<ProfileFormValues> = {};
  const fullName = values.fullName.trim().replace(/\s+/g, " ");
  if (!fullName) errors.fullName = "Enter your full name.";
  else if (fullName.length > MAX_NAME_LENGTH) {
    errors.fullName = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  }

  const email = values.email.trim().toLowerCase();
  if (!email) errors.email = "Enter an email address.";
  else if (!isValidEmail(email)) errors.email = EMAIL_HINT;

  const phone = normalizeIndianMobile(values.phone);
  if (!values.phone.trim()) errors.phone = "Enter a phone number.";
  else if (!phone) errors.phone = PHONE_HINT;

  if (hasErrors(errors) || !phone) return { success: false, errors };
  return { success: true, data: { fullName, email, phone } };
}

export type PortfolioFormValues = { portfolioName: string; dateFormat: string };

export function validatePortfolioForm(
  values: PortfolioFormValues,
): ValidationResult<{ portfolioName: string; dateFormat: DateFormat }, PortfolioFormValues> {
  const errors: FieldErrors<PortfolioFormValues> = {};
  const portfolioName = values.portfolioName.trim().replace(/\s+/g, " ");
  if (!portfolioName) errors.portfolioName = "Enter a portfolio name.";
  else if (portfolioName.length > MAX_PORTFOLIO_NAME_LENGTH) {
    errors.portfolioName = `Portfolio name must be ${MAX_PORTFOLIO_NAME_LENGTH} characters or fewer.`;
  }
  if (!DATE_FORMATS.includes(values.dateFormat as DateFormat)) {
    errors.dateFormat = "Choose a date format.";
  }
  if (hasErrors(errors)) return { success: false, errors };
  return { success: true, data: { portfolioName, dateFormat: values.dateFormat as DateFormat } };
}
