// app/api/onlinecoures/[id]/route.ts
// Proxy handler for single online course with robust fallback to onlinecoures list.

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

    // 1. Attempt direct fetch from PHP backend single course endpoint
    try {
      const res = await fetch(`${PHP_API}/onlinecoures/${courseId}`, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && data?.data) {
          return NextResponse.json(data);
        }
      }
    } catch (singleErr) {
      console.warn("[OnlineCourse API] Direct single endpoint notice:", singleErr);
    }

    // 2. Resilient fallback: The PHP backend list endpoint (/onlinecoures) is always operational
    const listRes = await fetch(`${PHP_API}/onlinecoures`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (listRes.ok) {
      const listData = await listRes.json().catch(() => null);
      const coursesList = Array.isArray(listData?.data) ? listData.data : [];
      const matched = coursesList.find(
        (c: any) => Number(c.course_id ?? c.id) === courseId
      );

      if (matched) {
        return NextResponse.json({
          success: true,
          message: "Online course retrieved successfully.",
          data: matched,
        });
      }
    }

    return NextResponse.json(
      { success: false, message: "Online course not found." },
      { status: 404 }
    );
  } catch (error) {
    console.error("[OnlineCourse API] Failed to fetch online course:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch online course details.",
      },
      { status: 500 }
    );
  }
}
