// app/api/upload/route.ts
// Proxies file uploads directly to the Brainzima PHP REST API backend.
// Frontend does NOT store files locally or on disk. All physical files are saved by PHP in uploads/images/.

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";
import {
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  extractExtension,
  toFullPublicUrl,
} from "@/lib/imageStorage";

const PHP_API = getBackendApiUrl();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("user_image")) as File | null;
    const rawUserId =
      formData.get("userId") ||
      formData.get("user_id") ||
      req.headers.get("x-user-id");
    const rawRole =
      formData.get("role")?.toString() ||
      formData.get("user_role")?.toString() ||
      req.headers.get("x-user-role") ||
      "";
    const rawIsStudent =
      formData.get("is_student")?.toString() ||
      formData.get("isStudent")?.toString();
    const isStudent =
      rawIsStudent === "true" ||
      rawIsStudent === "1" ||
      rawRole.toLowerCase() === "student";
    const role = isStudent ? "student" : (rawRole || "user");

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided." },
        { status: 400 }
      );
    }

    // ── Dedicated Student Document Upload Branch ────────────────────────────
    const docType = (formData.get("doc_type") || formData.get("docType"))?.toString();
    const rawStudentId =
      formData.get("student_id") ||
      formData.get("studentId");

    if (docType) {
      if (!rawStudentId) {
        return NextResponse.json(
          {
            success: false,
            message: "student_id is required before uploading student documents.",
          },
          { status: 400 }
        );
      }

      const allowedDocExts = ["jpg", "jpeg", "png", "webp", "pdf"];
      const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
      if (!allowedDocExts.includes(rawExt)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid file type. Allowed formats: JPG, PNG, WEBP, PDF.",
          },
          { status: 422 }
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          {
            success: false,
            message: "Document file must be 10 MB or smaller.",
          },
          { status: 422 }
        );
      }

      // ── Send to PHP REST API (FileUploadHelper + Flat Storage) ──────────────
      let phpFieldName = "docs_st_image";
      const dt = docType.toLowerCase();
      if (dt.includes("front") || dt.includes("aadhaar_front")) {
        phpFieldName = "docs_st_aadhaar_front";
      } else if (dt.includes("back") || dt.includes("aadhaar_back")) {
        phpFieldName = "docs_st_aadhaar_back";
      } else if (dt.includes("qual") || dt.includes("qualification")) {
        phpFieldName = "docs_st_qualification";
      }

      const bytes = await file.arrayBuffer();
      const blob = new Blob([bytes], { type: file.type || "application/octet-stream" });
      const phpForm = new FormData();
      phpForm.append(phpFieldName, blob, file.name || `${phpFieldName}.${rawExt}`);
      if (phpFieldName === "docs_st_aadhaar_front") {
        phpForm.append("aadhaar_front", blob, file.name || `aadhaar_front.${rawExt}`);
      } else if (phpFieldName === "docs_st_aadhaar_back") {
        phpForm.append("aadhaar_back", blob, file.name || `aadhaar_back.${rawExt}`);
      } else if (phpFieldName === "docs_st_qualification") {
        phpForm.append("qualification", blob, file.name || `qualification.${rawExt}`);
      }

      const phpRes = await fetch(`${PHP_API}/document/student/${rawStudentId}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-User-Id": String(rawUserId || 0),
          "X-User-Role": "student",
        },
        body: phpForm,
      });

      const json = await phpRes.json().catch(() => null);

      if (!phpRes.ok || !json?.success) {
        return NextResponse.json(
          {
            success: false,
            message: json?.message || "Failed to upload document to PHP backend.",
          },
          { status: phpRes.status || 500 }
        );
      }

      const backendData = json.data || {};
      let backendReturnedPath: string | null = null;
      if (phpFieldName === "docs_st_image") {
        backendReturnedPath =
          backendData.docs_st_image ||
          backendData.user_image ||
          backendData.image ||
          backendData.path ||
          null;
      } else if (phpFieldName === "docs_st_aadhaar_front") {
        backendReturnedPath =
          backendData.docs_st_aadhaar_front ||
          backendData.aadhaar_front ||
          backendData.path ||
          null;
      } else if (phpFieldName === "docs_st_aadhaar_back") {
        backendReturnedPath =
          backendData.docs_st_aadhaar_back ||
          backendData.aadhaar_back ||
          backendData.path ||
          null;
      } else if (phpFieldName === "docs_st_qualification") {
        backendReturnedPath =
          backendData.docs_st_qualification ||
          backendData.qualification ||
          backendData.path ||
          null;
      } else {
        backendReturnedPath = backendData[phpFieldName] || backendData.path || null;
      }

      const fullPublicUrl = toFullPublicUrl(backendReturnedPath);

      // Ensure MySQL database stores the full canonical public URL string
      if (fullPublicUrl) {
        try {
          await fetch(`${PHP_API}/document/student/${rawStudentId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-User-Id": String(rawUserId || 0),
              "X-User-Role": "student",
            },
            body: JSON.stringify({
              [phpFieldName]: fullPublicUrl,
            }),
          });
        } catch (syncErr) {
          console.warn("[Upload API] Notice syncing full document URL to DB:", syncErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Document uploaded successfully.",
        doc_type: phpFieldName,
        path: fullPublicUrl,
        db_path: fullPublicUrl,
        url: fullPublicUrl,
        user_image: phpFieldName === "docs_st_image" ? fullPublicUrl : undefined,
        data: {
          ...backendData,
          [phpFieldName]: fullPublicUrl,
        },
      });
    }

    // ── User / Student Profile Image Upload Branch ──────────────────────────
    // 1. Validate File Size (max 5 MB -> 422)
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          message: "Profile image must be 5 MB or smaller.",
        },
        { status: 422 }
      );
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file type. Allowed formats: jpg, jpeg, png, webp.",
        },
        { status: 422 }
      );
    }

    // 3. Validate Extension
    const ext = extractExtension(file.name || "");
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file type. Allowed formats: jpg, jpeg, png, webp.",
        },
        { status: 422 }
      );
    }

    const userIdNum = rawUserId ? parseInt(String(rawUserId), 10) : NaN;

    // If userId is provided and valid (logged-in user/student update flow)
    if (!isNaN(userIdNum) && userIdNum > 0) {
      const bytes = await file.arrayBuffer();
      const blob = new Blob([bytes], { type: file.type || "image/jpeg" });
      const phpForm = new FormData();
      phpForm.append("user_image", blob, file.name || `profile.${ext}`);

      // Forward file upload directly to PHP REST API (FileUploadHelper)
      const phpRes = await fetch(`${PHP_API}/user/image`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userIdNum),
          "X-User-Role": role,
        },
        body: phpForm,
      });

      const json = await phpRes.json().catch(() => null);

      if (!phpRes.ok || !json?.success) {
        return NextResponse.json(
          {
            success: false,
            message: json?.message || "Failed to upload image to PHP backend.",
          },
          { status: phpRes.status || 500 }
        );
      }

      const rawReturnedPath = json?.data?.user_image;
      const fullPublicUrl = toFullPublicUrl(rawReturnedPath);

      // Ensure MySQL database stores the full canonical public URL string
      if (fullPublicUrl) {
        try {
          await fetch(`${PHP_API}/user/profile`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": String(userIdNum),
              "X-User-Role": role,
              "X-HTTP-Method-Override": "PATCH",
              Accept: "application/json",
            },
            body: JSON.stringify({
              user_image: fullPublicUrl,
              _method: "PATCH",
            }),
          });
        } catch (syncErr) {
          console.warn("[Upload API] Notice syncing full user_image URL to DB:", syncErr);
        }

        // If student, also sync student record
        if (isStudent) {
          try {
            await fetch(`${PHP_API}/student/me`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-User-Id": String(userIdNum),
                "X-User-Role": "student",
                "X-HTTP-Method-Override": "PATCH",
                Accept: "application/json",
              },
              body: JSON.stringify({
                user_image: fullPublicUrl,
                _method: "PATCH",
              }),
            });
          } catch {
            /* ignore */
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: "Profile photo uploaded successfully.",
        filename: `profile.${ext}`,
        db_path: fullPublicUrl,
        path: fullPublicUrl,
        url: fullPublicUrl,
        user_image: fullPublicUrl,
        role,
        is_student: isStudent,
        data: {
          ...json?.data,
          user_image: fullPublicUrl,
        },
      });
    }

    // Pre-registration flow (no userId assigned yet)
    return NextResponse.json({
      success: true,
      message: "Image accepted for registration.",
      filename: file.name,
      role: "user",
      is_student: false,
    });
  } catch (error: any) {
    console.error("[Upload API] Error forwarding file to PHP:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to upload image.",
      },
      { status: 500 }
    );
  }
}
