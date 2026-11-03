// lib/passwordResetStore.ts
// In-memory Password Reset store for Brainzima.
// Adheres strictly to requirements:
// - 6-digit numeric OTP (crypto.randomInt)
// - Server-side hash storage only (HMAC-SHA256 with cryptographically random salt)
// - 10-minute OTP expiration
// - Max 5 verification attempts
// - One-time OTP use: invalidated immediately upon successful verification
// - Marks OTP verified state for password reset step (15-min window)
// - NO reset tokens, NO JWT, NO extra token schemes
// - Zero sensitive data exposed in logs or responses

import crypto from "crypto";

export interface PasswordResetState {
  email: string;
  name: string;
  user_id?: number;
  student_id?: number | null;
  is_student?: boolean;
  role?: string;

  // Dedicated Password Reset OTP fields
  password_reset_otp_hash: string | null;
  password_reset_otp_salt: string | null;
  password_reset_otp_expires_at: number | null; // epoch ms (10 minutes)
  password_reset_otp_attempts: number; // starts at 0, max 5

  // OTP Verification state (allows new password submission)
  password_reset_verified: boolean;
  password_reset_verified_at: number | null; // epoch ms (15 minutes window)

  last_requested_at: number; // epoch ms
}

declare global {
  var __brainzimaPasswordResetStore: Map<string, PasswordResetState> | undefined;
}

const resetStore: Map<string, PasswordResetState> =
  globalThis.__brainzimaPasswordResetStore ?? new Map<string, PasswordResetState>();
globalThis.__brainzimaPasswordResetStore = resetStore;

/**
 * Normalizes email address: lowercase and trimmed.
 */
export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Generate cryptographically secure 6-digit OTP (100000 - 999999).
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash data with a salt using HMAC-SHA256.
 */
export function hashWithSalt(data: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(data).digest("hex");
}

/**
 * Timing-safe comparison to prevent timing side-channel attacks.
 */
export function verifyHash(
  candidate: string,
  salt: string,
  expectedHash: string
): boolean {
  try {
    const candidateHash = hashWithSalt(candidate, salt);
    const bufA = Buffer.from(candidateHash, "hex");
    const bufB = Buffer.from(expectedHash, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Initiate a Password Reset request.
 * Generates secure 6-digit OTP, hashes it, and stores it in memory.
 */
export function createPasswordResetRequest(params: {
  email: string;
  name?: string;
  user_id?: number;
  student_id?: number | null;
  is_student?: boolean;
  role?: string;
}): {
  success: boolean;
  rawOtp?: string;
  name?: string;
  message?: string;
} {
  const normEmail = normalizeEmail(params.email);
  const now = Date.now();
  const existing = resetStore.get(normEmail);

  // Generate new secure 6-digit OTP
  const rawOtp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashWithSalt(rawOtp, salt);
  const expiresAtMs = now + 10 * 60 * 1000; // 10 minutes

  const name = params.name || existing?.name || "Student";

  const state: PasswordResetState = {
    email: normEmail,
    name,
    user_id: params.user_id ?? existing?.user_id,
    student_id: params.student_id ?? existing?.student_id ?? null,
    is_student: params.is_student ?? existing?.is_student ?? false,
    role: params.role ?? existing?.role ?? "user",

    password_reset_otp_hash: otpHash,
    password_reset_otp_salt: salt,
    password_reset_otp_expires_at: expiresAtMs,
    password_reset_otp_attempts: 0,

    password_reset_verified: false,
    password_reset_verified_at: null,

    last_requested_at: now,
  };

  resetStore.set(normEmail, state);

  return {
    success: true,
    rawOtp,
    name,
  };
}

export type VerifyResetOtpResult =
  | { success: true; email: string }
  | { success: false; message: string; status: number };

/**
 * Verify submitted OTP for password reset.
 * On success:
 * - Invalidates OTP immediately (one-time use)
 * - Marks password_reset_verified = true
 * - Allows subsequent step to reset password
 */
export function verifyPasswordResetOtp(
  email: string,
  candidateOtp: string
): VerifyResetOtpResult {
  const normEmail = normalizeEmail(email);
  const record = resetStore.get(normEmail);

  if (!record || !record.password_reset_otp_hash || !record.password_reset_otp_salt) {
    return {
      success: false,
      status: 422,
      message: "Invalid or expired OTP.",
    };
  }

  // Check attempt limit (max 5)
  if (record.password_reset_otp_attempts >= 5) {
    // Invalidate OTP completely
    record.password_reset_otp_hash = null;
    record.password_reset_otp_salt = null;
    record.password_reset_otp_expires_at = null;
    resetStore.set(normEmail, record);

    return {
      success: false,
      status: 422,
      message: "Invalid or expired OTP.",
    };
  }

  // Check expiration (10 minutes)
  const now = Date.now();
  if (
    !record.password_reset_otp_expires_at ||
    now > record.password_reset_otp_expires_at
  ) {
    record.password_reset_otp_hash = null;
    record.password_reset_otp_salt = null;
    record.password_reset_otp_expires_at = null;
    resetStore.set(normEmail, record);

    return {
      success: false,
      status: 422,
      message: "Invalid or expired OTP.",
    };
  }

  // Check format: exactly 6 digits
  const cleanOtp = (candidateOtp || "").trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    record.password_reset_otp_attempts += 1;
    resetStore.set(normEmail, record);
    return {
      success: false,
      status: 422,
      message: "Invalid or expired OTP.",
    };
  }

  // Verify hash using timing-safe comparison
  const isMatch = verifyHash(
    cleanOtp,
    record.password_reset_otp_salt,
    record.password_reset_otp_hash
  );

  if (!isMatch) {
    record.password_reset_otp_attempts += 1;
    if (record.password_reset_otp_attempts >= 5) {
      record.password_reset_otp_hash = null;
      record.password_reset_otp_salt = null;
      record.password_reset_otp_expires_at = null;
    }
    resetStore.set(normEmail, record);

    return {
      success: false,
      status: 422,
      message: "Invalid or expired OTP.",
    };
  }

  // ── OTP is verified! ──
  // Invalidate OTP immediately (one-time use)
  record.password_reset_otp_hash = null;
  record.password_reset_otp_salt = null;
  record.password_reset_otp_expires_at = null;

  // Mark verified for password reset (valid for 15 minutes)
  record.password_reset_verified = true;
  record.password_reset_verified_at = now;

  resetStore.set(normEmail, record);

  return {
    success: true,
    email: normEmail,
  };
}

/**
 * Check if the email has successfully verified its reset OTP and is eligible for password update.
 */
export function isPasswordResetVerified(email: string): {
  verified: boolean;
  message?: string;
  user?: PasswordResetState;
} {
  const normEmail = normalizeEmail(email);
  const record = resetStore.get(normEmail);

  if (!record || !record.password_reset_verified) {
    return {
      verified: false,
      message: "OTP has not been verified. Please verify your OTP first.",
    };
  }

  const now = Date.now();
  // 15-minute window after OTP verification to submit new password
  if (
    !record.password_reset_verified_at ||
    now - record.password_reset_verified_at > 15 * 60 * 1000
  ) {
    resetStore.delete(normEmail);
    return {
      verified: false,
      message: "Password reset authorization has expired. Please request a new OTP.",
    };
  }

  return {
    verified: true,
    user: record,
  };
}

/**
 * Clear reset state for an email after password has been successfully reset.
 */
export function clearPasswordResetState(email: string): boolean {
  const normEmail = normalizeEmail(email);
  return resetStore.delete(normEmail);
}
