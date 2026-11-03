// app/api/online-results/route.ts
// Proxy & controller for Online Results API (/api/online-results).
// Handles:
// 1. GET: List results for student or user strictly filtered by course_id when provided.
// 2. POST: 1st time insert result; subsequent attempts (2nd & 3rd) update result marks.

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";
import {
  saveOrUpdateQuizResult,
  listOnlineResultsForUser,
  findOnlineResult,
} from "@/lib/onlineResultsStore";

const PHP_API = getBackendApiUrl();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const headerUserId = req.headers.get("x-user-id");
    const headerStudentId = req.headers.get("x-student-id");
    const headerRole = req.headers.get("x-user-role") || "student";

    const paramStdId = searchParams.get("std_id");
    const paramUserId = searchParams.get("user_id");
    const paramCourseId = searchParams.get("course_id");

    const stdId = Number(paramStdId || headerStudentId || 0);
    const userId = Number(paramUserId || headerUserId || 0);
    const courseId = paramCourseId ? Number(paramCourseId) : undefined;

    // 1. Try PHP backend with proper authentication headers
    let phpResults: any[] = [];
    try {
      const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
      const phpHeaders: Record<string, string> = {
        Accept: "application/json",
        "X-User-Role": headerRole,
      };
      if (userId) phpHeaders["X-User-Id"] = String(userId);
      if (stdId) phpHeaders["X-Student-Id"] = String(stdId);

      const phpRes = await fetch(`${PHP_API}/online-results${qs}`, {
        headers: phpHeaders,
        cache: "no-store",
      });

      const phpData = await phpRes.json().catch(() => null);
      if (phpRes.ok) {
        if (Array.isArray(phpData?.data)) {
          phpResults = phpData.data;
        } else if (Array.isArray(phpData?.data?.results)) {
          phpResults = phpData.data.results;
        }
      }
    } catch (phpErr) {
      console.warn("[OnlineResults API] PHP backend fetch notice:", phpErr);
    }

    // 2. Fetch local persistent store results
    const localResults = listOnlineResultsForUser(stdId, userId);

    // Merge phpResults with localResults, prioritizing local if present
    const mergedMap = new Map<string, any>();
    for (const r of phpResults) {
      const key = `${r.std_id || r.user_id}_${r.course_id}`;
      mergedMap.set(key, r);
    }
    for (const r of localResults) {
      const key = `${r.std_id || r.user_id}_${r.course_id}`;
      mergedMap.set(key, r);
    }

    let mergedList = Array.from(mergedMap.values());

    // 3. Strict filtering by course_id if requested (Ensures Course 1, 2, 3, 4 results are 100% course-isolated)
    if (courseId) {
      mergedList = mergedList.filter((r) => Number(r.course_id) === courseId);
    }

    // Sort latest first
    mergedList.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      message: "Online results retrieved successfully.",
      data: {
        results: mergedList,
        pagination: {
          total: mergedList.length,
          page: 1,
          limit: 50,
          total_pages: 1,
        },
      },
    });
  } catch (error) {
    console.error("[OnlineResults API] Failed to list results:", error);
    return NextResponse.json(
      { success: false, message: "Failed to retrieve online results." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request payload." },
        { status: 400 }
      );
    }

    const headerUserId = req.headers.get("x-user-id");
    const headerStudentId = req.headers.get("x-student-id");

    const std_id = Number(body.std_id || headerStudentId || body.student_id || 0);
    const user_id = Number(body.user_id || headerUserId || 0);
    const course_id = Number(body.course_id || body.courseId);
    const marks = Number(body.marks ?? 0);

    if (!course_id || isNaN(course_id)) {
      return NextResponse.json(
        { success: false, message: "Course ID is required." },
        { status: 422 }
      );
    }

    const extra = body.extra || {
      attempt: 1,
      total_questions: 50,
      correct: Math.round(marks / 2),
      wrong: 50 - Math.round(marks / 2),
      unanswered: 0,
      marks_per_question: 2,
      total_marks: 100,
      percentage: marks,
      passed: marks >= 40,
      completed_at: new Date().toISOString(),
    };

    const outcome = await saveOrUpdateQuizResult({
      std_id,
      user_id,
      course_id,
      marks,
      extra,
      st_name: body.st_name,
      st_regno: body.st_regno,
      course_name: body.course_name,
      course_code: body.course_code,
    });

    if (!outcome.success) {
      return NextResponse.json(
        {
          success: false,
          message: outcome.message || "Cannot record quiz result.",
          data: outcome.result,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: outcome.message,
        is_update: outcome.isUpdate,
        attempt: outcome.attemptNumber,
        data: outcome.result,
      },
      { status: outcome.isUpdate ? 200 : 201 }
    );
  } catch (error) {
    console.error("[OnlineResults API] Failed to record result:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error saving online result." },
      { status: 500 }
    );
  }
}
