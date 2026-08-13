import type { AuthTokenPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      /** Set by the requireAuth middleware once a Bearer token is verified. */
      auth?: AuthTokenPayload;
    }
  }
}

export {};
