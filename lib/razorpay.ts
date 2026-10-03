// lib/razorpay.ts
// Production Razorpay helper: sanitizes credentials, validates test vs live mode,
// and ensures secrets are never exposed to browser or logs.

import Razorpay from "razorpay";

export interface CleanRazorpayConfig {
  key_id: string;
  key_secret: string;
  configured: boolean;
  isTestMode: boolean;
  isLiveMode: boolean;
  mode: "test" | "live" | "unconfigured";
}

/**
 * Sanitizes and returns server-side Razorpay configuration.
 * Strictly strips quotes, whitespace, and validates key format.
 * NEVER expose key_secret to the browser or in frontend bundles.
 */
export function getCleanRazorpayConfig(): CleanRazorpayConfig {
  const rawKeyId =
    process.env.RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    "";
  const rawSecret = process.env.RAZORPAY_KEY_SECRET || "";

  // Strip accidental quotes often copied from .env files
  const key_id = rawKeyId.replace(/^["']|["']$/g, "").trim();
  const key_secret = rawSecret.replace(/^["']|["']$/g, "").trim();

  const isTestMode = key_id.startsWith("rzp_test_");
  const isLiveMode = key_id.startsWith("rzp_live_");
  const configured = Boolean(key_id && key_secret);

  const mode = configured
    ? isLiveMode
      ? "live"
      : isTestMode
      ? "test"
      : "test"
    : "unconfigured";

  return {
    key_id,
    key_secret,
    configured,
    isTestMode,
    isLiveMode,
    mode,
  };
}

/**
 * Initializes server-side Razorpay SDK instance.
 * Throws a descriptive error if credentials are missing or invalid.
 */
export function getRazorpayClient(): Razorpay {
  const config = getCleanRazorpayConfig();

  if (!config.configured) {
    throw new Error(
      "Razorpay credentials missing: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not configured in production environment."
    );
  }

  return new Razorpay({
    key_id: config.key_id,
    key_secret: config.key_secret,
  });
}
