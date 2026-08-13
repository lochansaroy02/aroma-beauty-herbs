"use server";

import { revalidatePath } from "next/cache";

import { apiDelete, apiPatch, apiPost, type FieldErrors } from "./api";
import type { UploadedVideo } from "./media-upload";
import { getSessionToken } from "./session";

export type VideoResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

const SIGNED_OUT = "Your session expired. Log in again.";

function refresh() {
  revalidatePath("/admin/videos");
}

export async function createVideoAction(input: {
  title: string;
  productId: string;
  video: UploadedVideo;
  isActive: boolean;
}): Promise<VideoResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPost(
    "/admin/videos",
    {
      title: input.title,
      // Empty string means "no product"; the API maps it to null.
      product_id: input.productId,
      video: input.video,
      is_active: input.isActive,
    },
    token
  );

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      ...(result.status === 422 ? { fieldErrors: result.details as FieldErrors } : {}),
    };
  }

  refresh();
  return { ok: true };
}

/** Used by the row-level active toggle. */
export async function setVideoActiveAction(
  id: number,
  isActive: boolean
): Promise<VideoResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiPatch(`/admin/videos/${id}`, { is_active: isActive }, token);
  if (!result.ok) return { ok: false, error: result.error };

  refresh();
  return { ok: true };
}

export async function deleteVideoAction(id: number): Promise<VideoResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await apiDelete(`/admin/videos/${id}`, token);
  if (!result.ok) return { ok: false, error: result.error };

  refresh();
  return { ok: true };
}
