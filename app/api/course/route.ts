// app/api/course/route.ts
// Proxy handler for /api/course to Brainzima PHP REST API backend
// Endpoints:
// - GET: Public course catalog (active courses with fees, duration, modules)
// - POST: Admin course creation

import { NextRequest, NextResponse } from "next/server";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function GET() {
  try {
    const res = await fetch(`${PHP_API}/course`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Course API] Failed to fetch courses:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch courses from backend server.",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/course`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Course API] Failed to create course:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create course." },
      { status: 500 }
    );
  }
}
