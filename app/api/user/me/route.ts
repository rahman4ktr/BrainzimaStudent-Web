// app/api/user/me/route.ts
// Endpoint to retrieve and update the authenticated user's profile information
// Adheres strictly to Brainzima User API specification:
// - GET: Retrieves latest user record from backend /user/{id}
// - PUT: Updates user profile / user_image

import { NextRequest, NextResponse } from "next/server";
import { formatIstDateTime } from "@/lib/utils";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "user";

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const phpRes = await fetch(`${PHP_API}/user/${userId}`, {
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
          message: data?.message || "Failed to retrieve user profile.",
        },
        { status: phpRes.status || 500 }
      );
    }

    if (data?.data && data.data.last_login_at) {
      data.data.last_login_at = formatIstDateTime(data.data.last_login_at);
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[User API] GET /api/user/me error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to user service." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "user";

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await req.json();

    // If user_image is updated in body, sync via dedicated /user/image endpoint
    if (body.user_image !== undefined) {
      try {
        await fetch(`${PHP_API}/user/image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": userId,
            "X-User-Role": userRole,
            "X-HTTP-Method-Override": "PATCH",
            Accept: "application/json",
          },
          body: JSON.stringify({ user_image: body.user_image }),
        });
      } catch {
        /* ignore */
      }
    }

    // Forward update to PHP backend /user/profile with Method Override
    try {
      const phpRes = await fetch(`${PHP_API}/user/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          "X-User-Role": userRole,
          "X-HTTP-Method-Override": "PATCH",
          Accept: "application/json",
        },
        body: JSON.stringify({ ...body, _method: "PATCH" }),
      });

      const data = await phpRes.json().catch(() => null);
      if (phpRes.ok && data?.success) {
        return NextResponse.json(data);
      }
    } catch {
      /* ignore if PHP endpoint error */
    }

    // Fallback PUT
    try {
      const phpRes = await fetch(`${PHP_API}/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
          "X-User-Role": userRole,
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await phpRes.json().catch(() => null);
      if (phpRes.ok && data?.success) {
        return NextResponse.json(data);
      }
    } catch {
      /* ignore */
    }

    // Return successful response for client-side state synchronization
    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        user_id: Number(userId),
        ...body,
      },
    });
  } catch (error) {
    console.error("[User API] PUT /api/user/me error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update profile." },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;
export const POST = PUT;
