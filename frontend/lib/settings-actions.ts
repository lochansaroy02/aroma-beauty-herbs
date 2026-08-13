"use server";

import { revalidatePath } from "next/cache";

import { apiPatch } from "./api";
import { getSessionToken } from "./session";
import type { MediaDriver } from "./catalog";

export type SettingsResult = { ok: true } | { ok: false; error: string };

/**
 * Switches which storage new uploads go to.
 *
 * The API rejects ImageKit when its keys are missing, so a failure here is
 * usually that — surfaced verbatim rather than flattened to "couldn't save".
 */
export async function setMediaDriverAction(driver: MediaDriver): Promise<SettingsResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: "Your session expired. Log in again." };

  const result = await apiPatch("/admin/settings/media", { driver }, token);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/customisation");
  return { ok: true };
}
