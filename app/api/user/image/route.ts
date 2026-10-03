// app/api/user/image/route.ts
// Dedicated endpoint for user and student profile image path management
// Strictly adheres to Brainzima REST API specification (README Section 8.2):
// - POST / PUT / PATCH: Updates user_image path string and synchronizes with DB
// - DELETE: Sets user_image = NULL in database and archives physical file to delete/

import { NextRequest, NextResponse } from "next/server";
import { archiveOldImage, finalizeRegistrationImage } from "@/lib/imageStorage";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

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

    const body = await req.json().catch(() => ({}));
    const rawImagePath = body.user_image ?? body.image ?? null;

    let finalPath: string | null = null;
    const isStudent = userRole === "student" || body.is_student === true;
    const targetRole = isStudent ? "student" : "user";

    if (rawImagePath && typeof rawImagePath === "string" && rawImagePath.trim() !== "") {
      const clean = rawImagePath.trim();
      if (clean.includes("temp")) {
        finalPath = await finalizeRegistrationImage(userId, clean, targetRole);
      } else {
        finalPath = clean;
      }
    }

    // 1. Sync with PHP /user/image (Dedicated endpoint)
    try {
      await fetch(`${PHP_API}/user/image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": targetRole,
          "X-HTTP-Method-Override": "PATCH",
          Accept: "application/json",
        },
        body: JSON.stringify({ user_image: finalPath }),
      });
    } catch (err) {
      console.warn("[User Image API] Notice syncing /user/image:", err);
    }

    // 2. Sync with PHP /user/profile
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
        body: JSON.stringify({ user_image: finalPath, _method: "PATCH" }),
      });
    } catch {
      /* ignore */
    }

    // 3. If student, sync with student endpoints
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
          body: JSON.stringify({ user_image: finalPath }),
        });
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profile image path updated successfully",
      data: {
        user_id: userId,
        user_image: finalPath,
      },
    });
  } catch (error) {
    console.error("[User Image API] Error updating image:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update profile image." },
      { status: 500 }
    );
  }
}

export const PUT = POST;
export const PATCH = POST;

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
    const isStudent = userRole === "student";
    const targetRole = isStudent ? "student" : "user";

    // Archive current image to delete/
    await archiveOldImage(userId, null, targetRole);

    // Call PHP to set user_image = NULL
    try {
      await fetch(`${PHP_API}/user/image`, {
        method: "DELETE",
        headers: {
          "X-User-Id": String(userId),
          "X-User-Role": targetRole,
          Accept: "application/json",
        },
      });
    } catch {
      /* ignore */
    }

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
  } catch (error) {
    console.error("[User Image API] DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to remove profile image." },
      { status: 500 }
    );
  }
}
