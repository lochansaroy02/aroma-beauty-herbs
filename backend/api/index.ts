import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Vercel entry point.
 *
 * `src/index.ts` (the VPS entry) owns a port, a sweep timer and signal
 * handlers. None of those exist here: Vercel gives the function a request and
 * takes the instance away again, so this file is the same app with the
 * process-shaped parts removed.
 */

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

type Runtime = { app: Handler; sweep: () => Promise<void> };

let runtime: Promise<Runtime> | null = null;

/**
 * The app is imported dynamically, and that is deliberate.
 *
 * `env.ts` throws while it is being imported when a required variable is
 * missing, which is the right behaviour — but a top-level `import` of it makes
 * that throw happen before any code here runs, and the only thing Vercel can
 * say about a module that failed to load is FUNCTION_INVOCATION_FAILED. Pulling
 * it in from inside a function turns the same error into a response that names
 * the variable, which is the difference between a five-minute fix and an
 * afternoon.
 *
 * `loadActiveDisk` is awaited for a different reason: `getActiveDisk()` answers
 * with the MEDIA_DRIVER value until the stored override has been read, so a
 * request served before it lands could write an upload to the wrong disk. On
 * Vercel that means a read-only filesystem and a lost file. Memoised, so it is
 * one query per instance.
 */
function boot(): Promise<Runtime> {
  runtime ??= (async (): Promise<Runtime> => {
    // The `.js` extensions are required by `moduleResolution: nodenext` for a
    // dynamic import, and are correct at runtime in both builds: tsc emits
    // these files as .js, and esbuild resolves a .js specifier to its .ts
    // source when bundling TypeScript.
    const { createApp } = await import("../src/app.js");
    const { loadActiveDisk } = await import("../src/lib/storage.js");
    const { sweepQuietly } = await import("../src/lib/reservations.js");

    const app = createApp() as unknown as Handler;
    // Swallows its own errors and falls back to MEDIA_DRIVER, so this settles
    // even when the database is unreachable.
    await loadActiveDisk();

    return { app, sweep: sweepQuietly };
  })();

  return runtime;
}

/**
 * Expired reservations, swept from the request path.
 *
 * There is no long-lived process to hold a timer, and Vercel Cron on the Hobby
 * plan only fires daily — too coarse for a 30-minute hold. Traffic is the more
 * reliable clock: any request may trigger a sweep, at most once per instance
 * per interval. It is fire-and-forget and compare-and-set throughout, so being
 * killed halfway through leaves nothing half-done, and overlapping with the
 * cron or the CLI is safe.
 */
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = 0;

function maybeSweep(sweep: () => Promise<void>): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  void sweep();
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  let ready: Runtime;

  try {
    ready = await boot();
  } catch (error) {
    // Cleared so the next request retries rather than serving a cached failure
    // for the life of the instance.
    runtime = null;

    const detail = error instanceof Error ? error.message : String(error);
    console.error("The API failed to start:", error);

    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    // The message names a missing environment variable, never its value. That
    // is worth saying out loud on a deployment that cannot serve a request
    // without it.
    res.end(JSON.stringify({ error: "The API is not configured correctly.", detail }));
    return;
  }

  maybeSweep(ready.sweep);
  ready.app(req, res);
}
