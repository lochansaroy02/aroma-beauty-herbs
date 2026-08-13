"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useState } from "react";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const LENGTH = 6;

/**
 * The visible slots are managed by input-otp; a hidden field carries the joined
 * value so the server action receives a single `otp` entry in FormData.
 */
export function OtpCells({ invalid = false }: { invalid?: boolean }) {
  const [value, setValue] = useState("");

  return (
    <>
      <input type="hidden" name="otp" value={value} />
      <InputOTP
        maxLength={LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        value={value}
        onChange={setValue}
        aria-invalid={invalid || undefined}
        aria-label="Six digit verification code"
        containerClassName="justify-start"
      >
        <InputOTPGroup>
          {Array.from({ length: LENGTH }, (_, index) => (
            <InputOTPSlot key={index} index={index} aria-invalid={invalid || undefined} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </>
  );
}