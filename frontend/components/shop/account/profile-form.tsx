"use client";

import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon, MailIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldErrors } from "@/lib/api";
import {
  cancelEmailChangeAction,
  resendEmailChangeAction,
  updateProfileAction,
  verifyEmailChangeAction,
} from "@/lib/account-actions";
import type { AccountProfile } from "@/lib/catalog";

/**
 * Name, phone and email.
 *
 * The email is the reason this is a client component: changing it doesn't take
 * effect on save, it starts a verification, and the form has to grow a code
 * field in place and keep the rest of the state while it does.
 */
export function ProfileForm({ profile }: { profile: AccountProfile }) {
  const [name, setName] = useState(profile.name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email);
  const [otp, setOtp] = useState("");

  // Seeded from the server so a half-finished change survives a reload.
  const [pendingEmail, setPendingEmail] = useState(profile.pending_email);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const emailChanged = email.trim().toLowerCase() !== profile.email.toLowerCase();

  function reset() {
    setError(null);
    setFieldErrors({});
    setNotice(null);
  }

  function save() {
    reset();

    startTransition(async () => {
      const result = await updateProfileAction({ name, phone, email });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      setNotice(result.notice ?? "Saved.");
      if (result.verificationRequired) setPendingEmail(email.trim().toLowerCase());
    });
  }

  function verify() {
    reset();

    startTransition(async () => {
      const result = await verifyEmailChangeAction(otp);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPendingEmail(null);
      setOtp("");
      setNotice(result.notice ?? "Email updated.");
    });
  }

  function abandon() {
    reset();

    startTransition(async () => {
      const result = await cancelEmailChangeAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPendingEmail(null);
      setOtp("");
      setEmail(profile.email);
      setNotice(result.notice ?? "Cancelled.");
    });
  }

  function resend() {
    reset();

    startTransition(async () => {
      const result = await resendEmailChangeAction();
      if (result.ok) setNotice(result.notice ?? "Code sent.");
      else setError(result.error);
    });
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-paper p-6">
      <h2 className="font-heading text-xl text-ink">Your details</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Changing your email needs a code sent to the new address.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className="mt-6 grid gap-4 sm:max-w-md"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="profile-name">Name</Label>
          <Input
            id="profile-name"
            value={name}
            autoComplete="name"
            required
            aria-invalid={fieldErrors["name"] ? true : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          {fieldErrors["name"]?.length ? (
            <p className="text-xs text-destructive">{fieldErrors["name"][0]}</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="profile-phone">Phone</Label>
          <Input
            id="profile-phone"
            type="tel"
            value={phone}
            autoComplete="tel"
            onChange={(event) => setPhone(event.target.value)}
          />
          {fieldErrors["phone"]?.length ? (
            <p className="text-xs text-destructive">{fieldErrors["phone"][0]}</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            autoComplete="email"
            required
            aria-invalid={fieldErrors["email"] ? true : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {fieldErrors["email"]?.length ? (
            <p className="text-xs text-destructive">{fieldErrors["email"][0]}</p>
          ) : null}
          {emailChanged && !pendingEmail ? (
            <p className="text-xs text-clay">
              Saving sends a code to {email.trim() || "the new address"}. Your current
              email stays active until you enter it.
            </p>
          ) : null}
        </div>

        <div>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </form>

      {pendingEmail ? (
        <div className="mt-6 grid gap-3 rounded-xl border border-ink/10 bg-paper-deep p-5 sm:max-w-md">
          <p className="flex items-center gap-2 font-heading text-base text-ink">
            <MailIcon className="size-4 text-clay" aria-hidden />
            Verify {pendingEmail}
          </p>
          <p className="text-sm text-ink-soft">
            Enter the 6-digit code we sent there. It expires in 10 minutes.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              verify();
            }}
            className="grid gap-3"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="profile-otp">Verification code</Label>
              <Input
                id="profile-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="\d{6}"
                placeholder="000000"
                value={otp}
                className="font-mono tracking-[0.3em]"
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || otp.length !== 6}>
                {busy ? <Loader2Icon className="animate-spin" /> : null}
                Confirm email
              </Button>
              <Button type="button" variant="outline" onClick={resend} disabled={busy}>
                Resend code
              </Button>
              <Button type="button" variant="outline" onClick={abandon} disabled={busy}>
                Cancel change
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Suppressed when a field already carries the specific reason — see
          password-form.tsx for the same reasoning. */}
      {error && Object.keys(fieldErrors).length === 0 ? (
        <Alert variant="destructive" className="mt-6 sm:max-w-md">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <p
          className="mt-6 flex items-center gap-2 text-sm text-ink-soft"
          role="status"
        >
          <CheckCircle2Icon className="size-4 text-clay" aria-hidden />
          {notice}
        </p>
      ) : null}
    </section>
  );
}
