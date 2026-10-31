import { z } from "zod";

/** Shared signup/reset password rules — letter + number, min 8. */
export const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Use at least 8 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const credentialsSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Enter a valid email address"),
  password: passwordSchema,
  displayName: z.string().trim().min(1, "Name is required").max(48).optional(),
});
export type Credentials = z.infer<typeof credentialsSchema>;

/**
 * Sign-in accepts any shape a stored password could have had — including ones
 * that predate the current rules. Enforcing signup constraints here turns a
 * failed login into a policy disclosure, and rejects legitimate old passwords.
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});
export type LoginCredentials = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Enter a valid email address"),
  // Either an emailed reset code or the recovery code issued at signup on a
  // deployment that cannot send mail.
  token: z.string().trim().min(16, "Enter your reset code or recovery code"),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(16, "Enter the verification code from your email"),
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Enter a valid email address").optional(),
});

export const resendVerificationSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().toLowerCase().email("Enter a valid email address"),
});

export const MIN_HOLD_SECONDS = 5;
export const MAX_HOLD_SECONDS = 300;

export const posePlanSchema = z.object({
  slug: z.string().min(1),
  holdSeconds: z
    .number({ invalid_type_error: "Hold must be a number of seconds" })
    .int("Hold must be a whole number of seconds")
    .min(MIN_HOLD_SECONDS, `Hold at least ${MIN_HOLD_SECONDS} seconds`)
    .max(MAX_HOLD_SECONDS, `Hold at most ${MAX_HOLD_SECONDS} seconds (5 minutes)`),
  sides: z.enum(["once", "each"]).optional(),
});
export type PosePlan = z.infer<typeof posePlanSchema>;

/** Clamp a possibly-hostile number into the allowed hold range. */
export function clampHoldSeconds(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 30;
  return Math.min(MAX_HOLD_SECONDS, Math.max(MIN_HOLD_SECONDS, n));
}

