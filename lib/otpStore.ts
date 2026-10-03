// lib/otpStore.ts
// Secure OTP generation, hashing, rate limiting, and verification store.
// Strictly adheres to Brainzima auth requirements:
// - Cryptographically secure 6-digit OTP (crypto.randomInt)
// - Hash storage only (never stores raw OTP)
// - 10-minute expiration
// - One-time verification (hash & expiry cleared immediately upon success)
// - 60-second rate limiting on resend
// - No sensitive data leaked in responses

import crypto from "crypto";

export interface UserOtpState {
  email: string;
  name: string;
  mobile?: string;
  user_id?: number;
  user_image?: string | null;
  role?: "user" | "student" | "admin";
  is_student?: boolean;
  student_id?: number | null;
  registration_number?: string | null;
  user_otp_hash: string | null;
  otp_salt: string | null;
  user_otp_expires_at: number | null; // epoch ms
  user_verified: 0 | 1;
  last_sent_at: number; // epoch ms
}

// Global in-memory map to survive hot-reloads during Next.js development
declare global {
  var __brainzimaOtpStore: Map<string, UserOtpState> | undefined;
}

const otpStore: Map<string, UserOtpState> =
  globalThis.__brainzimaOtpStore ?? new Map<string, UserOtpState>();
globalThis.__brainzimaOtpStore = otpStore;

/**
 * Generate cryptographically secure 6-digit OTP (100000 - 999999).
 * Strictly avoids Math.random(), rand(), mt_rand().
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP with a random salt using HMAC-SHA256.
 */
export function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(otp).digest("hex");
}

/**
 * Timing-safe comparison to prevent timing attacks on OTP verification.
 */
export function verifyOtpHash(
  candidateOtp: string,
  salt: string,
  expectedHash: string
): boolean {
  try {
    const candidateHash = hashOtp(candidateOtp, salt);
    const bufA = Buffer.from(candidateHash, "hex");
    const bufB = Buffer.from(expectedHash, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Normalizes email address: lowercase and trimmed.
 */
export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Mask email for UI display: test@gmail.com -> te****@gmail.com
 */
export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return normalized;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}****@${domain}`;
}

/**
 * Store user and create initial OTP for new registration.
 * Replaces any existing pending OTP.
 */
export function createRegistrationOtp(params: {
  email: string;
  name: string;
  mobile?: string;
  user_id?: number;
  user_image?: string | null;
  role?: "user" | "student" | "admin";
  is_student?: boolean;
  student_id?: number | null;
  registration_number?: string | null;
}): { rawOtp: string; expiresAt: Date } {
  const normEmail = normalizeEmail(params.email);
  const rawOtp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtp(rawOtp, salt);
  const now = Date.now();
  const expiresAtMs = now + 10 * 60 * 1000; // 10 minutes

  const state: UserOtpState = {
    email: normEmail,
    name: params.name,
    mobile: params.mobile,
    user_id: params.user_id ?? Math.floor(1000 + Math.random() * 9000),
    user_image: params.user_image ?? null,
    role: params.role ?? "user",
    is_student: params.is_student ?? false,
    student_id: params.student_id ?? null,
    registration_number: params.registration_number ?? null,
    user_otp_hash: otpHash,
    otp_salt: salt,
    user_otp_expires_at: expiresAtMs,
    user_verified: 0,
    last_sent_at: now,
  };

  otpStore.set(normEmail, state);

  return {
    rawOtp,
    expiresAt: new Date(expiresAtMs),
  };
}

/**
 * Resend OTP with strict 60-second rate limiting.
 * Returns new raw OTP or rate limit status.
 */
export function resendOtp(email: string): {
  success: boolean;
  rateLimited?: boolean;
  waitSeconds?: number;
  rawOtp?: string;
  name?: string;
  message?: string;
} {
  const normEmail = normalizeEmail(email);
  const existing = otpStore.get(normEmail);

  const now = Date.now();

  // If record exists and was sent less than 60s ago
  if (existing && existing.last_sent_at) {
    const elapsed = now - existing.last_sent_at;
    if (elapsed < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - elapsed) / 1000);
      return {
        success: false,
        rateLimited: true,
        waitSeconds,
        message: "Please wait before requesting another OTP.",
      };
    }
  }

  // Generate new 6-digit OTP
  const rawOtp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtp(rawOtp, salt);
  const expiresAtMs = now + 10 * 60 * 1000; // 10 minutes

  const name = existing?.name ?? "Student";

  // Update record: old OTP is immediately invalidated
  const updated: UserOtpState = {
    email: normEmail,
    name,
    mobile: existing?.mobile,
    user_id: existing?.user_id,
    user_image: existing?.user_image ?? null,
    role: existing?.role ?? "user",
    is_student: existing?.is_student ?? false,
    student_id: existing?.student_id ?? null,
    registration_number: existing?.registration_number ?? null,
    user_otp_hash: otpHash,
    otp_salt: salt,
    user_otp_expires_at: expiresAtMs,
    user_verified: existing?.user_verified ?? 0,
    last_sent_at: now,
  };

  otpStore.set(normEmail, updated);

  return {
    success: true,
    rawOtp,
    name,
  };
}

export type VerifyOtpResult =
  | { success: true; user: UserOtpState }
  | { success: false; status: 422; message: string };

/**
 * Verify submitted OTP against stored hash.
 * On success:
 * - user_verified = 1
 * - user_otp_hash = NULL
 * - user_otp_expires_at = NULL
 * One-time use: subsequent checks will immediately fail.
 */
export function verifySubmittedOtp(
  email: string,
  candidateOtp: string
): VerifyOtpResult {
  const normEmail = normalizeEmail(email);
  const record = otpStore.get(normEmail);

  // If no record exists, or no pending OTP hash (e.g. already verified or cleared)
  if (!record || !record.user_otp_hash || !record.otp_salt) {
    return {
      success: false,
      status: 422,
      message: "OTP is invalid or has expired.",
    };
  }

  // Check expiration (10 minutes)
  const now = Date.now();
  if (!record.user_otp_expires_at || now > record.user_otp_expires_at) {
    // Invalidate expired OTP immediately
    record.user_otp_hash = null;
    record.otp_salt = null;
    record.user_otp_expires_at = null;
    otpStore.set(normEmail, record);

    return {
      success: false,
      status: 422,
      message: "OTP has expired.",
    };
  }

  // Check OTP format: exactly 6 digits
  const cleanOtp = candidateOtp.trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    return {
      success: false,
      status: 422,
      message: "Invalid or expired OTP.",
    };
  }

  // Verify hash using timing-safe comparison
  const isMatch = verifyOtpHash(cleanOtp, record.otp_salt, record.user_otp_hash);
  if (!isMatch) {
    return {
      success: false,
      status: 422,
      message: "Invalid or expired OTP.",
    };
  }

  // OTP is valid!
  // CRITICAL REQUIREMENT: Immediately clear OTP hash and expiry so it cannot be reused
  record.user_verified = 1;
  record.user_otp_hash = null;
  record.otp_salt = null;
  record.user_otp_expires_at = null;

  otpStore.set(normEmail, record);

  return {
    success: true,
    user: { ...record },
  };
}

/**
 * Check if a user's email has been verified.
 */
export function isUserVerified(email: string): boolean {
  const normEmail = normalizeEmail(email);
  const record = otpStore.get(normEmail);
  return record?.user_verified === 1;
}

/**
 * Get user record by email.
 */
export function getUserOtpState(email: string): UserOtpState | null {
  const normEmail = normalizeEmail(email);
  return otpStore.get(normEmail) ?? null;
}

/**
 * Remove user OTP record from memory (useful when resetting or re-registering).
 */
export function clearUserOtpState(email: string): boolean {
  const normEmail = normalizeEmail(email);
  return otpStore.delete(normEmail);
}

/**
 * Reset entire in-memory OTP cache.
 */
export function resetAllOtpStore(): void {
  otpStore.clear();
}

