// app/api/notes/route.ts
// Proxy handler for /api/notes to Brainzima PHP REST API backend
// Endpoints:
// - GET: List study notes for enrolled courses

import { NextRequest, NextResponse } from "next/server";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/notes`, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Notes API] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to study notes service." },
      { status: 500 }
    );
  }
}
