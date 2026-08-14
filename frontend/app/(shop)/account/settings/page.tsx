import { AlertCircleIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/shop/account/password-form";
import { ProfileForm } from "@/components/shop/account/profile-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchProfile } from "@/lib/account";
import { getSessionToken } from "@/lib/session";

export const metadata = { title: "Settings — Aroma Beauty Herbs" };

export default async function AccountSettingsPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const result = await fetchProfile(token);

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-mono text-[11px] tracking-[0.22em] text-clay uppercase">
          Account
        </p>
        <h1 className="mt-2 font-heading text-3xl tracking-tight text-ink">Setting</h1>
      </div>

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <ProfileForm profile={result.data.user} />
          <PasswordForm />
        </>
      )}
    </div>
  );
}
