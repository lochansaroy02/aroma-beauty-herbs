"use client";

import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  errors?: string[];
};

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  placeholder,
  hint,
  errors,
}: FieldProps) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const hasError = Boolean(errors?.length);

  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
      />
      {hasError ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors![0]}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2Icon className="animate-spin" /> : null}
      {pending ? "Working…" : children}
    </Button>
  );
}

/** Quiet secondary action — used for "send another code". */
export function TextButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="link" size="sm" disabled={pending} className="px-0">
      {pending ? "Sending…" : children}
    </Button>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "error" | "notice";
  children: React.ReactNode;
}) {
  const isError = tone === "error";

  return (
    <Alert variant={isError ? "destructive" : "default"} role="status">
      {isError ? <AlertCircleIcon /> : <CheckCircle2Icon />}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
