// lib/session.ts
// Centralized authentication session management for Brainzima
// STRICT REQUIREMENT:
// - Uses sessionStorage ONLY (ONE key: "brainzima_session")
// - NO authentication data is stored in localStorage
// - On startup, cleans up any legacy localStorage session data

import type { LoginData } from "./api";
import { formatIstDateTime } from "./utils";

export { formatIstDateTime };

const SESSION_KEY = "brainzima_session";

// ── Cleanup legacy localStorage auth data on client startup ────────────────
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore storage access errors */
  }
}

export type BrainzimaSession = {
  user_id: number;
  name: string;
  email: string;
  mobile: string | null;
  role: "user" | "student" | string;
  is_student: boolean;
  student_id: number | null;
  registration_number: string | null;
  centre_id: number | null;
  user_image: string | null;
  user_verified: boolean;
  logged_in_at: string;
  last_login_at: string | null;
  last_login_ip: string | null;
};

// Backward-compatible type alias
export type Session = BrainzimaSession;

/**
 * Save authenticated session to sessionStorage ONLY.
 * Never stores password, password hash, OTP, or sensitive credentials.
 */
export function saveSession(
  data:
    | (Partial<Omit<BrainzimaSession, "user_verified">> & {
        user_id: number;
        name: string;
        email: string;
        user_verified?: boolean | number | null;
        last_login_at?: string | null;
        last_login_ip?: string | null;
      })
    | LoginData
): BrainzimaSession {
  const formattedLastLoginAt = data.last_login_at
    ? formatIstDateTime(data.last_login_at)
    : formatIstDateTime(new Date());

  if (typeof window === "undefined") {
    return {
      user_id: data.user_id,
      name: data.name,
      email: data.email,
      mobile: data.mobile ?? null,
      role: (data.role as "admin" | "user" | "student") || "user",
      is_student: Boolean(data.is_student),
      student_id: data.student_id ?? null,
      registration_number: data.registration_number ?? null,
      centre_id: data.centre_id ?? null,
      user_image: data.user_image ?? null,
      user_verified: Boolean(data.user_verified),
      logged_in_at: new Date().toISOString(),
      last_login_at: formattedLastLoginAt,
      last_login_ip: data.last_login_ip ?? null,
    };
  }

  // Ensure legacy localStorage key is definitely removed
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }

  const session: BrainzimaSession = {
    user_id: Number(data.user_id),
    name: data.name || "User",
    email: data.email || "",
    mobile: data.mobile ?? null,
    role: data.role || (data.is_student ? "student" : "user"),
    is_student: Boolean(data.is_student),
    student_id: data.student_id ? Number(data.student_id) : null,
    registration_number: data.registration_number ?? null,
    centre_id: data.centre_id ? Number(data.centre_id) : null,
    user_image: sanitizeImagePath(data.user_image),
    user_verified:
      typeof data.user_verified === "number"
        ? data.user_verified === 1
        : Boolean(data.user_verified),
    logged_in_at: new Date().toISOString(),
    last_login_at: formattedLastLoginAt,
    last_login_ip: data.last_login_ip ?? null,
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    // Dispatch custom event so same-tab components can react to session changes
    window.dispatchEvent(new CustomEvent("brainzima_session_change", { detail: session }));
  } catch (err) {
    console.error("[Session] Failed to write to sessionStorage:", err);
  }

  return session;
}

/**
 * Read authenticated session from sessionStorage ONLY.
 * Returns null if not logged in or during SSR.
 */
export function getSession(): BrainzimaSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrainzimaSession;
    if (!parsed || (!parsed.user_id && !parsed.student_id)) return null;
    return parsed;
  } catch (err) {
    console.warn("[Session] Failed to parse sessionStorage:", err);
    return null;
  }
}

/**
 * Update authenticated session in sessionStorage in-place.
 */
export function updateSession(partial: Partial<BrainzimaSession>): BrainzimaSession | null {
  if (typeof window === "undefined") return null;

  const current = getSession();
  if (!current) return null;

  const updated: BrainzimaSession = {
    ...current,
    ...partial,
    user_image:
      partial.user_image !== undefined
        ? sanitizeImagePath(partial.user_image)
        : current.user_image,
  };

  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("brainzima_session_change", { detail: updated }));
  } catch (err) {
    console.error("[Session] Failed to update sessionStorage:", err);
  }

  return updated;
}

/**
 * Clear authenticated session from sessionStorage on logout.
 */
export function clearSession(): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new CustomEvent("brainzima_session_change", { detail: null }));
  } catch (err) {
    console.error("[Session] Failed to clear sessionStorage:", err);
  }
}

/**
 * Check if the user is currently authenticated in sessionStorage.
 */
export function isAuthenticated(): boolean {
  return getSession() !== null;
}

/**
 * Determine where to redirect after login based on API response:
 * 1. is_student === true  → /student (ALWAYS priority, even if role is "user")
 * 2. role === "admin"     → /admin
 * 3. role === "student"   → /student
 * 4. default              → /user
 */
export function getRedirectPath(data: { is_student?: boolean; role?: string }): string {
  if (data.is_student) return "/student";
  if (data.role === "admin") return "/admin";
  if (data.role === "student") return "/student";
  return "/user";
}

/**
 * Resolves the appropriate course enrollment URL based on the user's student status.
 *
 * CASE 1 — FIRST-TIME NORMAL USER (is_student === false OR missing student_id):
 *   Navigates to /user/courses/enroll?course_id={courseId}
 *
 * CASE 2 — EXISTING STUDENT (is_student === true AND student_id exists):
 *   Navigates to /student/courses/enroll?course_id={courseId}
 */
export function getEnrollmentUrl(
  courseId: number | string,
  sessionOverride?: BrainzimaSession | null
): string {
  const session = sessionOverride !== undefined ? sessionOverride : getSession();

  const isExistingStudent = Boolean(
    session?.is_student === true &&
    session?.student_id &&
    Number(session.student_id) > 0
  );

  return isExistingStudent
    ? `/student/courses/enroll?course_id=${courseId}`
    : `/user/courses/enroll?course_id=${courseId}`;
}

export const getBrainzimaSession = getSession;

/**
 * Helper to sanitize image path string.
 * Rejects "null", "undefined", "", fake paths, and returns clean path or null.
 */
function sanitizeImagePath(path: unknown): string | null {
  if (!path || typeof path !== "string") return null;
  const trimmed = path.trim();
  if (
    !trimmed ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === "[object Object]"
  ) {
    return null;
  }
  return trimmed;
}

/**
 * Centralized Image URL resolver.
 * Example:
 *   getFileUrl("/public/uploads/users/17/profile.webp")
 *   returns:
 *   "https://student.brainzima.com/public/uploads/users/17/profile.webp"
 */
export function getFileUrl(path: string | null | undefined): string | null {
  const sanitized = sanitizeImagePath(path);
  if (!sanitized) return null;

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  // 1. Already an absolute HTTP / HTTPS URL
  if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
    if (
      isLocalhost &&
      (sanitized.includes("student.brainzima.com/") ||
        sanitized.includes("studnet.brainzima.com/"))
    ) {
      return sanitized.replace(/^https?:\/\/(student|studnet)\.brainzima\.com/, "");
    }
    return sanitized;
  }

  let clean = sanitized
    .replace(/^https?:\/\/[^/]+\/?/, "")
    .replace(/^(student|studnet)\.brainzima\.com\/?/, "");
  if (!clean.startsWith("/")) clean = `/${clean}`;

  if (!clean.startsWith("/public/")) {
    if (clean.startsWith("/uploads/")) {
      clean = `/public${clean}`;
    } else {
      clean = `/public/uploads/${clean.replace(/^\//, "")}`;
    }
  }

  // On localhost in browser, return relative clean path so it loads from local Next.js static server
  if (isLocalhost) {
    return clean;
  }

  const baseDomain = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://student.brainzima.com"
  ).replace(/\/$/, "");

  return `${baseDomain}${clean}`;
}

/**
 * Extract 1-2 initials from user full name for fallback avatar.
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
