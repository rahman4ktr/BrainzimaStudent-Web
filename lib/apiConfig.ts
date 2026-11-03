// lib/apiConfig.ts
// Production-safe API URL configuration and SSL sanitizer.
// Guarantees all requests to backend API use HTTPS to prevent Mixed Content blocking.

import { APP_CONFIG } from "./config";

/**
 * Returns the sanitized backend API URL.
 * Automatically strips accidental quotes, trailing slashes, upgrades HTTP to HTTPS,
 * and ensures '/api' suffix is present for endpoint routing.
 * Production default: https://api.brainzima.com/student/api
 */
export function getBackendApiUrl(): string {
  const raw =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.BACKEND_INTERNAL_URL ||
    APP_CONFIG.apiUrl ||
    "https://api.brainzima.com/student/api";

  let url = raw.replace(/^["']|["']$/g, "").trim().replace(/\/+$/, "");

  // If URL targets remote server over HTTP, enforce HTTPS
  if (
    url.startsWith("http://") &&
    !url.includes("localhost") &&
    !url.includes("127.0.0.1")
  ) {
    url = url.replace(/^http:\/\//i, "https://");
  }

  // If URL points to student base without '/api' (e.g. 'https://api.brainzima.com/student'),
  // ensure '/api' suffix is appended for API endpoints
  if (url.endsWith("/student")) {
    url = `${url}/api`;
  }

  return url;
}

/**
 * Returns the sanitized backend base root URL (without '/api'),
 * used for direct uploads, static documents, and public images.
 * Production default: https://api.brainzima.com/student
 */
export function getBackendBaseUrl(): string {
  const apiUrl = getBackendApiUrl();
  return apiUrl.replace(/\/api$/, "");
}
