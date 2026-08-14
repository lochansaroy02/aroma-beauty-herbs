"use client";

import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/lib/account-actions";
import type { FieldErrors } from "@/lib/api";

/**
 * Changing the password requires the current one.
 *
 * The confirmation field is checked here rather than server-side: it exists to
 * catch a typo in the browser, and sending it would only give the API a second
 * copy of the same secret to handle.
 */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && next !== confirm;

  function submit() {
    setError(null);
    setFieldErrors({});
    setNotice(null);

    if (next !== confirm) {
      setFieldErrors({ confirm: ["The two passwords don't match"] });
      return;
    }

    startTransition(async () => {
      const result = await changePasswordAction({
        current_password: current,
        new_password: next,
      });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      // Cleared on success so the secrets don't sit in the DOM afterwards.
      setCurrent("");
      setNext("");
      setConfirm("");
      setNotice(result.notice ?? "Password changed.");
    });
  }

  const fields = [
    {
      id: "current-password",
      label: "Current password",
      value: current,
      set: setCurrent,
      autoComplete: "current-password",
      error: fieldErrors["current_password"]?.[0],
    },
    {
      id: "new-password",
      label: "New password",
      value: next,
      set: setNext,
      autoComplete: "new-password",
      error: fieldErrors["new_password"]?.[0],
    },
    {
      id: "confirm-password",
      label: "Confirm new password",
      value: confirm,
      set: setConfirm,
      autoComplete: "new-password",
      error: fieldErrors["confirm"]?.[0] ?? (mismatch ? "The two passwords don't match" : undefined),
    },
  ] as const;

  return (
    <section className="rounded-2xl border border-ink/10 bg-paper p-6">
      <h2 className="font-heading text-xl text-ink">Password</h2>
      <p className="mt-1 text-sm text-ink-soft">
        At least 8 characters. You&rsquo;ll need your current one to change it.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="mt-6 grid gap-4 sm:max-w-md"
      >
        {fields.map((field) => (
          <div key={field.id} className="grid gap-1.5">
            <Label htmlFor={field.id}>{field.label}</Label>
            <Input
              id={field.id}
              type="password"
              required
              minLength={field.id === "current-password" ? undefined : 8}
              autoComplete={field.autoComplete}
              value={field.value}
              aria-invalid={field.error ? true : undefined}
              onChange={(event) => field.set(event.target.value)}
            />
            {field.error ? (
              <p className="text-xs text-destructive">{field.error}</p>
            ) : null}
          </div>
        ))}

        <div>
          <Button type="submit" disabled={busy || mismatch}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            Change password
          </Button>
        </div>
      </form>

      {/*
        Only when nothing more specific is on show. A 422 arrives as the banner
        "Validation failed" plus the real reason against the field it belongs
        to; printing both puts API wording in front of a customer for no gain.
      */}
      {error && Object.keys(fieldErrors).length === 0 ? (
        <Alert variant="destructive" className="mt-6 sm:max-w-md">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-ink-soft" role="status">
          <CheckCircle2Icon className="size-4 text-clay" aria-hidden />
          {notice}
        </p>
      ) : null}
    </section>
  );
}
