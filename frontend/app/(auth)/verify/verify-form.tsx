"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Banner, SubmitButton, TextButton } from "@/components/form-parts";
import { OtpCells } from "@/components/otp-cells";
import { StepRail } from "@/components/step-rail";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  resendOtpAction,
  verifyOtpAction,
  type FormState,
} from "@/lib/auth-actions";

const initialState: FormState = {};

export function VerifyForm({ email }: { email: string }) {
  const [verifyState, verify] = useActionState(verifyOtpAction, initialState);
  const [resendState, resend] = useActionState(resendOtpAction, initialState);

  return (
    <Card>
      <CardHeader>
        <StepRail current={2} />
        <CardTitle className="font-heading text-2xl">Check your email</CardTitle>
        <CardDescription>
          We sent a six-digit code to{" "}
          <span className="font-medium text-foreground">{email}</span>. It expires in
          10 minutes.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={verify} className="grid gap-5">
          <input type="hidden" name="email" value={email} />

          {verifyState.error ? (
            <Banner tone="error">{verifyState.error}</Banner>
          ) : null}
          {resendState.notice ? (
            <Banner tone="notice">{resendState.notice}</Banner>
          ) : null}
          {resendState.error ? (
            <Banner tone="error">{resendState.error}</Banner>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="otp-input">Verification code</Label>
            <OtpCells invalid={Boolean(verifyState.error)} />
            {typeof verifyState.attemptsRemaining === "number" ? (
              <p className="text-sm text-muted-foreground">
                {verifyState.attemptsRemaining} attempt
                {verifyState.attemptsRemaining === 1 ? "" : "s"} left on this code
              </p>
            ) : null}
          </div>

          <SubmitButton>Verify and continue</SubmitButton>
        </form>

        {/* Sibling, not nested — a form inside a form is invalid HTML. */}
        <form action={resend} className="mt-4">
          <input type="hidden" name="email" value={email} />
          <TextButton>Send another code</TextButton>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Wrong address?{" "}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            Start over
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}