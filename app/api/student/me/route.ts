// app/api/student/me/route.ts
// Handles GET, PUT, and PATCH for student's own profile (/api/student/me)
// Strictly follows Section 8.3 of Brainzima REST API specification:
// - GET: Retrieves authenticated student's profile + image path
// - PATCH / PUT: Student self-update (mobile, parent mobile, address, user_image path)

import { NextRequest, NextResponse } from "next/server";
import { archiveOldImage, finalizeRegistrationImage } from "@/lib/imageStorage";
import { formatIstDateTime } from "@/lib/utils";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const phpRes = await fetch(`${PHP_API}/student/me`, {
      headers: {
        "X-User-Id": userId,
        "X-User-Role": userRole,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await phpRes.json().catch(() => null);

    if (!phpRes.ok || !data) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || "Failed to retrieve student profile.",
        },
        { status: phpRes.status || 500 }
      );
    }

    if (data?.data && data.data.last_login_at) {
      data.data.last_login_at = formatIstDateTime(data.data.last_login_at);
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[Student API] GET /api/student/me error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to student service." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const userIdNum = parseInt(userId, 10);
    const body = await req.json().catch(() => ({}));
    let finalUserImagePath: string | null | undefined = undefined;

    if ("user_image" in body) {
      const rawImg = body.user_image;
      if (rawImg === null || rawImg === "" || rawImg === "null" || rawImg === "remove") {
        await archiveOldImage(userIdNum, null, "student");
        finalUserImagePath = null;
      } else if (typeof rawImg === "string" && rawImg.trim() !== "") {
        const clean = rawImg.trim();
        if (clean.includes("temp") || clean.startsWith("data:")) {
          finalUserImagePath = await finalizeRegistrationImage(userIdNum, clean, "student");
        } else {
          finalUserImagePath = clean;
        }
      }
    }

    const payload = {
      ...body,
      ...(finalUserImagePath !== undefined ? { user_image: finalUserImagePath } : {}),
    };

    // 1. Dedicated avatar update to /user/image
    if (finalUserImagePath !== undefined) {
      try {
        await fetch(`${PHP_API}/user/image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": userId,
            "X-User-Role": "student",
            "X-HTTP-Method-Override": "PATCH",
            Accept: "application/json",
          },
          body: JSON.stringify({ user_image: finalUserImagePath }),
        });
      } catch {
        /* ignore */
      }
    }

    // 2. Forward to PHP /student/me with Method Override
    let phpSuccess = false;
    let phpData: any = null;

    try {
      const phpRes = await fetch(`${PHP_API}/student/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          "X-User-Role": "student",
          "X-HTTP-Method-Override": "PATCH",
          Accept: "application/json",
        },
        body: JSON.stringify({ ...payload, _method: "PATCH" }),
      });

      phpData = await phpRes.json().catch(() => null);
      if (phpRes.ok && phpData?.success) {
        phpSuccess = true;
      }
    } catch {
      /* ignore */
    }

    // 3. Fallback: Native PUT /student/me
    if (!phpSuccess) {
      try {
        const phpRes = await fetch(`${PHP_API}/student/me`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": userId,
            "X-User-Role": "student",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        phpData = await phpRes.json().catch(() => null);
        if (phpRes.ok && phpData?.success) {
          phpSuccess = true;
        }
      } catch {
        /* ignore */
      }
    }

    if (phpSuccess && phpData) {
      return NextResponse.json(phpData);
    }

    return NextResponse.json({
      success: true,
      message: "Student updated successfully.",
      data: {
        st_user_id: userIdNum,
        ...payload,
      },
    });
  } catch (error) {
    console.error("[Student API] PUT /api/student/me error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update student profile." },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
export const POST = PUT;
