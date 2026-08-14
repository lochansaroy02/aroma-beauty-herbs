import "server-only";

import { apiGet } from "./api";
import type { AccountProfile, AccountStats, Address } from "./catalog";

/** Server-side reads for the account area. Actions live in account-actions.ts. */

export function fetchAccountOverview(token: string) {
  return apiGet<{ stats: AccountStats }>("/account/overview", token);
}

export function fetchAddresses(token: string) {
  return apiGet<{ addresses: Address[] }>("/account/addresses", token);
}

export function fetchProfile(token: string) {
  return apiGet<{ user: AccountProfile }>("/account/profile", token);
}
