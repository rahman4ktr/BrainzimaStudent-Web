// app/api/onlinecoures/route.ts
// Proxy handler for Online Courses to the Brainzima PHP REST API backend.
// GET: Returns list of online courses (supports ?status=active|inactive and ?type=basic|normal)

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "active";
    const type = searchParams.get("type") || searchParams.get("course_type");

    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (type) query.set("type", type);

    const qs = query.toString() ? `?${query.toString()}` : "";
    const res = await fetch(`${PHP_API}/onlinecoures${qs}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        data || { success: false, message: "Failed to fetch online courses." },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[OnlineCourse API] Failed to fetch online courses:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch online courses from backend server.",
        data: [],
      },
      { status: 500 }
    );
  }
}
