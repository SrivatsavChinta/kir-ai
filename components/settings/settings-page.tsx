"use client";

import { useRef, useState } from "react";
import { Info, Pencil, RotateCcw } from "lucide-react";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FormError, SubmitButton, useSubmitLock } from "@/components/feedback/form-feedback";
import { useNotice } from "@/components/feedback/notice";
import { FormField, focusFirstInvalid } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { usePortfolio } from "@/components/portfolio-provider";
import { ClaudeAccess } from "@/components/settings/claude-access";
import { useSettings } from "@/components/settings/settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { DATE_FORMATS, formatDate, formatPhone, type DateFormat } from "@/lib/format";
import {
  DASHBOARD_VIEW_LABELS,
  DATE_FORMAT_LABELS,
  NOTIFICATION_LABELS,
  TIMESTAMP_DISPLAY_LABELS,
  profileToFormValues,
  validatePortfolioForm,
  validateProfileForm,
  type ApplicationPreferences,
  type DashboardView,
  type NotificationPreferences,
  type PortfolioFormValues,
  type ProfileFormValues,
  type TimestampDisplay,
} from "@/lib/settings";
import type { FieldErrors } from "@/lib/validation";

type Effect = "applies" | "preview" | "fixed";

const EFFECT_BADGES: Record<Effect, { label: string; variant: "secondary" | "outline" }> = {
  applies: { label: "Applies now", variant: "secondary" },
  preview: { label: "Preview only", variant: "outline" },
  fixed: { label: "Fixed", variant: "outline" },
};

function EffectBadge({ effect }: { effect: Effect }) {
  const { label, variant } = EFFECT_BADGES[effect];
  return <Badge variant={variant}>{label}</Badge>;
}

export function SettingsPage() {
  const { resetSettings } = useSettings();
  const { showNotice } = useNotice();
  // Remounts the sections after a reset so their forms start from the defaults.
  const [version, setVersion] = useState(0);
  const [resetDialog, setResetDialog] = useState({ open: false, key: 0 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your profile and how kir.ai shows your portfolio."
      />

      <div className="flex max-w-3xl gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-1.5">
          <p>
            Settings are saved to your account and stay after you sign out.
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
            <EffectBadge effect="applies" /> changes the app straight away.
            <EffectBadge effect="preview" /> is saved but has no effect yet.
            <EffectBadge effect="fixed" /> can&apos;t be changed in this prototype.
          </p>
        </div>
      </div>

      <div className="grid max-w-3xl gap-6">
        <ProfileSection key={`profile-${version}`} />
        <PortfolioSection key={`portfolio-${version}`} />
        <ApplicationSection key={`application-${version}`} />
        <ClaudeAccess />

        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Reset settings
            </CardTitle>
            <CardDescription>
              Restore the default portfolio and application preferences. Your name, email, phone,
              properties, tenants, payments and other records aren&apos;t affected.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialog((current) => ({ open: true, key: current.key + 1 }))}
            >
              <RotateCcw data-icon="inline-start" />
              Reset to defaults
            </Button>
          </CardFooter>
        </Card>
      </div>

      <ConfirmDialog
        open={resetDialog.open}
        onOpenChange={(open) => setResetDialog((current) => ({ ...current, open }))}
        formKey={resetDialog.key}
        title="Reset all settings?"
        description="Your portfolio name, date format and dashboard choices will go back to their defaults. Your name, email and phone stay as they are."
        confirmLabel="Reset settings"
        pendingLabel="Resetting…"
        onConfirm={async () => {
          const result = await resetSettings();
          if (!result.ok) return result;
          setVersion((current) => current + 1);
          showNotice({
            tone: "success",
            title: "Settings reset",
            message: "Portfolio and application preferences are back to their defaults.",
          });
          return { ok: true };
        }}
      />
    </div>
  );
}

function ProfileSection() {
  const { settings, updateProfile } = useSettings();
  const { showNotice } = useNotice();
  const { profile } = settings;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ProfileFormValues>(() => profileToFormValues(profile));
  const [errors, setErrors] = useState<FieldErrors<ProfileFormValues>>({});
  const [formError, setFormError] = useState<string>();
  const lock = useSubmitLock();
  const formRef = useRef<HTMLFormElement>(null);

  function startEditing() {
    setValues(profileToFormValues(profile));
    setErrors({});
    setFormError(undefined);
    setEditing(true);
  }

  function update(field: keyof ProfileFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateProfileForm(values);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }
    if (!lock.acquire()) return;
    setFormError(undefined);
    const saved = await updateProfile(result.data);
    lock.release();
    if (!saved.ok) {
      setFormError(saved.error);
      if (saved.field) setErrors((current) => ({ ...current, [saved.field!]: saved.error }));
      return;
    }
    setEditing(false);
    showNotice({
      tone: "success",
      title: "Profile updated",
      message: saved.value.notice ?? "Your name and contact details have been saved.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Landlord profile
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <EffectBadge effect="applies" />
          Shown in the header, sidebar and dashboard greeting.
        </CardDescription>
        {!editing && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil data-icon="inline-start" />
              Edit profile
            </Button>
          </CardAction>
        )}
      </CardHeader>

      {editing ? (
        <form ref={formRef} noValidate onSubmit={handleSubmit}>
          <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <p className="text-sm text-muted-foreground sm:col-span-2">All fields are required.</p>
            <FormField
              id="profile-name"
              label="Full name"
              error={errors.fullName}
              className="sm:col-span-2"
            >
              {(control) => (
                <Input
                  {...control}
                  value={values.fullName}
                  onChange={(event) => update("fullName", event.target.value)}
                  autoComplete="name"
                  maxLength={100}
                />
              )}
            </FormField>
            <FormField id="profile-email" label="Email" error={errors.email}>
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  value={values.email}
                  onChange={(event) => update("email", event.target.value)}
                  autoComplete="email"
                />
              )}
            </FormField>
            <FormField
              id="profile-phone"
              label="Mobile number"
              description="10-digit Indian mobile number."
              error={errors.phone}
            >
              {(control) => (
                <Input
                  {...control}
                  type="tel"
                  value={values.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  autoComplete="tel"
                />
              )}
            </FormField>
            <div className="space-y-1 text-sm sm:col-span-2">
              <p className="font-medium">Account type</p>
              <p className="text-muted-foreground">
                Landlord. This prototype has no other account types.
              </p>
            </div>
          </CardContent>
          <CardFooter className="mt-6 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <FormError message={formError} />
            <div className="flex flex-wrap gap-2">
            <SubmitButton pending={lock.pending} pendingLabel="Saving…">
              Save profile
            </SubmitButton>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={lock.pending}>
              Cancel
            </Button>
            </div>
          </CardFooter>
        </form>
      ) : (
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <ProfileItem label="Full name">{profile.fullName}</ProfileItem>
            <ProfileItem label="Email">
              <span className="break-all">{profile.email}</span>
            </ProfileItem>
            <ProfileItem label="Mobile number">{formatPhone(profile.phone)}</ProfileItem>
            <ProfileItem label="Account type">{profile.accountType}</ProfileItem>
          </dl>
        </CardContent>
      )}
    </Card>
  );
}

function ProfileItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{children}</dd>
    </div>
  );
}

function PortfolioSection() {
  const { settings, updatePortfolio } = useSettings();
  const { today } = usePortfolio();
  const { showNotice } = useNotice();
  const { portfolio } = settings;
  const [values, setValues] = useState<PortfolioFormValues>({
    portfolioName: portfolio.portfolioName,
    dateFormat: portfolio.dateFormat,
  });
  const [errors, setErrors] = useState<FieldErrors<PortfolioFormValues>>({});
  const [formError, setFormError] = useState<string>();
  const lock = useSubmitLock();
  const formRef = useRef<HTMLFormElement>(null);

  function update(field: keyof PortfolioFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validatePortfolioForm(values);
    if (!result.success) {
      setErrors(result.errors);
      focusFirstInvalid(formRef.current);
      return;
    }
    if (!lock.acquire()) return;
    setFormError(undefined);
    const saved = await updatePortfolio(result.data);
    lock.release();
    if (!saved.ok) {
      setFormError(saved.error);
      return;
    }
    setValues({
      portfolioName: saved.value.portfolio.portfolioName,
      dateFormat: saved.value.portfolio.dateFormat,
    });
    showNotice({
      tone: "success",
      title: "Portfolio preferences saved",
      message: `Dates now appear as ${formatDate(today, saved.value.portfolio.dateFormat)}.`,
    });
  }

  const previewFormat = DATE_FORMATS.includes(values.dateFormat as DateFormat)
    ? (values.dateFormat as DateFormat)
    : portfolio.dateFormat;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Portfolio preferences
        </CardTitle>
        <CardDescription>All editable fields are required.</CardDescription>
      </CardHeader>
      <form ref={formRef} noValidate onSubmit={handleSubmit}>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            id="portfolio-name"
            label="Portfolio name"
            description="Shown in the sidebar and on the dashboard."
            error={errors.portfolioName}
          >
            {(control) => (
              <Input
                {...control}
                value={values.portfolioName}
                onChange={(event) => update("portfolioName", event.target.value)}
                autoComplete="off"
                maxLength={80}
              />
            )}
          </FormField>
          <FormField
            id="portfolio-date-format"
            label="Date format"
            description={`Used for dates across the app. Today: ${formatDate(today, previewFormat)}.`}
            error={errors.dateFormat}
          >
            {(control) => (
              <NativeSelect
                {...control}
                value={values.dateFormat}
                onChange={(event) => update("dateFormat", event.target.value)}
                className="w-full"
              >
                {DATE_FORMATS.map((format) => (
                  <NativeSelectOption key={format} value={format}>
                    {DATE_FORMAT_LABELS[format]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground sm:col-span-2">
            <EffectBadge effect="applies" /> Portfolio name and date format apply as soon as
            you save.
          </div>

          <dl className="grid grid-cols-1 gap-4 border-t pt-5 text-sm sm:col-span-2 sm:grid-cols-2">
            <FixedSetting label="Currency" value="Indian rupee (₹, INR)" />
            <FixedSetting label="Time zone" value="India Standard Time (Asia/Kolkata, UTC+05:30)" />
          </dl>
        </CardContent>
        <CardFooter className="mt-6 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <FormError message={formError} />
          <SubmitButton pending={lock.pending} pendingLabel="Saving…">
            Save portfolio preferences
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

function FixedSetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {label}
        <EffectBadge effect="fixed" />
      </dt>
      <dd className="font-medium break-words">{value}</dd>
    </div>
  );
}

function ApplicationSection() {
  const { settings, updateApplication } = useSettings();
  const { showNotice } = useNotice();
  const [values, setValues] = useState<ApplicationPreferences>(settings.application);
  const [formError, setFormError] = useState<string>();
  const lock = useSubmitLock();

  function setNotification(key: keyof NotificationPreferences, checked: boolean) {
    setValues((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: checked },
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lock.acquire()) return;
    setFormError(undefined);
    const saved = await updateApplication(values);
    lock.release();
    if (!saved.ok) {
      setFormError(saved.error);
      return;
    }
    showNotice({
      tone: "success",
      title: "Application preferences saved",
      message: "Your display preferences now apply across the app. Notification choices are stored, and nothing is sent.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Application preferences
        </CardTitle>
        <CardDescription>How dates and the dashboard are shown to you.</CardDescription>
      </CardHeader>
      <form noValidate onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <FieldSet>
            <FieldLegend variant="label" className="flex flex-wrap items-center gap-2">
              Activity times
              <EffectBadge effect="applies" />
            </FieldLegend>
            <FieldDescription>
              Used for the recent activity list on the dashboard. Hover over a relative time to
              see the exact date and time.
            </FieldDescription>
            <ChoiceGroup<TimestampDisplay>
              name="timestamp-display"
              value={values.timestampDisplay}
              options={TIMESTAMP_DISPLAY_LABELS}
              onChange={(timestampDisplay) =>
                setValues((current) => ({ ...current, timestampDisplay }))
              }
            />
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label" className="flex flex-wrap items-center gap-2">
              Default dashboard view
              <EffectBadge effect="applies" />
            </FieldLegend>
            <FieldDescription>Which card leads the dashboard.</FieldDescription>
            <ChoiceGroup<DashboardView>
              name="dashboard-view"
              value={values.dashboardView}
              options={DASHBOARD_VIEW_LABELS}
              onChange={(dashboardView) => setValues((current) => ({ ...current, dashboardView }))}
            />
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label" className="flex flex-wrap items-center gap-2">
              Notifications
              <EffectBadge effect="preview" />
            </FieldLegend>
            <FieldDescription>
              kir.ai doesn&apos;t send emails, texts or alerts. Your choices are saved to your
              account, but nothing is sent.
            </FieldDescription>
            <div className="grid gap-2">
              {(Object.keys(NOTIFICATION_LABELS) as (keyof NotificationPreferences)[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                  <input
                    type="checkbox"
                    checked={values.notifications[key]}
                    onChange={(event) => setNotification(key, event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-primary outline-none"
                  />
                  <span className="space-y-0.5">
                    <span className="block font-medium">{NOTIFICATION_LABELS[key].label}</span>
                    <span className="block text-muted-foreground">
                      {NOTIFICATION_LABELS[key].description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </FieldSet>

        </CardContent>
        <CardFooter className="mt-6 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <FormError message={formError} />
          <SubmitButton pending={lock.pending} pendingLabel="Saving…">
            Save application preferences
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

type ChoiceGroupProps<Value extends string> = {
  name: string;
  value: Value;
  options: Record<Value, string>;
  onChange: (value: Value) => void;
};

function ChoiceGroup<Value extends string>({ name, value, options, onChange }: ChoiceGroupProps<Value>) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(Object.keys(options) as Value[]).map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-checked:border-primary/40 has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="size-4 shrink-0 accent-primary outline-none"
          />
          {options[option]}
        </label>
      ))}
    </div>
  );
}
