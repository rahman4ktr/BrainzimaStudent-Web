// app/api/online-course-feedback/route.ts
// Proxy handler for Online Course Feedback API (bi_online_courese_feedbak).
// Pure proxy to backend database - No dummy or hardcoded mock data.

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  try {
    const backendUrl = new URL(`${PHP_API}/online-course-feedback`);
    searchParams.forEach((val, key) => backendUrl.searchParams.set(key, val));

    const res = await fetch(backendUrl.toString(), {
      headers: {
        Accept: "application/json",
        "X-User-Id": req.headers.get("x-user-id") || "",
        "X-User-Role": req.headers.get("x-user-role") || "",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      return NextResponse.json(data);
    }

    return NextResponse.json(
      data || {
        success: true,
        message: "No feedback found.",
        data: [],
      },
      { status: res.status || 200 }
    );
  } catch (err) {
    console.error("[Feedback API] PHP backend fetch error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch feedback from database.",
        data: [],
      },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userIdHeader = req.headers.get("x-user-id");
    const userRoleHeader = req.headers.get("x-user-role") || "student";

    const couresId = parseInt(body.coures_id || body.course_id, 10);
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    const extra = body.extra || null;
    const studentName = body.student_name || "";

    if (!couresId || isNaN(couresId)) {
      return NextResponse.json(
        { success: false, message: "coures_id is required and must be an integer." },
        { status: 400 }
      );
    }

    if (!comment) {
      return NextResponse.json(
        { success: false, message: "Feedback comment cannot be blank." },
        { status: 400 }
      );
    }

    // Direct proxy to PHP MySQL backend
    const res = await fetch(`${PHP_API}/online-course-feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-Id": userIdHeader || "",
        "X-User-Role": userRoleHeader,
      },
      body: JSON.stringify({
        coures_id: couresId,
        comment,
        student_name: studentName,
        extra,
      }),
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      return NextResponse.json(data, { status: res.status || 201 });
    }

    return NextResponse.json(
      data || {
        success: false,
        message: "Failed to record course feedback in backend database.",
      },
      { status: res.status || 400 }
    );
  } catch (error) {
    console.error("[Feedback API] Failed to submit feedback:", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit course feedback to server." },
      { status: 500 }
    );
  }
}
