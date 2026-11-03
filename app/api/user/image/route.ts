// app/api/user/image/route.ts
// Dedicated endpoint for user profile image upload, update, and deletion.
// Uploads actual binary files directly to PHP backend: uploads/images/users/
// Stores full canonical public URL in MySQL: https://api.brainzima.com/student/api/uploads/images/users/...

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

export async function POST(req: NextRequest) {
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
    let finalUserImageUrl: string | null = null;
    const isStudent = userRole === "student";
    const targetRole = isStudent ? "student" : "user";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const rawFile = (formData.get("user_image") || formData.get("file")) as File | null;

      if (!rawFile || typeof rawFile !== "object" || typeof rawFile.arrayBuffer !== "function") {
        return NextResponse.json(
          { success: false, message: "No image file provided." },
          { status: 400 }
        );
      }

      if (rawFile.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, message: "Profile image must be 5 MB or smaller." },
          { status: 422 }
        );
      }

      const ext = extractExtension(rawFile.name || "");
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { success: false, message: "Invalid file type. Allowed formats: jpg, jpeg, png, webp." },
          { status: 422 }
        );
      }

      const bytes = await rawFile.arrayBuffer();
      const blob = new Blob([bytes], { type: rawFile.type || "image/jpeg" });
      const phpForm = new FormData();
      phpForm.append("user_image", blob, rawFile.name || `profile.${ext}`);

      const phpRes = await fetch(`${PHP_API}/user/image`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": targetRole,
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

      finalUserImageUrl = toFullPublicUrl(json?.data?.user_image);
    } else {
      // JSON path payload
      const body = await req.json().catch(() => ({}));
      const rawPath = body.user_image ?? body.image ?? null;
      if (rawPath) {
        finalUserImageUrl = toFullPublicUrl(rawPath);
      }
    }

    if (finalUserImageUrl) {
      // Sync MySQL with full public URL string
      try {
        await fetch(`${PHP_API}/user/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": String(userId),
            "X-User-Role": targetRole,
            "X-HTTP-Method-Override": "PATCH",
            Accept: "application/json",
          },
          body: JSON.stringify({
            user_image: finalUserImageUrl,
            _method: "PATCH",
          }),
        });
      } catch (err) {
        console.warn("[User Image API] Notice syncing /user/profile:", err);
      }

      if (isStudent) {
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
    }

    return NextResponse.json({
      success: true,
      message: "Profile image updated successfully",
      data: {
        user_id: userId,
        user_image: finalUserImageUrl,
      },
    });
  } catch (error: any) {
    console.error("[User Image API] POST error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update profile image." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}

export async function PATCH(req: NextRequest) {
  return POST(req);
}

export async function DELETE(req: NextRequest) {
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

    // Forward DELETE to PHP backend which deletes physical file + clears DB
    try {
      await fetch(`${PHP_API}/user/image`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
      });
    } catch (err) {
      console.warn("[User Image API] Notice on PHP DELETE:", err);
    }

    try {
      await fetch(`${PHP_API}/user/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
          "X-HTTP-Method-Override": "PATCH",
          Accept: "application/json",
        },
        body: JSON.stringify({ user_image: null, _method: "PATCH" }),
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      success: true,
      message: "Profile image removed successfully",
      data: {
        user_id: userId,
        user_image: null,
      },
    });
  } catch (error: any) {
    console.error("[User Image API] DELETE error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to delete profile image." },
      { status: 500 }
    );
  }
}
