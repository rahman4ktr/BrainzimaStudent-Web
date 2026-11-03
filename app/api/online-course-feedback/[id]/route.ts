// app/api/online-course-feedback/[id]/route.ts
// Proxy handler for single feedback item operations (GET, PUT, PATCH, DELETE).

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await fetch(`${PHP_API}/online-course-feedback/${id}`, {
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
      { success: false, message: "Feedback not found." },
      { status: 404 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch feedback details." },
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

    const res = await fetch(`${PHP_API}/online-course-feedback/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-Id": req.headers.get("x-user-id") || "",
        "X-User-Role": req.headers.get("x-user-role") || "",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data) {
      return NextResponse.json(data);
    }

    return NextResponse.json(
      data || { success: false, message: "Failed to update feedback." },
      { status: res.status || 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Failed to update feedback record." },
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

    const res = await fetch(`${PHP_API}/online-course-feedback/${id}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "X-User-Id": req.headers.get("x-user-id") || "",
        "X-User-Role": req.headers.get("x-user-role") || "",
      },
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data || { success: true, message: "Feedback deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: "Failed to delete feedback." },
      { status: 500 }
    );
  }
}

