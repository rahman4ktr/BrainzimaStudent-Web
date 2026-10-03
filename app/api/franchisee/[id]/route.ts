// app/api/franchisee/[id]/route.ts
// Proxy handler for /api/franchisee/{id} to Brainzima PHP REST API backend

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
    const res = await fetch(`${PHP_API}/franchisee/${id}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || "Study centre not found.",
        },
        { status: res.status || 404 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("[Franchisee API] Error fetching single centre:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to study centre service." },
      { status: 500 }
    );
  }
}
