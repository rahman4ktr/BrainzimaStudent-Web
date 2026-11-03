// lib/imageStorage.ts
// Pure URL & format helpers for Brainzima Student Management System.
// NOTE: All physical file storage and uploading is handled exclusively by the PHP REST backend at:
// https://api.brainzima.com/student
// Frontend does NOT store or manage physical files locally or in cloud blobs.

import crypto from "crypto";

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

const PHP_API_BASE = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.brainzima.com/student"
)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

/**
 * Normalizes any image/document path into the canonical full public URL:
 * https://api.brainzima.com/student/uploads/images/{folder}/{filename}
 */
export function toFullPublicUrl(path: string | null | undefined): string | null {
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

  // Already a full HTTP/HTTPS URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    // If it's already pointing to the PHP API uploads, return as is
    if (trimmed.includes("/uploads/images/")) {
      return trimmed;
    }
    // If it points to legacy domain without /uploads/images/, normalize it
    if (trimmed.includes("student.brainzima.com/") || trimmed.includes("studnet.brainzima.com/")) {
      const relative = trimmed.replace(/^https?:\/\/(student|studnet)\.brainzima\.com\/?/, "");
      return toFullPublicUrl(relative);
    }
    return trimmed;
  }

  // Normalize relative path
  let clean = trimmed.replace(/^\/+/, "");

  // If starts with "uploads/images/"
  if (clean.startsWith("uploads/images/")) {
    return `${PHP_API_BASE}/${clean}`;
  }

  // If starts with "uploads/" (e.g. uploads/users/... or uploads/students/...)
  if (clean.startsWith("uploads/")) {
    const afterUploads = clean.replace(/^uploads\//, "");
    if (!afterUploads.startsWith("images/")) {
      return `${PHP_API_BASE}/uploads/images/${afterUploads}`;
    }
    return `${PHP_API_BASE}/${clean}`;
  }

  // Legacy mappings:
  // public/users/xxx -> uploads/images/users/xxx
  // users/xxx -> uploads/images/users/xxx
  clean = clean.replace(/^public\//, "");

  if (clean.startsWith("users/")) {
    return `${PHP_API_BASE}/uploads/images/users/${clean.replace(/^users\//, "")}`;
  }
  if (clean.startsWith("students/") || clean.startsWith("studnets/")) {
    return `${PHP_API_BASE}/uploads/images/students/${clean.replace(/^(students|studnets)\//, "")}`;
  }
  if (clean.startsWith("course/")) {
    return `${PHP_API_BASE}/${clean}`;
  }
  if (clean.startsWith("notes/")) {
    return `${PHP_API_BASE}/${clean}`;
  }
  if (clean.startsWith("adharfront/")) {
    return `${PHP_API_BASE}/uploads/images/adharfront/${clean.replace(/^adharfront\//, "")}`;
  }
  if (clean.startsWith("adharback/")) {
    return `${PHP_API_BASE}/uploads/images/adharback/${clean.replace(/^adharback\//, "")}`;
  }
  if (clean.startsWith("qualification/")) {
    return `${PHP_API_BASE}/uploads/images/qualification/${clean.replace(/^qualification\//, "")}`;
  }

  // Default fallback: assume users folder if it's a profile image filename
  if (clean.includes("profile") || clean.includes("avatar")) {
    return `${PHP_API_BASE}/uploads/images/users/${clean}`;
  }

  return `${PHP_API_BASE}/uploads/images/${clean}`;
}

/**
 * Centralized browser-renderable image URL resolver.
 * Replaces old filesystem/Blob resolution.
 */
export function getBrowserFileUrl(
  publicPath: string | null | undefined
): string | null {
  return toFullPublicUrl(publicPath);
}

/**
 * Formats database image path to canonical full public URL string.
 */
export function formatDbImagePath(
  relativePath: string | null | undefined
): string | null {
  return toFullPublicUrl(relativePath);
}

/**
 * Extracts a normalized extension (jpg, png, webp, pdf) from filename or URL.
 */
export function extractExtension(filenameOrPath: string): string {
  const clean = (filenameOrPath || "").split("?")[0].split("#")[0];
  const parts = clean.split(".");
  if (parts.length > 1) {
    const ext = parts.pop()!.toLowerCase().trim();
    if (ext === "jpeg") return "jpg";
    if ([...ALLOWED_EXTENSIONS, "pdf"].includes(ext)) return ext;
  }
  return "webp";
}

/**
 * Compatibility helper for existing callers.
 * Returns the canonical public URL.
 */
export async function finalizeRegistrationImage(
  _userId: number,
  sourcePathOrUrl: string,
  _role?: string
): Promise<string | null> {
  return toFullPublicUrl(sourcePathOrUrl);
}

/**
 * Compatibility helper for existing callers.
 * No local disk archive needed as PHP handles physical file deletion/archiving.
 */
export async function archiveOldImage(
  _userId: number,
  _currentPublicPath?: string | null,
  _role?: string
): Promise<string | null> {
  return null;
}

/**
 * Compatibility no-op helper.
 */
export async function ensureUploadDirs(
  _userId?: number,
  _role?: string
): Promise<void> {
  // Physical directories exist on PHP backend
}

/**
 * Legacy archive filename generator.
 */
export function generateArchiveFilename(
  userId: number,
  originalExt: string,
  role?: string
): string {
  const dateStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const unique = crypto.randomBytes(2).toString("hex");
  const ext = originalExt.replace(/^\./, "");
  const prefix = role?.toLowerCase() === "student" ? "student" : "user";
  return `${prefix}-${userId}-old-profile-${dateStr}-${unique}.${ext}`;
}

/**
 * Compatibility helper for pre-registration image uploads.
 */
export async function saveTempImage(
  _fileBuffer: Buffer,
  originalFilename?: string
): Promise<{ publicPath: string; filename: string }> {
  const ext = originalFilename ? extractExtension(originalFilename) : "jpg";
  const filename = `temp-${Date.now()}.${ext}`;
  const publicPath = `${PHP_API_BASE}/uploads/images/users/${filename}`;
  return { publicPath, filename };
}

/**
 * Compatibility helper for student document file saves.
 */
export async function saveStudentDocumentFile(options: {
  studentId: number | string;
  regno?: string | null;
  docType: string;
  fileBuffer?: Buffer;
  originalFilename: string;
}): Promise<{
  publicPath: string;
  path: string;
  db_path: string;
  browserUrl: string;
  url: string;
  filename: string;
  slug: string;
}> {
  const { studentId, docType, originalFilename } = options;
  const ext = extractExtension(originalFilename);
  const filename = `student-${studentId}-${docType}-${Date.now()}.${ext}`;

  let folder = "students";
  const dt = docType.toLowerCase();
  if (dt.includes("front") || dt.includes("aadhaar_front")) folder = "adharfront";
  else if (dt.includes("back") || dt.includes("aadhaar_back")) folder = "adharback";
  else if (dt.includes("qual") || dt.includes("qualification")) folder = "qualification";

  const publicUrl = `${PHP_API_BASE}/uploads/images/${folder}/${filename}`;
  return {
    publicPath: publicUrl,
    path: publicUrl,
    db_path: publicUrl,
    browserUrl: publicUrl,
    url: publicUrl,
    filename,
    slug: docType,
  };
}

/**
 * Compatibility helper for user profile image updates.
 */
export async function updateUserProfileImage(params: {
  userId: number;
  fileBuffer?: Buffer;
  originalFilename?: string;
  currentPublicPath?: string | null;
  role?: string;
  isStudent?: boolean;
}): Promise<string> {
  const { userId, originalFilename, isStudent } = params;
  const ext = originalFilename ? extractExtension(originalFilename) : "jpg";
  const folder = isStudent ? "students" : "users";
  const prefix = isStudent ? "student" : "user";
  const filename = `${prefix}-${userId}-profile-${Date.now()}.${ext}`;
  return `${PHP_API_BASE}/uploads/images/${folder}/${filename}`;
}
