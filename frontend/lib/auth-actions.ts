"use server";

import { redirect } from "next/navigation";

import { apiPost, type FieldErrors } from "./api";
import { createSession, destroySession } from "./session";

/**
 * Staff sign-in.
 *
 * There is no signup, no OTP and no customer session: this site sells nothing,
 * so the only reason to log in is to edit it. Admin accounts are created on the
 * server with `npm run make:admin`.
 */

export type FormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  notice?: string;
};

type SessionResponse = {
  user: { id: number; email: string; role_as?: string | null };
  token: string;
};

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

export async function loginAction(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  const result = await apiPost<SessionResponse>("/auth/login", {
    email: text(formData, "email"),
    password: String(formData.get("password") ?? ""),
  });

  if (!result.ok) {
    return toFormState(result);
  }

  await createSession(result.data.token);

  // The admin panel is the only thing behind a login now.
  // redirect() throws to unwind — it must stay outside any try/catch.
  redirect("/admin");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
