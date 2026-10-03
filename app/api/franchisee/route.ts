// app/api/franchisee/route.ts
// Proxy handler for /api/franchisee to Brainzima PHP REST API backend
// Fetches study centres / franchisees with name, address, city, state.

import { NextRequest, NextResponse } from "next/server";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `${PHP_API}/franchisee?${queryString}`
      : `${PHP_API}/franchisee`;

    const res = await fetch(endpoint, {
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
          message: data?.message || "Failed to fetch study centres.",
          data: [],
        },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("[Franchisee API] Error fetching study centres:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to study centres service.",
        data: [],
      },
      { status: 500 }
    );
  }
}
