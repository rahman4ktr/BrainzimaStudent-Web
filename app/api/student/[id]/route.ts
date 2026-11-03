// app/api/student/[id]/route.ts
// Proxy handler for single student profile retrieval & updates to PHP backend

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

interface RouteParams {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(req: NextRequest, context: RouteParams) {
  try {
    const { id } = await Promise.resolve(context.params);
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/student/${id}`, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { success: false, message: "Student record not found." }, {
      status: res.status,
    });
  } catch (error) {
    console.error("[Student API] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to student service." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteParams) {
  try {
    const { id } = await Promise.resolve(context.params);
    const body = await req.json().catch(() => ({}));
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    // Try without trailing slash first
    let res = await fetch(`${PHP_API}/student/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    // If 404 or 405, retry with trailing slash (required by some Apache configurations)
    if (!res.ok) {
      const retryRes = await fetch(`${PHP_API}/student/${id}/`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (retryRes.ok) {
        res = retryRes;
      }
    }

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { success: false, message: "Failed to update student profile." }, {
      status: res.status,
    });
  } catch (error) {
    console.error("[Student API] PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to student update service." },
      { status: 500 }
    );
  }
}
