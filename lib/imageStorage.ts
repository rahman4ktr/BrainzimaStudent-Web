// lib/imageStorage.ts
// Centralized image lifecycle manager for Brainzima Student and User Profile Images
//
// Rules:
// 1. Permanent student directory: public/uploads/students/student-{user_id}/profile.{ext}
// 2. Permanent user directory:    public/uploads/users/user-{user_id}/profile.{ext}
// 3. Archived / replaced images moved to: public/uploads/delete/{role}-{user_id}-old-profile-{timestamp}-{unique}.{ext}
// 4. Database stores string path: /public/uploads/students/student-{user_id}/profile.{ext} or student.brainzima.com/...
// 5. Max size 5MB, formats: jpg, jpeg, png, webp
// 6. Zero file handling in PHP — handled purely by Next.js / storage provider

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];

// Target upload root: public/uploads
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

/**
 * Formats an image path for MySQL database storage:
 * Ensures the path starts with the domain prefix:
 * e.g. "studnet.brainzima.com/public/uploads/users/user-22/profile.jpg"
 */
export function formatDbImagePath(
  relativePath: string | null | undefined
): string | null {
  if (!relativePath || typeof relativePath !== "string") return null;
  const trimmed = relativePath.trim();
  if (
    !trimmed ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === "[object Object]"
  ) {
    return null;
  }

  const domain =
    process.env.NEXT_PUBLIC_IMAGE_DOMAIN ||
    process.env.IMAGE_DOMAIN ||
    "student.brainzima.com";

  // Clean away any existing protocol, domain, or leading slashes
  let clean = trimmed
    .replace(/^https?:\/\/[^/]+\/?/, "")
    .replace(/^(student|studnet)\.brainzima\.com\/?/, "")
    .replace(/^\/+/, "");

  if (!clean.startsWith("public/uploads/")) {
    if (clean.startsWith("uploads/")) {
      clean = `public/${clean}`;
    } else {
      clean = `public/uploads/${clean}`;
    }
  }

  return `${domain.replace(/\/$/, "")}/${clean}`;
}

/**
 * Ensure the required directories exist inside public/uploads:
 * - students/
 * - users/
 * - delete/
 * - temp/
 */
export async function ensureUploadDirs(
  userId?: number,
  role?: string
): Promise<void> {
  try {
    await fs.mkdir(path.join(UPLOADS_ROOT, "students"), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_ROOT, "users"), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_ROOT, "delete"), { recursive: true });
    await fs.mkdir(path.join(UPLOADS_ROOT, "temp"), { recursive: true });

    if (userId) {
      const isStudent = role?.toLowerCase() === "student";
      const targetSub = isStudent ? "students" : "users";
      const prefix = isStudent ? `student-${userId}` : `user-${userId}`;

      await fs.mkdir(path.join(UPLOADS_ROOT, targetSub, prefix), {
        recursive: true,
      });
      // Also ensure plain numeric folder for backward-compatibility
      await fs.mkdir(path.join(UPLOADS_ROOT, targetSub, String(userId)), {
        recursive: true,
      });
    }
  } catch (err) {
    console.warn("[ImageStorage] Error ensuring upload directories:", err);
  }
}

/**
 * Extracts a normalized extension (jpg, png, webp) from filename or path.
 */
export function extractExtension(filenameOrPath: string): string {
  const clean = filenameOrPath.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  if (parts.length > 1) {
    const ext = parts.pop()!.toLowerCase().trim();
    if (ext === "jpeg") return "jpg";
    if (ALLOWED_EXTENSIONS.includes(ext)) return ext;
  }
  return "webp";
}

/**
 * Generates an archive filename for deleted/replaced images.
 * Format: {role}-{user_id}-old-profile-{timestamp}-{unique}.{ext}
 * Example: student-17-old-profile-20261001-a82f.webp
 */
export function generateArchiveFilename(
  userId: number,
  originalExt: string,
  role?: string
): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T]/g, "").slice(0, 14); // YYYYMMDDHHMMSS
  const unique = crypto.randomBytes(2).toString("hex");
  const ext = originalExt.replace(/^\./, "");
  const prefix = role?.toLowerCase() === "student" ? "student" : "user";
  return `${prefix}-${userId}-old-profile-${dateStr}-${unique}.${ext}`;
}

/**
 * Moves an existing user or student image to public/uploads/delete/ without deleting it permanently.
 */
export async function archiveOldImage(
  userId: number,
  currentPublicPath?: string | null,
  role?: string
): Promise<string | null> {
  if (!currentPublicPath) return null;

  try {
    const ext = extractExtension(currentPublicPath);
    const archivedFilename = generateArchiveFilename(userId, ext, role);
    const deleteDir = path.join(UPLOADS_ROOT, "delete");
    await fs.mkdir(deleteDir, { recursive: true });

    // Candidate directories where the image might be stored
    const candidateDirs = [
      path.join(UPLOADS_ROOT, "students", `student-${userId}`),
      path.join(UPLOADS_ROOT, "students", String(userId)),
      path.join(UPLOADS_ROOT, "users", `user-${userId}`),
      path.join(UPLOADS_ROOT, "users", String(userId)),
    ];

    const candidates: string[] = [];

    // 1. Direct path check if currentPublicPath points to a local file
    const cleanPath = currentPublicPath.replace(
      /^(https?:\/\/[^/]+\/|(student|studnet)\.brainzima\.com\/|\/?public\/uploads\/|\/?uploads\/)/,
      ""
    );
    if (cleanPath) {
      candidates.push(path.join(UPLOADS_ROOT, cleanPath));
    }

    // 2. Standard pattern variations
    for (const cDir of candidateDirs) {
      candidates.push(
        path.join(cDir, `profile.${ext}`),
        path.join(cDir, "profile.webp"),
        path.join(cDir, "profile.jpg"),
        path.join(cDir, "profile.png"),
        path.join(cDir, "avatar.jpg"),
        path.join(cDir, "avatar.webp")
      );
    }

    let archived = false;
    for (const candidate of candidates) {
      try {
        const stats = await fs.stat(candidate);
        if (stats.isFile()) {
          const destPath = path.join(deleteDir, archivedFilename);
          await fs.copyFile(candidate, destPath);
          await fs.unlink(candidate).catch(() => {});
          archived = true;
          break;
        }
      } catch {
        /* continue checking next candidate */
      }
    }

    return archived ? archivedFilename : null;
  } catch (err) {
    console.warn(`[ImageStorage] Error archiving old image for id ${userId}:`, err);
    return null;
  }
}

/**
 * Saves a temporary uploaded image during registration before user_id is assigned.
 */
export async function saveTempImage(
  fileBuffer: Buffer,
  originalFilename?: string
): Promise<{ publicPath: string; filename: string }> {
  if (fileBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Profile image must be 5 MB or smaller.");
  }
  const ext = originalFilename ? extractExtension(originalFilename) : "webp";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("Invalid file type. Allowed formats: jpg, jpeg, png, webp.");
  }

  await ensureUploadDirs();
  const randomHex = crypto.randomBytes(4).toString("hex");
  const filename = `temp_${Date.now()}_${randomHex}.${ext}`;
  const relativePath = `/public/uploads/temp/${filename}`;
  const publicPath = formatDbImagePath(relativePath)!;

  const tempDir = path.join(UPLOADS_ROOT, "temp");
  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(path.join(tempDir, filename), fileBuffer);

  return { publicPath, filename };
}

/**
 * Finalizes registration image:
 * Moves temporary uploaded file to permanent location:
 * - Student: public/uploads/students/student-{user_id}/profile.{ext}
 * - User:    public/uploads/users/user-{user_id}/profile.{ext}
 * Returns the public path string formatted with domain prefix:
 * e.g. "studnet.brainzima.com/public/uploads/users/user-{user_id}/profile.{ext}"
 */
export async function finalizeRegistrationImage(
  userId: number,
  sourcePathOrFilename: string,
  role?: string
): Promise<string | null> {
  if (!sourcePathOrFilename || !sourcePathOrFilename.trim()) return null;

  const clean = sourcePathOrFilename.trim();
  const ext = extractExtension(clean);

  const isStudent = role?.toLowerCase() === "student";
  const targetSub = isStudent ? "students" : "users";
  const prefix = isStudent ? `student-${userId}` : `user-${userId}`;
  const targetRelativePath = `/public/uploads/${targetSub}/${prefix}/profile.${ext}`;
  const targetDbPath = formatDbImagePath(targetRelativePath)!;

  await ensureUploadDirs(userId, role);

  try {
    const filenameOnly = path.basename(clean);
    const possibleSources = [
      path.join(
        UPLOADS_ROOT,
        clean.replace(
          /^(\/|https?:\/\/[^/]+\/|(student|studnet)\.brainzima\.com\/|public\/uploads\/|\/public\/uploads\/)/,
          ""
        )
      ),
      path.join(UPLOADS_ROOT, "temp", filenameOnly),
      path.join(UPLOADS_ROOT, "users", filenameOnly),
      path.join(UPLOADS_ROOT, "students", filenameOnly),
      path.join(UPLOADS_ROOT, clean),
    ];

    let fileFound = false;
    for (const src of possibleSources) {
      try {
        const stats = await fs.stat(src);
        if (stats.isFile()) {
          const destDir = path.join(UPLOADS_ROOT, targetSub, prefix);
          await fs.mkdir(destDir, { recursive: true });
          const dest = path.join(destDir, `profile.${ext}`);

          if (src !== dest) {
            await fs.copyFile(src, dest);
            // Also copy to plain numeric directory for backward compatibility
            const fallbackDir = path.join(UPLOADS_ROOT, targetSub, String(userId));
            await fs.mkdir(fallbackDir, { recursive: true });
            await fs.copyFile(src, path.join(fallbackDir, `profile.${ext}`)).catch(() => {});

            // Clean up temporary registration file
            if (src.includes("temp") || src.includes("temp_")) {
              await fs.unlink(src).catch(() => {});
            }
          }
          fileFound = true;
          break;
        }
      } catch {
        /* try next source */
      }
    }

    return fileFound ? targetDbPath : null;
  } catch (err) {
    console.warn(`[ImageStorage] Error moving registration image:`, err);
    return null;
  }
}

/**
 * Updates a user or student profile image:
 * 1. Moves previous image to public/uploads/delete/
 * 2. Saves new buffer to:
 *    - For student: public/uploads/students/student-{user_id}/profile.{ext}
 *    - For user:    public/uploads/users/user-{user_id}/profile.{ext}
 * 3. Returns the new public path string with domain prefix:
 *    "studnet.brainzima.com/public/uploads/users/user-{user_id}/profile.{ext}"
 */
export async function updateUserProfileImage(params: {
  userId: number;
  fileBuffer: Buffer;
  originalFilename?: string;
  currentPublicPath?: string | null;
  role?: string;
  isStudent?: boolean;
}): Promise<string> {
  const {
    userId,
    fileBuffer,
    originalFilename,
    currentPublicPath,
    role,
    isStudent: isStudentParam,
  } = params;

  if (fileBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Profile image must be 5 MB or smaller.");
  }

  const ext = originalFilename ? extractExtension(originalFilename) : "webp";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("Invalid file type. Allowed formats: jpg, jpeg, png, webp.");
  }

  const isStudent = Boolean(
    isStudentParam ||
      role?.toLowerCase() === "student" ||
      currentPublicPath?.includes("students")
  );
  const targetRole = isStudent ? "student" : "user";
  const targetSub = isStudent ? "students" : "users";
  const prefix = isStudent ? `student-${userId}` : `user-${userId}`;

  await ensureUploadDirs(userId, targetRole);

  // 1. Move old image to public/uploads/delete/
  await archiveOldImage(userId, currentPublicPath, targetRole);

  // 2. Save new image to public/uploads/{targetSub}/{prefix}/profile.{ext}
  const destDir = path.join(UPLOADS_ROOT, targetSub, prefix);
  await fs.mkdir(destDir, { recursive: true });
  const targetFile = path.join(destDir, `profile.${ext}`);
  await fs.writeFile(targetFile, fileBuffer);

  // Also maintain plain numeric folder for backward-compatible links
  const fallbackDir = path.join(UPLOADS_ROOT, targetSub, String(userId));
  await fs.mkdir(fallbackDir, { recursive: true });
  await fs.writeFile(path.join(fallbackDir, `profile.${ext}`), fileBuffer).catch(() => {});

  const relativePath = `/public/uploads/${targetSub}/${prefix}/profile.${ext}`;
  return formatDbImagePath(relativePath)!;
}

/**
 * Centralized public path to browser URL converter.
 * Example:
 *   getBrowserFileUrl("studnet.brainzima.com/public/uploads/students/student-17/profile.webp")
 *   returns:
 *   "https://student.brainzima.com/public/uploads/students/student-17/profile.webp" (or relative "/public/uploads/..." on localhost)
 */
export function getBrowserFileUrl(publicPath: string | null | undefined): string | null {
  if (!publicPath || typeof publicPath !== "string") return null;
  const trimmed = publicPath.trim();
  if (
    !trimmed ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === "[object Object]"
  ) {
    return null;
  }

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (
      isLocalhost &&
      (trimmed.includes("student.brainzima.com/") ||
        trimmed.includes("studnet.brainzima.com/"))
    ) {
      return trimmed.replace(/^https?:\/\/(student|studnet)\.brainzima\.com/, "");
    }
    return trimmed;
  }

  let clean = trimmed
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

  if (isLocalhost) {
    return clean;
  }

  const baseDomain =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://student.brainzima.com";

  return `${baseDomain.replace(/\/$/, "")}${clean}`;
}

/**
 * Saves a student identity or academic document (photo, aadhaar, qualification).
 * Supports both images (jpg, png, webp) and PDF files.
 * Target path: public/uploads/students/{student_id}/{slug}.{ext}
 * Requirement 3 & 11: Final location must strictly use {student_id}.
 * Example: /public/uploads/students/14/profile.webp
 */
export async function saveStudentDocumentFile(options: {
  studentId: number | string;
  regno?: string | null;
  docType: string;
  fileBuffer: Buffer;
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
  const { studentId, docType, fileBuffer, originalFilename } = options;

  // Clean numeric student_id (e.g. 14, "14", or "student-14" -> "14")
  const rawIdStr = String(studentId).replace(/^student-/, "").trim();
  const studentIdNum = parseInt(rawIdStr, 10);
  if (!rawIdStr || isNaN(studentIdNum) || studentIdNum <= 0) {
    throw new Error("Valid student_id is required before uploading student documents.");
  }
  const folderName = String(studentIdNum);
  const targetDir = path.join(UPLOADS_ROOT, "students", folderName);
  await fs.mkdir(targetDir, { recursive: true });

  const rawExt = originalFilename.split(".").pop()?.toLowerCase() || "";
  let ext = rawExt === "jpeg" ? "jpg" : rawExt;

  let slug = "document";
  const dt = docType.toLowerCase();
  if (
    dt === "docs_st_image" ||
    dt === "profile" ||
    dt === "photo" ||
    dt === "avatar" ||
    dt === "image"
  ) {
    slug = "profile";
  } else if (
    dt === "docs_st_aadhaar_front" ||
    dt === "aadhaar_front" ||
    dt === "aadhaar-front"
  ) {
    slug = "aadhaar-front";
  } else if (
    dt === "docs_st_aadhaar_back" ||
    dt === "aadhaar_back" ||
    dt === "aadhaar-back"
  ) {
    slug = "aadhaar-back";
  } else if (
    dt === "docs_st_qualification" ||
    dt === "qualification"
  ) {
    slug = "qualification";
  }

  if (!ext) {
    ext = slug === "qualification" ? "pdf" : "webp";
  }

  const filename = `${slug}.${ext}`;
  const destPath = path.join(targetDir, filename);

  // Clean up any existing file for this slug with a different extension in the student folder
  const candidateExts = ["jpg", "jpeg", "png", "webp", "pdf"];
  for (const oldExt of candidateExts) {
    if (oldExt !== ext) {
      await fs.unlink(path.join(targetDir, `${slug}.${oldExt}`)).catch(() => {});
    }
  }

  await fs.writeFile(destPath, fileBuffer);

  // Backward compatibility: also keep student-{studentId} directory updated
  try {
    const legacyDir = path.join(UPLOADS_ROOT, "students", `student-${folderName}`);
    await fs.mkdir(legacyDir, { recursive: true });
    await fs.copyFile(destPath, path.join(legacyDir, filename)).catch(() => {});
  } catch {
    // Ignore legacy directory errors
  }

  const relativePath = `/public/uploads/students/${folderName}/${filename}`;
  const publicPath = formatDbImagePath(relativePath)!;
  const browserUrl = getBrowserFileUrl(publicPath)!;

  return {
    publicPath,
    path: publicPath,
    db_path: publicPath,
    browserUrl,
    url: browserUrl,
    filename,
    slug,
  };
}



