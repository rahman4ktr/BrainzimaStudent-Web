// app/api/online-quiz-questions/random/[count]/route.ts
// Pure backend proxy handler for fetching random quiz questions from the real database.
// No dummy data or hardcoded questions.

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ count: string }> }
) {
  try {
    const { count: rawCount } = await params;
    const count = Math.min(100, Math.max(1, parseInt(rawCount, 10) || 50));

    // Extract course_id from query params
    const rawCourseId =
      req.nextUrl.searchParams.get("course_id") ||
      req.nextUrl.searchParams.get("coures_id");
    const courseId = rawCourseId ? parseInt(rawCourseId, 10) : null;

    // Fetch directly from PHP backend API
    const phpUrl = new URL(`${PHP_API}/online-quiz-questions/random/${count}`);
    if (courseId && !isNaN(courseId)) {
      phpUrl.searchParams.set("course_id", String(courseId));
    }

    const phpRes = await fetch(phpUrl.toString(), {
      headers: {
        Accept: "application/json",
        "X-User-Role": "student",
      },
      cache: "no-store",
    });

    const phpData = await phpRes.json().catch(() => null);

    if (phpRes.ok && phpData?.success && Array.isArray(phpData?.data)) {
      return NextResponse.json({
        success: true,
        count: phpData.data.length,
        course_id: courseId,
        data: phpData.data,
      });
    }

    // If backend returns an error or empty
    return NextResponse.json(
      {
        success: false,
        message: phpData?.message || "No quiz questions available for this course.",
        data: [],
      },
      { status: phpRes.status || 404 }
    );
  } catch (error: any) {
    console.error("[Quiz API] Failed to fetch questions from backend:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to fetch quiz questions from database.",
        data: [],
      },
      { status: 500 }
    );
  }
}
