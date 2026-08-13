"use client";

import Link from "next/link";
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
        <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Log in to see your orders and saved blends.
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

        <p className="mt-6 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
