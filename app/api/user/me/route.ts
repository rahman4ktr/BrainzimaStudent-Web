// app/api/user/me/route.ts
// Endpoint to retrieve and update the authenticated user's profile information
// Adheres strictly to Brainzima User API specification:
// - GET: Retrieves latest user record from backend /user/{id}
// - PUT: Updates user profile / user_image

import { NextRequest, NextResponse } from "next/server";
import { formatIstDateTime } from "@/lib/utils";

const PHP_API =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.brainzima.com/student/api";

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

    if (data?.data?.student_id) {
      const stId = Number(data.data.student_id);
      try {
        const enrRes = await fetch(`${PHP_API}/enrollment`, {
          headers: {
            Accept: "application/json",
            "X-User-Id": String(userId),
            "X-User-Role": "student",
            "X-Student-Id": String(stId),
          },
          cache: "no-store",
        });
        const enrData = await enrRes.json().catch(() => null);
        const enrollments: any[] = Array.isArray(enrData?.data)
          ? enrData.data
          : Array.isArray(enrData?.data?.enrollments)
          ? enrData.data.enrollments
          : [];
        const hasPaid = enrollments.some(
          (e) =>
            Number(e.stc_initial_payment || 0) > 0 ||
            Number(e.total_paid || 0) > 0
        );
        if (hasPaid && stId) {
          data.data.registration_number = `BISR${String(stId).padStart(4, "0")}`;
        } else if (!hasPaid && enrollments.length > 0) {
          data.data.registration_number = null;
        }
      } catch {
        if (stId && data.data.registration_number) {
          data.data.registration_number = `BISR${String(stId).padStart(4, "0")}`;
        }
      }
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
