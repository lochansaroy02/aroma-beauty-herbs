import "server-only";

import { redirect } from "next/navigation";

import { apiGet } from "./api";
import { getSessionToken } from "./session";

export type AdminUser = {
  id: number;
  name: string | null;
  email: string;
  role_as: string | null;
};

type MeResponse = { user: AdminUser };

/**
 * The authoritative admin check. The proxy only sees whether a cookie exists,
 * so every admin page confirms the session and role against the API.
 */
export async function requireAdminUser(): Promise<AdminUser> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const result = await apiGet<MeResponse>("/auth/me", token);
  if (!result.ok) redirect("/login");

  if (result.data.user.role_as !== "Admin") {
    redirect("/account?denied=admin");
  }

  return result.data.user;
}
