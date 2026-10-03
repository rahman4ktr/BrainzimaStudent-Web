import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  extractExtension,
  updateUserProfileImage,
  saveTempImage,
  getBrowserFileUrl,
  saveStudentDocumentFile,
} from "@/lib/imageStorage";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawUserId =
      formData.get("userId") ||
      formData.get("user_id") ||
      req.headers.get("x-user-id");
    const currentPublicPath = (formData.get("current_image") as string) || null;
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
      rawRole.toLowerCase() === "student" ||
      (currentPublicPath ? currentPublicPath.includes("students") : false);
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
    const rawRegno =
      formData.get("registration_number") ||
      formData.get("regno");

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

      const bytes = await file.arrayBuffer();
      const fileBuffer = Buffer.from(bytes);

      const result = await saveStudentDocumentFile({
        studentId: String(rawStudentId),
        regno: rawRegno ? String(rawRegno) : null,
        docType,
        fileBuffer,
        originalFilename: file.name,
      });

      // Requirement 12: Profile Image Sync
      // If docs_st_image / profile was uploaded and userId is available, sync to user avatar folders
      if (
        (docType === "docs_st_image" || docType === "profile" || docType === "photo") &&
        rawUserId
      ) {
        try {
          const uId = parseInt(String(rawUserId), 10);
          if (!isNaN(uId) && uId > 0) {
            const userNamedDir = path.join(
              process.cwd(),
              "public",
              "uploads",
              "users",
              `user-${uId}`
            );
            const userNumericDir = path.join(
              process.cwd(),
              "public",
              "uploads",
              "users",
              String(uId)
            );
            await fs.mkdir(userNamedDir, { recursive: true });
            await fs.mkdir(userNumericDir, { recursive: true });
            await fs
              .writeFile(path.join(userNamedDir, result.filename), fileBuffer)
              .catch(() => {});
            await fs
              .writeFile(path.join(userNumericDir, result.filename), fileBuffer)
              .catch(() => {});
          }
        } catch {
          // ignore
        }
      }

      // Requirement 8: Return success: true and path / db_path
      return NextResponse.json({
        success: true,
        message: "Document uploaded successfully.",
        doc_type: docType,
        path: result.publicPath,
        db_path: result.publicPath,
        url: result.browserUrl,
        filename: result.filename,
      });
    }

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

    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);
    const userIdNum = rawUserId ? parseInt(String(rawUserId), 10) : NaN;

    // If userId is provided and valid (logged-in user/student update flow)
    if (!isNaN(userIdNum) && userIdNum > 0) {
      const publicPath = await updateUserProfileImage({
        userId: userIdNum,
        fileBuffer,
        originalFilename: file.name,
        currentPublicPath,
        role,
        isStudent,
      });

      const browserUrl = getBrowserFileUrl(publicPath);

      return NextResponse.json({
        success: true,
        message: "Profile photo uploaded successfully.",
        filename: `profile.${ext}`,
        db_path: publicPath,
        url: browserUrl,
        user_image: publicPath,
        role,
        is_student: isStudent,
      });
    }

    // Pre-registration flow (no userId assigned yet -> save to temp)
    const { publicPath, filename } = await saveTempImage(
      fileBuffer,
      file.name
    );
    const browserUrl = getBrowserFileUrl(publicPath);

    return NextResponse.json({
      success: true,
      message: "Image uploaded for registration.",
      filename,
      db_path: publicPath,
      url: browserUrl,
      user_image: publicPath,
      role: "user",
      is_student: false,
    });
  } catch (error: any) {
    console.error("[Upload API] Error saving file:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to upload image.",
      },
      { status: 500 }
    );
  }
}
