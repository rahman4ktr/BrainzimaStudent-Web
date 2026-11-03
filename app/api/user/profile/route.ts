// app/api/user/profile/route.ts
// Handles PUT and PATCH /api/user/profile
// Supports both application/json and multipart/form-data.
// When an image file is uploaded, forwards the binary file directly to PHP REST API.
// MySQL database stores the full canonical public URL string.

import { NextRequest, NextResponse } from "next/server";
import {
  toFullPublicUrl,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  extractExtension,
} from "@/lib/imageStorage";

const PHP_API =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.brainzima.com/student/api";

export async function PUT(req: NextRequest) {
  try {
    const rawUserId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "user";

    if (!rawUserId) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const userId = parseInt(rawUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid user identifier." },
        { status: 403 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let body: any = {};
    let uploadedFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const rawFile = (formData.get("user_image") || formData.get("file")) as File | null;
      if (rawFile && typeof rawFile === "object" && typeof rawFile.arrayBuffer === "function") {
        uploadedFile = rawFile;
      }

      body = {
        name: formData.get("name")?.toString() || undefined,
        email: formData.get("email")?.toString() || undefined,
        mobile: formData.get("mobile")?.toString() || undefined,
        user_image: typeof formData.get("user_image") === "string"
          ? formData.get("user_image")?.toString()
          : undefined,
        user_role: formData.get("user_role")?.toString() || userRole,
        role: formData.get("role")?.toString() || userRole,
      };
    } else {
      body = await req.json().catch(() => ({}));
    }

    const isStudent =
      userRole.toLowerCase() === "student" ||
      body.user_role?.toLowerCase() === "student" ||
      body.role?.toLowerCase() === "student" ||
      body.is_student === true;
    const targetRole = isStudent ? "student" : "user";

    let finalUserImageUrl: string | null | undefined = undefined;

    // ── 1. If an actual File was sent in FormData, forward it to PHP ─────────
    if (uploadedFile) {
      if (uploadedFile.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, message: "Profile image must be 5 MB or smaller." },
          { status: 422 }
        );
      }
      const ext = extractExtension(uploadedFile.name || "");
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { success: false, message: "Invalid file type. Allowed formats: jpg, jpeg, png, webp." },
          { status: 422 }
        );
      }

      const bytes = await uploadedFile.arrayBuffer();
      const blob = new Blob([bytes], { type: uploadedFile.type || "image/jpeg" });
      const phpForm = new FormData();
      phpForm.append("user_image", blob, uploadedFile.name || `profile.${ext}`);

      const phpImgRes = await fetch(`${PHP_API}/user/image`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": targetRole,
        },
        body: phpForm,
      });

      const imgJson = await phpImgRes.json().catch(() => null);
      if (phpImgRes.ok && imgJson?.success && imgJson?.data?.user_image) {
        finalUserImageUrl = toFullPublicUrl(imgJson.data.user_image);
      } else {
        return NextResponse.json(
          {
            success: false,
            message: imgJson?.message || "Failed to upload image to PHP backend.",
          },
          { status: phpImgRes.status || 500 }
        );
      }
    } else if ("user_image" in body) {
      const rawImg = body.user_image;
      if (rawImg === null || rawImg === "" || rawImg === "null" || rawImg === "remove") {
        finalUserImageUrl = null;
        // Also call DELETE on PHP /user/image
        try {
          await fetch(`${PHP_API}/user/image`, {
            method: "DELETE",
            headers: {
              Accept: "application/json",
              "X-User-Id": String(userId),
              "X-User-Role": targetRole,
            },
          });
        } catch {
          /* ignore */
        }
      } else if (typeof rawImg === "string" && rawImg.trim() !== "") {
        finalUserImageUrl = toFullPublicUrl(rawImg.trim());
      }
    }

    // ── 2. Forward profile fields to PHP backend ────────────────────────────
    const payloadToForward: Record<string, any> = {
      _method: "PATCH",
    };
    if (body.name !== undefined) payloadToForward.name = body.name;
    if (body.email !== undefined) payloadToForward.email = body.email;
    if (body.mobile !== undefined) payloadToForward.mobile = body.mobile;
    if (finalUserImageUrl !== undefined) {
      payloadToForward.user_image = finalUserImageUrl;
    }

    let phpSuccess = false;
    let phpResponseData: any = null;

    try {
      const phpRes = await fetch(`${PHP_API}/user/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": targetRole,
          "X-HTTP-Method-Override": "PATCH",
          Accept: "application/json",
        },
        body: JSON.stringify(payloadToForward),
      });

      const phpJson = await phpRes.json().catch(() => null);
      if (phpRes.ok && phpJson?.success) {
        phpSuccess = true;
        phpResponseData = phpJson.data;
      } else if (!phpRes.ok && phpJson) {
        return NextResponse.json(phpJson, { status: phpRes.status });
      }
    } catch (profErr) {
      console.warn("[Profile API] Error calling /user/profile:", profErr);
    }

    // If student and user_image was updated, sync student profile as well
    if (isStudent && finalUserImageUrl !== undefined) {
      try {
        await fetch(`${PHP_API}/student/me`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": String(userId),
            "X-User-Role": "student",
            "X-HTTP-Method-Override": "PATCH",
            Accept: "application/json",
          },
          body: JSON.stringify({
            user_image: finalUserImageUrl,
            _method: "PATCH",
          }),
        });
      } catch {
        /* ignore */
      }
    }

    const mergedData = {
      user_id: userId,
      ...(phpResponseData || {}),
      ...(payloadToForward.name ? { name: payloadToForward.name } : {}),
      ...(payloadToForward.mobile ? { mobile: payloadToForward.mobile } : {}),
      ...(finalUserImageUrl !== undefined ? { user_image: finalUserImageUrl } : {}),
    };

    if (mergedData.user_image) {
      mergedData.user_image = toFullPublicUrl(mergedData.user_image);
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      data: mergedData,
    });
  } catch (error: any) {
    console.error("[Profile API] Error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return PUT(req);
}
