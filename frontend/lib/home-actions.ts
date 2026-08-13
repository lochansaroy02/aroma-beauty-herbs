"use server";

import { revalidatePath } from "next/cache";

import { apiDelete, apiPatch, apiPost, apiPut } from "./api";
import { getSessionToken } from "./session";
import type { HomeSection, StripTone } from "./catalog";

/**
 * Writes for the customisation screen.
 *
 * Every one revalidates both the admin page and the storefront homepage: an
 * edit here is only meaningful once the shop reflects it, and the homepage is
 * the one page an admin will immediately go and look at.
 */

const SIGNED_OUT = "Your session expired. Log in again.";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function withToken(
  run: (token: string) => Promise<{ ok: boolean; error?: string }>
): Promise<ActionResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: SIGNED_OUT };

  const result = await run(token);
  if (!result.ok) return { ok: false, error: result.error ?? "That didn't save." };

  revalidatePath("/admin/customisation");
  revalidatePath("/");
  return { ok: true };
}

/* ── Strips ─────────────────────────────────────────────────────────────── */

export type StripInput = {
  text: string;
  direction: "left" | "right";
  tone: StripTone;
  speed: number | null;
  is_active: boolean;
};

export async function createStripAction(input: StripInput) {
  return withToken((token) => apiPost("/admin/home/strips", input, token));
}

/** Partial by design — only the keys present are written. */
export async function updateStripAction(id: number, input: Partial<StripInput>) {
  return withToken((token) => apiPatch(`/admin/home/strips/${id}`, input, token));
}

export async function deleteStripAction(id: number) {
  return withToken((token) => apiDelete(`/admin/home/strips/${id}`, token));
}

export async function reorderStripsAction(order: number[]) {
  return withToken((token) => apiPost("/admin/home/strips/reorder", { order }, token));
}

/* ── Tiles ──────────────────────────────────────────────────────────────── */

export type TileImageInput = {
  file_id: string;
  file_path: string;
  name: string;
  size: number;
  mime_type?: string;
  /** Which storage the API wrote it to; recorded on the media row. */
  disk?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
};

export type TileInput = {
  title: string;
  caption: string | null;
  url: string | null;
  is_active: boolean;
  image?: TileImageInput | null;
};

export async function createTileAction(input: TileInput) {
  return withToken((token) => apiPost("/admin/home/tiles", input, token));
}

export async function updateTileAction(id: number, input: Partial<TileInput>) {
  return withToken((token) => apiPatch(`/admin/home/tiles/${id}`, input, token));
}

export async function deleteTileAction(id: number) {
  return withToken((token) => apiDelete(`/admin/home/tiles/${id}`, token));
}

export async function reorderTilesAction(order: number[]) {
  return withToken((token) => apiPost("/admin/home/tiles/reorder", { order }, token));
}

/* ── Announcement ───────────────────────────────────────────────────────── */

export async function saveAnnouncementAction(input: {
  text: string;
  url: string | null;
  is_active: boolean;
}) {
  // PUT, not POST: there is exactly one bar, so this replaces it rather than
  // adding another.
  return withToken((token) => apiPut("/admin/home/announcement", input, token));
}

/* ── Sections ───────────────────────────────────────────────────────────── */

export async function updateSectionsAction(sections: HomeSection[]) {
  return withToken((token) =>
    apiPatch(
      "/admin/home/sections",
      {
        sections: sections.map((section, index) => ({
          key: section.key,
          position: index,
          is_visible: section.is_visible,
          layout: section.layout,
        })),
      },
      token
    )
  );
}
