"use client";

import { CheckIcon, Loader2Icon, SendIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { sendContactAction, type ContactInput } from "@/lib/contact-actions";
import type { FieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The enquiry form.
 *
 * Storefront controls rather than the admin's shadcn inputs: this page sits in
 * the shop's paper-and-ink palette, and a white card with rounded corners would
 * read as a different product.
 */

const EMPTY: ContactInput = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  website: "",
};

const FIELD =
  "w-full border border-ink/20 bg-paper px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-soft/50 focus:border-ink";

export function ContactForm() {
  const [values, setValues] = useState<ContactInput>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  function set(field: keyof ContactInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear the field's error as soon as it's touched — leaving it there while
    // someone is fixing it reads as the correction not being registered.
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setErrors({});

    startTransition(async () => {
      const result = await sendContactAction(values);

      if (result.ok) {
        setSent(result.reference);
        setValues(EMPTY);
        return;
      }

      setError(result.error);
      if (result.fieldErrors) setErrors(result.fieldErrors);
    });
  }

  if (sent !== null) {
    return (
      <div className="border border-leaf/30 bg-leaf/5 px-8 py-12 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-leaf text-paper">
          <CheckIcon className="size-5" strokeWidth={1.75} />
        </span>

        <h2
          className="mt-6 font-heading text-2xl text-ink"
          style={{ fontVariationSettings: '"SOFT" 50, "WONK" 1, "opsz" 48' }}
        >
          Thank you — that&rsquo;s with us
        </h2>

        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
          We read everything and usually reply within two working days.
          {sent ? (
            <>
              {" "}
              Your reference is{" "}
              <span className="font-mono text-ink">#{String(sent).padStart(4, "0")}</span>.
            </>
          ) : null}
        </p>

        <button
          type="button"
          onClick={() => setSent(null)}
          className="mt-8 border border-ink/25 px-6 py-3 font-mono text-[11px] tracking-[0.2em] text-ink uppercase transition-colors hover:border-ink"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" error={errors["name"]}>
          <input
            id="name"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            className={cn(FIELD, errors["name"] && "border-destructive")}
            autoComplete="name"
            maxLength={120}
            disabled={pending}
          />
        </Field>

        <Field label="Email" name="email" error={errors["email"]}>
          <input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => set("email", event.target.value)}
            className={cn(FIELD, errors["email"] && "border-destructive")}
            autoComplete="email"
            maxLength={200}
            disabled={pending}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" name="phone" optional error={errors["phone"]}>
          <input
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(event) => set("phone", event.target.value)}
            className={cn(FIELD, errors["phone"] && "border-destructive")}
            autoComplete="tel"
            maxLength={20}
            disabled={pending}
          />
        </Field>

        <Field label="Subject" name="subject" optional error={errors["subject"]}>
          <input
            id="subject"
            value={values.subject}
            onChange={(event) => set("subject", event.target.value)}
            className={cn(FIELD, errors["subject"] && "border-destructive")}
            placeholder="Order, ingredients, stockists…"
            maxLength={150}
            disabled={pending}
          />
        </Field>
      </div>

      <Field label="Message" name="message" error={errors["message"]}>
        <textarea
          id="message"
          value={values.message}
          onChange={(event) => set("message", event.target.value)}
          className={cn(FIELD, "min-h-40 resize-y", errors["message"] && "border-destructive")}
          maxLength={4000}
          disabled={pending}
        />
      </Field>

      {/*
        Honeypot. Hidden from people and from screen readers, but a bot filling
        every input it finds will tick it — and the API drops those silently.
      */}
      <div aria-hidden className="hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => set("website", event.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-3 bg-ink px-8 py-4 font-mono text-[11px] tracking-[0.2em] text-paper uppercase transition-colors hover:bg-leaf disabled:opacity-60"
        >
          {pending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SendIcon className="size-3.5" strokeWidth={1.75} />
          )}
          {pending ? "Sending" : "Send message"}
        </button>

        <p className="text-xs text-ink-soft">
          We&rsquo;ll only use your details to reply.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  optional,
  error,
  children,
}: {
  label: string;
  name: string;
  optional?: boolean;
  error?: string[] | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label
        htmlFor={name}
        className="font-mono text-[11px] tracking-[0.18em] text-ink-soft uppercase"
      >
        {label}
        {optional ? <span className="text-clay"> (optional)</span> : null}
      </label>
      {children}
      {error?.[0] ? <p className="text-sm text-destructive">{error[0]}</p> : null}
    </div>
  );
}
