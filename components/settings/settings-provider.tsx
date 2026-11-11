"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  resetAccountSettings,
  saveApplicationPreferences,
  savePortfolioPreferences,
  saveProfile,
} from "@/lib/data/actions/settings";
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  type DateFormat,
} from "@/lib/format";
import type { MutationResult } from "@/lib/mutation";
import type { AppSettings, ApplicationPreferences, LandlordProfile, PortfolioPreferences } from "@/lib/settings";

type SettingsContextValue = {
  settings: AppSettings;
  updateProfile: (
    profile: Omit<LandlordProfile, "accountType">,
  ) => Promise<MutationResult<{ settings: AppSettings; notice?: string }>>;
  updatePortfolio: (
    portfolio: Pick<PortfolioPreferences, "portfolioName" | "dateFormat">,
  ) => Promise<MutationResult<AppSettings>>;
  updateApplication: (application: ApplicationPreferences) => Promise<MutationResult<AppSettings>>;
  resetSettings: () => Promise<MutationResult<AppSettings>>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  revision,
  initialSettings,
  children,
}: {
  revision: string;
  initialSettings: AppSettings;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState({ revision, settings: initialSettings });
  if (state.revision !== revision) setState({ revision, settings: initialSettings });
  const settings = state.revision === revision ? state.settings : initialSettings;

  const value = useMemo<SettingsContextValue>(() => {
    function adopt(next: AppSettings) {
      setState((current) => ({ revision: current.revision, settings: next }));
      router.refresh();
    }
    return {
      settings,
      async updateProfile(profile) {
        const result = await saveProfile(profile);
        if (!result.ok) return result;
        adopt(result.value.settings);
        return result;
      },
      async updatePortfolio(portfolio) {
        const result = await savePortfolioPreferences(portfolio);
        if (!result.ok) return result;
        adopt(result.value);
        return result;
      },
      async updateApplication(application) {
        const result = await saveApplicationPreferences(application);
        if (!result.ok) return result;
        adopt(result.value);
        return result;
      },
      async resetSettings() {
        const result = await resetAccountSettings();
        if (!result.ok) return result;
        adopt(result.value);
        return result;
      },
    };
  }, [settings, router]);

  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider.");
  }
  return context;
}

export type Formatters = {
  dateFormat: DateFormat;
  formatDate: (calendarDate: string) => string;
  formatDateTime: (timestamp: string) => string;
  formatTimestamp: (timestamp: string, relativeTo: string) => string;
};

export function useFormatters(): Formatters {
  const { settings } = useSettings();
  const { dateFormat } = settings.portfolio;
  const { timestampDisplay } = settings.application;
  return useMemo(
    () => ({
      dateFormat,
      formatDate: (calendarDate) => formatDate(calendarDate, dateFormat),
      formatDateTime: (timestamp) => formatDateTime(timestamp, dateFormat),
      formatTimestamp: (timestamp, relativeTo) =>
        timestampDisplay === "relative"
          ? formatRelativeTime(timestamp, relativeTo)
          : formatDateTime(timestamp, dateFormat),
    }),
    [dateFormat, timestampDisplay],
  );
}
