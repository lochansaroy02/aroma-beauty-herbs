import "server-only";

/**
 * Origin of the Express API, with any trailing slash removed.
 *
 * Every caller builds a URL as `${API_URL}${path}` where `path` already starts
 * with a slash, so an origin ending in one produces `https://host//products`.
 * That is not the same path: Express doesn't route it, and a proxy in front of
 * the API may reject it before Express is even reached. Pasting a URL with the
 * slash on the end is the normal thing to do — copying it out of a browser
 * gives you one — so the value is normalised here rather than left as a rule
 * everyone has to remember.
 */
export const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(
  /\/+$/,
  ""
);

/** Field-level messages keyed by input name, as returned by the API on 422. */
export type FieldErrors = Record<string, string[]>;

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; details?: unknown };

/**
 * Calls the auth API from the server. Because this only ever runs server-side,
 * the browser never sees the API origin and CORS never comes into play.
 */
export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Can't reach the server. Check that the API is running.",
    };
  }

  return readResult<T>(response);
}

/** `token` is optional — the product catalogue is a public endpoint. */
export async function apiGet<T>(
  path: string,
  token?: string
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Can't reach the server. Check that the API is running.",
    };
  }

  return readResult<T>(response);
}

export function apiPatch<T>(path: string, body: unknown, token?: string) {
  return send<T>("PATCH", path, token, body);
}

/** For endpoints that replace a whole resource rather than amend one. */
export function apiPut<T>(path: string, body: unknown, token?: string) {
  return send<T>("PUT", path, token, body);
}

/** `body` is optional: DELETE /cart takes none. */
export function apiDelete<T>(path: string, token?: string, body?: unknown) {
  return send<T>("DELETE", path, token, body);
}

async function send<T>(
  method: string,
  path: string,
  token: string | undefined,
  body: unknown
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Can't reach the server. Check that the API is running.",
    };
  }

  return readResult<T>(response);
}

async function readResult<T>(response: Response): Promise<ApiResult<T>> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const body = payload as { error?: string; details?: unknown } | null;
    return {
      ok: false,
      status: response.status,
      error: body?.error ?? "Something went wrong. Try again.",
      details: body?.details,
    };
  }

  return { ok: true, data: payload as T };
}
