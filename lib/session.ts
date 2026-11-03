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

export type StudentDocuments = {
  docs_st_image?: string | null;
  docs_st_aadhaar_front?: string | null;
  docs_st_aadhaar_back?: string | null;
  docs_st_qualification?: string | null;
};

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
  // Student Specific Additions
  dob?: string | null;
  st_dob?: string | null;
  docs_st_image?: string | null;
  docs_st_aadhaar_front?: string | null;
  docs_st_aadhaar_back?: string | null;
  docs_st_qualification?: string | null;
  documents?: StudentDocuments | null;
};

// Backward-compatible type alias
export type Session = BrainzimaSession;

/**
 * Helper to check whether today is the student's birthday.
 * Compares current month & day in local / IST with DOB (e.g. YYYY-MM-DD or DD/MM/YYYY).
 */
export function isBirthdayToday(dob: string | null | undefined): boolean {
  if (!dob || typeof dob !== "string") return false;
  const trimmed = dob.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate(); // 1-31

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m === currentMonth && d === currentDay) return true;
  }

  // 2. DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    if (m === currentMonth && d === currentDay) return true;
  }

  // 3. Fallback standard parse
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.getMonth() + 1 === currentMonth && parsed.getDate() === currentDay;
    }
  } catch {
    /* ignore parse errors */
  }

  return false;
}

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

  const rawDob = (data as any).dob || (data as any).st_dob || null;
  const rawImage =
    (data as any).docs_st_image ||
    (data as any).documents?.docs_st_image ||
    data.user_image ||
    null;
  const rawAadhFront =
    (data as any).docs_st_aadhaar_front ||
    (data as any).documents?.docs_st_aadhaar_front ||
    null;
  const rawAadhBack =
    (data as any).docs_st_aadhaar_back ||
    (data as any).documents?.docs_st_aadhaar_back ||
    null;
  const rawQual =
    (data as any).docs_st_qualification ||
    (data as any).documents?.docs_st_qualification ||
    null;

  const docsObj: StudentDocuments | null =
    (data as any).documents ||
    (rawImage || rawAadhFront || rawAadhBack || rawQual
      ? {
          docs_st_image: sanitizeImagePath(rawImage),
          docs_st_aadhaar_front: sanitizeImagePath(rawAadhFront),
          docs_st_aadhaar_back: sanitizeImagePath(rawAadhBack),
          docs_st_qualification: sanitizeImagePath(rawQual),
        }
      : null);

  if (typeof window === "undefined") {
    return {
      user_id: data.user_id,
      name: data.name,
      email: data.email,
      mobile: data.mobile ?? null,
      role: (data.role as "user" | "student") || "user",
      is_student: Boolean(data.is_student),
      student_id: data.student_id ?? null,
      registration_number: data.registration_number ?? null,
      centre_id: data.centre_id ?? null,
      user_image: data.user_image ?? null,
      user_verified: Boolean(data.user_verified),
      logged_in_at: new Date().toISOString(),
      last_login_at: formattedLastLoginAt,
      last_login_ip: data.last_login_ip ?? null,
      dob: rawDob,
      st_dob: rawDob,
      docs_st_image: sanitizeImagePath(rawImage),
      docs_st_aadhaar_front: sanitizeImagePath(rawAadhFront),
      docs_st_aadhaar_back: sanitizeImagePath(rawAadhBack),
      docs_st_qualification: sanitizeImagePath(rawQual),
      documents: docsObj,
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
    user_image: sanitizeImagePath(data.user_image || rawImage),
    user_verified:
      typeof data.user_verified === "number"
        ? data.user_verified === 1
        : Boolean(data.user_verified),
    logged_in_at: new Date().toISOString(),
    last_login_at: formattedLastLoginAt,
    last_login_ip: data.last_login_ip ?? null,
    dob: rawDob,
    st_dob: rawDob,
    docs_st_image: sanitizeImagePath(rawImage),
    docs_st_aadhaar_front: sanitizeImagePath(rawAadhFront),
    docs_st_aadhaar_back: sanitizeImagePath(rawAadhBack),
    docs_st_qualification: sanitizeImagePath(rawQual),
    documents: docsObj,
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

  // 2. PHP REST API flat upload path (uploads/images/...) or course asset images
  const normalizedPath = sanitized.replace(/^\/+/, "");
  if (
    normalizedPath.startsWith("uploads/") ||
    normalizedPath.startsWith("onlinecoures/") ||
    normalizedPath.startsWith("course/")
  ) {
    const apiBase = (
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://api.brainzima.com/student"
    ).replace(/\/+$/, "").replace(/\/api$/, "");
    return `${apiBase}/${normalizedPath}`;
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
 * Returns direct fully qualified URL for course banners & thumbnails.
 */
export function getCourseImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const sanitized = sanitizeImagePath(path);
  if (!sanitized) return null;
  if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
    return sanitized;
  }
  const clean = sanitized.replace(/^\/+/, "");
  const apiBase = (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.brainzima.com/student"
  ).replace(/\/+$/, "").replace(/\/api$/, "");
  return `${apiBase}/${clean}`;
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
