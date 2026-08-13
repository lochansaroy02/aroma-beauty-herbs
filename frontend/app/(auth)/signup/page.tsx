"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Banner, Field, SubmitButton } from "@/components/form-parts";
import { StepRail } from "@/components/step-rail";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signupAction, type FormState } from "@/lib/auth-actions";

const initialState: FormState = {};

export default function SignupPage() {
  const [state, formAction] = useActionState(signupAction, initialState);

  return (
    <Card>
      <CardHeader>
        <StepRail current={1} />
        <CardTitle className="font-heading text-2xl">Create your account</CardTitle>
        <CardDescription>
          We&rsquo;ll email you a six-digit code to confirm the address.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="grid gap-5">
          {state.error && !state.fieldErrors ? (
            <Banner tone="error">{state.error}</Banner>
          ) : null}

          <Field
            label="Full name"
            name="name"
            autoComplete="name"
            required
            errors={state.fieldErrors?.name}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            errors={state.fieldErrors?.email}
          />
          <Field
            label="Phone (optional)"
            name="phone"
            type="tel"
            autoComplete="tel"
            errors={state.fieldErrors?.phone}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters."
            errors={state.fieldErrors?.password}
          />

          <SubmitButton>Send my code</SubmitButton>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
