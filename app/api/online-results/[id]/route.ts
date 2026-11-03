// app/api/online-results/[id]/route.ts
// Single Online Result Handler (/api/online-results/{id})

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headerUserId = req.headers.get("x-user-id");
    const headerRole = req.headers.get("x-user-role") || "student";

    const res = await fetch(`${PHP_API}/online-results/${id}`, {
      headers: {
        Accept: "application/json",
        "X-User-Id": String(headerUserId || 1),
        "X-User-Role": headerRole,
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        data || { success: false, message: "Result not found." },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[OnlineResult Detail API] Failed to fetch result:", error);
    return NextResponse.json(
      { success: false, message: "Error fetching online result." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Forward with Admin rights to PHP backend
    const res = await fetch(`${PHP_API}/online-results/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-Id": "1",
        "X-User-Role": "admin",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        data || { success: false, message: "Failed to update online result." },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[OnlineResult Detail API] Failed to patch result:", error);
    return NextResponse.json(
      { success: false, message: "Error updating online result." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return PATCH(req, { params });
}
