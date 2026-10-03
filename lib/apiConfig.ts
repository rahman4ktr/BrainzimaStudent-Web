// lib/apiConfig.ts
// Production-safe API URL configuration and SSL sanitizer.
// Guarantees all requests to backend API use HTTPS to prevent Mixed Content blocking.

import { APP_CONFIG } from "./config";

/**
 * Returns the sanitized backend API URL.
 * Automatically strips accidental quotes, trailing slashes, and upgrades HTTP to HTTPS.
 */
export function getBackendApiUrl(): string {
  const raw = APP_CONFIG.apiUrl || "https://try.ajitdev.com/brainzima/student/api";

  let url = raw.replace(/^["']|["']$/g, "").trim();

  // If URL targets try.ajitdev.com or any non-localhost over HTTP, enforce HTTPS
  if (url.startsWith("http://try.ajitdev.com")) {
    url = url.replace(/^http:\/\//i, "https://");
  } else if (
    process.env.NODE_ENV === "production" &&
    url.startsWith("http://") &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1")
  ) {
    url = url.replace(/^http:\/\//i, "https://");
  }

  // Remove any trailing slashes
  return url.replace(/\/+$/, "");
}
