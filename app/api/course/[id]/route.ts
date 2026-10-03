// app/api/course/[id]/route.ts
// Proxy handler for /api/course/{id} to Brainzima PHP REST API backend
// Endpoints:
// - GET: Public course details by ID
// - PUT: Admin update course details
// - DELETE: Admin remove / deactivate course

import { NextRequest, NextResponse } from "next/server";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${PHP_API}/course/${id}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[Course API] Failed to fetch course ${params}:`, error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch course details." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/course/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[Course API] Failed to update course:`, error);
    return NextResponse.json(
      { success: false, message: "Failed to update course." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/course/${id}`, {
      method: "DELETE",
      headers,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error(`[Course API] Failed to delete course:`, error);
    return NextResponse.json(
      { success: false, message: "Failed to delete course." },
      { status: 500 }
    );
  }
}
