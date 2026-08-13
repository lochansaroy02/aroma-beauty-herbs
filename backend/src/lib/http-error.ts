/**
 * Error carrying an HTTP status, so controllers can throw and let the shared
 * error middleware turn it into a response. Express 5 forwards rejected async
 * handlers automatically, so `throw` inside a controller is safe.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}
