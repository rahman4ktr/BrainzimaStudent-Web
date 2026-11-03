// app/api/coupon/route.ts
// Proxy handler for /api/coupon to Brainzima PHP REST API backend
// Endpoints:
// - GET: List offline coupons (bi_coupons) with optional query filters (?status, ?course_id, ?discount_type, ?search)
// - POST: Admin offline coupon creation

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString();
    const endpoint = queryString ? `${PHP_API}/coupon?${queryString}` : `${PHP_API}/coupon`;

    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(endpoint, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || "Failed to retrieve offline coupons from backend.",
          data: [],
        },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json(data, { status: res.status || 200 });
  } catch (error: any) {
    console.error("[Offline Coupon API] Failed to fetch coupons:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to coupon service.",
        data: [],
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/coupon`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Offline Coupon API] Failed to create coupon:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create coupon." },
      { status: 500 }
    );
  }
}
