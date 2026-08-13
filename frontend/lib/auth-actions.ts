"use server";

import { redirect } from "next/navigation";

import { apiPost, type FieldErrors } from "./api";
import { createSession, destroySession } from "./session";

export type FormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  notice?: string;
  /** Guesses left before the current code locks. Set on a failed verify. */
  attemptsRemaining?: number;
};

type SignupResponse = { message: string; email: string; expiresInMinutes: number };
type SessionResponse = {
  user: { id: number; email: string; role_as?: string | null };
  token: string;
};

/**
 * Where a session starts. Customers land in the shop — that's what they came
 * for; admins go to their dashboard. `/account` stays reachable from the header.
 */
function landingFor(role: string | null | undefined): string {
  return role === "Admin" ? "/admin" : "/products";
}

/** 422 bodies carry per-field messages; anything else is a single banner. */
function toFormState(result: {
  status: number;
  error: string;
  details?: unknown;
}): FormState {
  if (result.status === 422 && result.details) {
    return { error: result.error, fieldErrors: result.details as FieldErrors };
  }
  return { error: result.error };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function signupAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  const phone = text(formData, "phone");

  const result = await apiPost<SignupResponse>("/auth/signup", {
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: String(formData.get("password") ?? ""),
    ...(phone ? { phone } : {}),
  });

  if (!result.ok) {
    return toFormState(result);
  }

  // redirect() throws to unwind — it must stay outside any try/catch.
  redirect(`/verify?email=${encodeURIComponent(result.data.email)}`);
}

export async function verifyOtpAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  const result = await apiPost<SessionResponse>("/auth/verify-otp", {
    email: text(formData, "email"),
    otp: text(formData, "otp"),
  });

  if (!result.ok) {
    const details = result.details as { attemptsRemaining?: number } | undefined;
    return {
      ...toFormState(result),
      ...(typeof details?.attemptsRemaining === "number"
        ? { attemptsRemaining: details.attemptsRemaining }
        : {}),
    };
  }

  await createSession(result.data.token);
  // A freshly verified account is always a customer, but read the role anyway.
  redirect(landingFor(result.data.user.role_as));
}

export async function resendOtpAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  const result = await apiPost<{ message: string }>("/auth/resend-otp", {
    email: text(formData, "email"),
  });

  if (!result.ok) {
    return toFormState(result);
  }

  return { notice: result.data.message };
}

export async function loginAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  const result = await apiPost<SessionResponse>("/auth/login", {
    email: text(formData, "email"),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    // An unverified account isn't a dead end — send them to finish verifying.
    const details = result.details as { code?: string; email?: string } | undefined;
    if (details?.code === "EMAIL_NOT_VERIFIED" && details.email) {
      redirect(`/verify?email=${encodeURIComponent(details.email)}`);
    }
    return toFormState(result);
  }

  await createSession(result.data.token);
  redirect(landingFor(result.data.user.role_as));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
