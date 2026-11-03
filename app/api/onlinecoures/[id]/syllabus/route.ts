// app/api/onlinecoures/[id]/syllabus/route.ts
// Proxy handler for online course syllabus topics directly from PHP backend API.
// Ordered by topic_order ASC directly from backend database without any dummy data.

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const courseId = Number(id);

    if (!courseId || isNaN(courseId)) {
      return NextResponse.json(
        { success: false, message: "Invalid online course ID." },
        { status: 400 }
      );
    }

    // Direct proxy to PHP backend syllabus API
    const res = await fetch(`${PHP_API}/onlinecoures/${courseId}/syllabus`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return NextResponse.json(
        data || {
          success: false,
          message: "Failed to fetch course syllabus lessons.",
        },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[OnlineCourse Syllabus API] Failed to fetch syllabus:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to fetch course syllabus lessons.",
      },
      { status: 500 }
    );
  }
}
