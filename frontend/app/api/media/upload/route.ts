import { NextResponse } from "next/server";

import { API_URL } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

/**
 * Upload proxy.
 *
 * The browser can't post to the API directly: the session JWT lives in an
 * httpOnly cookie it can't read, and the API's origin is deliberately never
 * exposed to page scripts. So the bytes come here, pick up the token, and go on
 * to the API.
 *
 * A route handler rather than a server action because these are videos —
 * server actions cap the request body at 1MB by default, and raising that
 * buffers the whole file in memory anyway. Here the body is piped straight
 * through, so a 100MB upload never lands in this process's heap.
 */

/** Streaming a request body requires the Node runtime, not Edge. */
export const runtime = "nodejs";

/** Nothing about an upload is cacheable. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = await getSessionToken();

  if (!token) {
    return NextResponse.json(
      { error: "Your session expired. Log in again." },
      { status: 401 }
    );
  }

  const kind = new URL(request.url).searchParams.get("kind") === "video" ? "video" : "image";
  const contentType = request.headers.get("content-type");

  if (!contentType?.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}/uploads?kind=${kind}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Carries the multipart boundary — the API can't parse the body without it.
        "Content-Type": contentType,
      },
      body: request.body,
      // Required by undici whenever the body is a stream: it promises we won't
      // read the response before finishing the request.
      duplex: "half",
      cache: "no-store",
    } as RequestInit & { duplex: "half" });
  } catch {
    return NextResponse.json(
      { error: "Can't reach the server. Check that the API is running." },
      { status: 502 }
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload as { error?: string } | null)?.error ?? "The upload was rejected.";
    return NextResponse.json({ error: message }, { status: response.status });
  }

  return NextResponse.json(payload, { status: 201 });
}
