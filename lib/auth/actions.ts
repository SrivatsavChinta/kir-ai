"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { EMAIL_HINT, isValidEmail, normalizeIndianMobile, PHONE_HINT } from "@/lib/validation";

export type AuthField = "fullName" | "email" | "phone" | "password";

export type AuthFormState = {
  formError?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
  message?: string;
};

async function siteOrigin(): Promise<string> {
  const headerList = await headers();
  return headerList.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

export async function signIn(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  if (!isValidEmail(email)) fieldErrors.email = EMAIL_HINT;
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  if (!isSupabaseConfigured()) {
    return { formError: "Supabase is not configured yet. Add the keys in .env.local." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { formError: "Email or password is incorrect." };

  redirect(next);
}

export async function signUp(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fieldErrors: AuthFormState["fieldErrors"] = {};

  if (!fullName) fieldErrors.fullName = "Enter your full name.";
  else if (fullName.length > 80) fieldErrors.fullName = "Name must be 80 characters or fewer.";
  if (!isValidEmail(email)) fieldErrors.email = EMAIL_HINT;
  const phone = phoneRaw ? normalizeIndianMobile(phoneRaw) : null;
  if (phoneRaw && !phone) fieldErrors.phone = PHONE_HINT;
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  if (!isSupabaseConfigured()) {
    return { formError: "Supabase is not configured yet. Add the keys in .env.local." };
  }

  const origin = await siteOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone: phone ?? "" },
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
    },
  });

  if (error) return { formError: error.message };
  if (!data.session) {
    return {
      message:
        "Account created. Confirm the email, then log in. A new account starts empty — sample properties are not copied across.",
    };
  }

  redirect("/");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
