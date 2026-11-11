"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dbError } from "@/lib/data/errors";
import { type ProfileRow } from "@/lib/data/mappers";
import { requireSession } from "@/lib/data/workspace";
import { APP_TIME_ZONE } from "@/lib/dates";
import { APP_CURRENCY } from "@/lib/format";
import type { MutationResult } from "@/lib/mutation";
import {
  validatePortfolioForm,
  validateProfileForm,
  type AppSettings,
  type ApplicationPreferences,
  type PortfolioPreferences,
} from "@/lib/settings";

const DEFAULT_PREFERENCES = {
  portfolio_name: "My Portfolio",
  date_format: "d MMM yyyy",
  timestamp_display: "relative",
  dashboard_view: "rent-first",
  notify_rent_overdue: true,
  notify_agreement_ending: true,
  notify_maintenance_updates: true,
  notify_weekly_summary: false,
} as const;

function toSettings(profile: ProfileRow, email: string): AppSettings {
  return {
    profile: {
      fullName: profile.full_name,
      email,
      phone: profile.phone ?? "",
      accountType: "Landlord",
    },
    portfolio: {
      portfolioName: profile.portfolio_name,
      currency: APP_CURRENCY,
      dateFormat: profile.date_format,
      timeZone: APP_TIME_ZONE,
    },
    application: {
      timestampDisplay: profile.timestamp_display,
      notifications: {
        rentOverdue: profile.notify_rent_overdue,
        agreementEnding: profile.notify_agreement_ending,
        maintenanceUpdates: profile.notify_maintenance_updates,
        weeklySummary: profile.notify_weekly_summary,
      },
      dashboardView: profile.dashboard_view,
    },
  };
}

async function readSettings(
  supabase: SupabaseClient,
  userId: string,
  email: string,
): Promise<MutationResult<AppSettings>> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return { ok: false, error: dbError(error) };
  if (!data) return { ok: false, error: "Your account profile is missing. Sign out and register again." };
  return { ok: true, value: toSettings(data as ProfileRow, email) };
}

export async function saveProfile(
  input: { fullName: string; email: string; phone: string },
): Promise<MutationResult<{ settings: AppSettings; notice?: string }>> {
  const checked = validateProfileForm(input);
  if (!checked.success) {
    const field = Object.keys(checked.errors).find((key) => checked.errors[key as keyof typeof checked.errors]);
    return { ok: false, error: (field && checked.errors[field as keyof typeof checked.errors]) || "Check the profile and try again.", field };
  }
  const session = await requireSession();
  if (!session.ok) return session;

  const { error } = await session.supabase
    .from("profiles")
    .update({ full_name: checked.data.fullName, phone: checked.data.phone })
    .eq("id", session.userId);
  if (error) return { ok: false, error: dbError(error) };

  let notice: string | undefined;
  let email = session.email;
  if (checked.data.email !== session.email) {
    const { data, error: emailError } = await session.supabase.auth.updateUser({ email: checked.data.email });
    if (emailError) {
      return {
        ok: false,
        error: `Your name and phone were saved, but the email couldn't be changed. ${emailError.message}`,
      };
    }
    const pending = (data.user as { new_email?: string } | null)?.new_email;
    if (pending) {
      notice = "Profile saved. Confirm the new email from the link we sent before it replaces the current one.";
    } else {
      email = data.user?.email ?? checked.data.email;
    }
  }

  const settings = await readSettings(session.supabase, session.userId, email);
  if (!settings.ok) return settings;
  return { ok: true, value: { settings: settings.value, notice } };
}

export async function savePortfolioPreferences(
  input: Pick<PortfolioPreferences, "portfolioName" | "dateFormat">,
): Promise<MutationResult<AppSettings>> {
  const checked = validatePortfolioForm({
    portfolioName: input.portfolioName,
    dateFormat: input.dateFormat,
  });
  if (!checked.success) {
    const field = Object.keys(checked.errors).find((key) => checked.errors[key as keyof typeof checked.errors]);
    return {
      ok: false,
      error: (field && checked.errors[field as keyof typeof checked.errors]) || "Check the portfolio preferences and try again.",
      field,
    };
  }
  const session = await requireSession();
  if (!session.ok) return session;
  const { error } = await session.supabase
    .from("profiles")
    .update({
      portfolio_name: checked.data.portfolioName,
      date_format: checked.data.dateFormat,
    })
    .eq("id", session.userId);
  if (error) return { ok: false, error: dbError(error) };
  return readSettings(session.supabase, session.userId, session.email);
}

export async function saveApplicationPreferences(
  input: ApplicationPreferences,
): Promise<MutationResult<AppSettings>> {
  if (input.timestampDisplay !== "relative" && input.timestampDisplay !== "exact") {
    return { ok: false, error: "Choose how times are shown." };
  }
  if (input.dashboardView !== "rent-first" && input.dashboardView !== "attention-first") {
    return { ok: false, error: "Choose a dashboard view." };
  }
  const session = await requireSession();
  if (!session.ok) return session;
  const { error } = await session.supabase
    .from("profiles")
    .update({
      timestamp_display: input.timestampDisplay,
      dashboard_view: input.dashboardView,
      notify_rent_overdue: input.notifications.rentOverdue,
      notify_agreement_ending: input.notifications.agreementEnding,
      notify_maintenance_updates: input.notifications.maintenanceUpdates,
      notify_weekly_summary: input.notifications.weeklySummary,
    })
    .eq("id", session.userId);
  if (error) return { ok: false, error: dbError(error) };
  return readSettings(session.supabase, session.userId, session.email);
}

export async function resetAccountSettings(): Promise<MutationResult<AppSettings>> {
  const session = await requireSession();
  if (!session.ok) return session;
  const { error } = await session.supabase
    .from("profiles")
    .update(DEFAULT_PREFERENCES)
    .eq("id", session.userId);
  if (error) return { ok: false, error: dbError(error) };
  return readSettings(session.supabase, session.userId, session.email);
}
