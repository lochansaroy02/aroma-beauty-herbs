"use client";

import { useActionState } from "react";

import { Banner, Field, SubmitButton } from "@/components/form-parts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginAction, type FormState } from "@/lib/auth-actions";

const initialState: FormState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Admin sign-in</CardTitle>
        <CardDescription>
          For staff editing the site. Shopping happens on barbersyndicate.in.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="grid gap-5">
          {state.error && !state.fieldErrors ? (
            <Banner tone="error">{state.error}</Banner>
          ) : null}

          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            errors={state.fieldErrors?.email}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            errors={state.fieldErrors?.password}
          />

          <SubmitButton>Log in</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
