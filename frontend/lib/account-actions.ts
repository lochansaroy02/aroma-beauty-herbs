"use server";

import { revalidatePath } from "next/cache";

import { apiDelete, apiPatch, apiPost, type FieldErrors } from "./api";
import type { AccountProfile, Address } from "./catalog";
import { createSession, getSessionToken } from "./session";

/**
 * Mutations for the account area.
 *
 * Only async functions are exported: a "use server" module may export nothing
 * else, and a stray const here fails at runtime rather than at build.
 */

export type ActionResult =
  | { ok: true; notice?: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

type AddressInput = Omit<Address, "id">;

/** 422 bodies carry per-field messages; anything else is a single banner. */
async function toFailure(result: {
  status: number;
  error: string;
  details?: unknown;
}): Promise<ActionResult> {
  return {
    ok: false,
    error: result.error,
    ...(result.status === 422 && result.details
      ? { fieldErrors: result.details as FieldErrors }
      : {}),
  };
}

async function requireToken(): Promise<string | null> {
  return getSessionToken();
}

/** Blank optional fields are omitted rather than sent as "" — the API's
 *  validators reject an empty string where they would accept absence. */
async function addressBody(input: AddressInput): Promise<Record<string, unknown>> {
  return {
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone,
    address_line_1: input.address_line_1,
    city: input.city,
    state: input.state,
    zip_code: input.zip_code,
    country: input.country || "India",
    is_default: input.is_default,
    ...(input.address_title ? { address_title: input.address_title } : {}),
    ...(input.address_line_2 ? { address_line_2: input.address_line_2 } : {}),
  };
}

export async function createAddressAction(input: AddressInput): Promise<ActionResult> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  const result = await apiPost<{ address: Address }>(
    "/account/addresses",
    await addressBody(input),
    token
  );

  if (!result.ok) return toFailure(result);

  revalidatePath("/account/addresses");
  return { ok: true, notice: "Address saved." };
}

export async function updateAddressAction(
  id: number,
  input: AddressInput
): Promise<ActionResult> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  // A PATCH of every field, not a diff: the form always submits a complete
  // address, and sending it whole is what makes "clear this line" work.
  const result = await apiPatch<{ address: Address }>(
    `/account/addresses/${id}`,
    {
      ...(await addressBody(input)),
      address_title: input.address_title ?? "",
      address_line_2: input.address_line_2 ?? "",
    },
    token
  );

  if (!result.ok) return toFailure(result);

  revalidatePath("/account/addresses");
  return { ok: true, notice: "Address updated." };
}

export async function deleteAddressAction(id: number): Promise<ActionResult> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  const result = await apiDelete<null>(`/account/addresses/${id}`, token);
  if (!result.ok) return toFailure(result);

  revalidatePath("/account/addresses");
  return { ok: true, notice: "Address removed." };
}

export async function setDefaultAddressAction(id: number): Promise<ActionResult> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  const result = await apiPatch<{ address: Address }>(
    `/account/addresses/${id}`,
    { is_default: true },
    token
  );

  if (!result.ok) return toFailure(result);

  revalidatePath("/account/addresses");
  return { ok: true, notice: "Default address updated." };
}

/**
 * Saves the name, and starts an email change when the address differs.
 *
 * The API parks a new address in `pending_email` and sends it a code; nothing
 * about the account changes until that code comes back. The returned flag is
 * what tells the form to show the code field.
 */
export async function updateProfileAction(input: {
  name: string;
  phone: string;
  email: string;
}): Promise<ActionResult & { verificationRequired?: boolean }> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  const result = await apiPatch<{
    user: AccountProfile;
    email_verification_required: boolean;
  }>(
    "/account/profile",
    { name: input.name, phone: input.phone, email: input.email },
    token
  );

  if (!result.ok) return toFailure(result);

  revalidatePath("/account/settings");
  revalidatePath("/account");

  return result.data.email_verification_required
    ? {
        ok: true,
        verificationRequired: true,
        notice: `We sent a code to ${result.data.user.pending_email}. Enter it below to finish the change.`,
      }
    : { ok: true, notice: "Profile updated." };
}

/**
 * Confirms an email change. The API returns a fresh token because the old one
 * carries the old address, so the session cookie is replaced here.
 */
export async function verifyEmailChangeAction(otp: string): Promise<ActionResult> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  const result = await apiPost<{ user: AccountProfile; token: string }>(
    "/account/email/verify",
    { otp },
    token
  );

  if (!result.ok) return toFailure(result);

  await createSession(result.data.token);

  revalidatePath("/account/settings");
  revalidatePath("/account");
  return { ok: true, notice: "Email address updated." };
}

export async function resendEmailChangeAction(): Promise<ActionResult> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  const result = await apiPost<{ email: string }>("/account/email/resend", {}, token);
  if (!result.ok) return toFailure(result);

  return { ok: true, notice: `A new code is on its way to ${result.data.email}.` };
}

export async function cancelEmailChangeAction(): Promise<ActionResult> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  const result = await apiDelete<{ user: AccountProfile }>("/account/email/pending", token);
  if (!result.ok) return toFailure(result);

  revalidatePath("/account/settings");
  return { ok: true, notice: "Email change cancelled." };
}

export async function changePasswordAction(input: {
  current_password: string;
  new_password: string;
}): Promise<ActionResult> {
  const token = await requireToken();
  if (!token) return { ok: false, error: "Your session has expired. Please log in again." };

  const result = await apiPost<{ message: string }>("/account/password", input, token);
  if (!result.ok) return toFailure(result);

  return { ok: true, notice: "Password changed." };
}
