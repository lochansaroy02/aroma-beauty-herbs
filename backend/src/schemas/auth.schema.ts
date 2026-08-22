import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

/**
 * Sign-in only. Registration, OTP verification and the password rules that went
 * with them left with the customer accounts — admins are created server-side by
 * `npm run make:admin` / `npm run set:password`, which do their own hashing.
 */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
