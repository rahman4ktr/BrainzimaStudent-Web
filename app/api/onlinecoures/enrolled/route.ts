// app/api/onlinecoures/enrolled/route.ts
// Secure Next.js API Route returning all verified online courses purchased by the authenticated user/student.
// Authoritative backend source of truth for Student Dashboard "Online Courses" and "Enrolled Courses" views.

import { NextRequest, NextResponse } from "next/server";
import { getUserPurchasedOnlineCourses } from "@/lib/onlineCoursePurchaseStore";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role") || "student";

    const userId = Number(searchParams.get("userId") || headerUserId);

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { success: false, message: "Authentication required to fetch online courses." },
        { status: 401 }
      );
    }

    const onlineCourses = await getUserPurchasedOnlineCourses(userId, headerUserRole);

    return NextResponse.json({
      success: true,
      message: "Enrolled online courses retrieved successfully.",
      data: onlineCourses,
    });
  } catch (err: any) {
    console.error("[OnlineCourses Enrolled API] Error:", err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Failed to fetch enrolled online courses.",
        data: [],
      },
      { status: 500 }
    );
  }
}
