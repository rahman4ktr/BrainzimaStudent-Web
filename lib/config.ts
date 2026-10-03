// lib/config.ts
// Centralized frontend application configuration helper.
// Exposes only client-safe, public configuration (never server secrets).

export const APP_CONFIG = {
  apiUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    "https://try.ajitdev.com/brainzima/student/api",
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://studentbrainzima.vercel.app",
  razorpayKeyId:
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
};

/**
 * Safe public configuration diagnostic (safe for browser exposure).
 */
export function getClientConfigStatus() {
  return {
    apiConfigured: Boolean(APP_CONFIG.apiUrl),
    apiUrl: APP_CONFIG.apiUrl,
    razorpayPublicKeyConfigured: Boolean(APP_CONFIG.razorpayKeyId),
  };
}
