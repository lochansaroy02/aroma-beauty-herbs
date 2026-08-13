"use server";

import { apiPost } from "./api";
import { getSessionToken } from "./session";

/**
 * Best-effort removal of files uploaded for a form that was never saved.
 * Failures are silent: an orphaned file is not worth an error in the admin's
 * face when they've just cancelled a dialog.
 *
 * Ids are the stored paths. The API re-resolves each one against the media root
 * before unlinking, so a tampered value can't reach anything else on disk.
 */
export async function discardUploads(fileIds: string[]): Promise<void> {
  if (!fileIds.length) return;

  const token = await getSessionToken();
  if (!token) return;

  await apiPost("/uploads/discard", { file_ids: fileIds.slice(0, 20) }, token);
}
