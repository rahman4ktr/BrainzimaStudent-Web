// app/api/onlinecoures/[id]/access/route.ts
// Secure backend access-control check.
// Verifies whether the authenticated user has purchased/enrolled in the online course.
// Frontend MUST NOT trust local state — access is always confirmed by this endpoint.

import { NextRequest, NextResponse } from "next/server";
import { isOnlineCoursePurchased } from "@/lib/onlineCoursePurchaseStore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const courseId = Number(id);

    if (!courseId || isNaN(courseId)) {
      return NextResponse.json(
        { success: false, message: "Valid Course ID is required." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const headerUserId = req.headers.get("x-user-id") || searchParams.get("userId");
    const headerUserRole = req.headers.get("x-user-role") || searchParams.get("userRole") || "student";
    const userId = Number(headerUserId);

    if (!userId || isNaN(userId)) {
      // Unauthenticated users only have access to Free Introduction (topic_order === 1)
      return NextResponse.json({
        success: true,
        data: {
          course_id: courseId,
          purchased: false,
          authenticated: false,
        },
      });
    }

    const purchased = await isOnlineCoursePurchased(userId, courseId, headerUserRole);

    return NextResponse.json({
      success: true,
      data: {
        course_id: courseId,
        purchased,
        authenticated: true,
        user_id: userId,
      },
    });
  } catch (error) {
    console.error("[OnlineCourse Access Check Error]:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify course access.",
        data: { purchased: false },
      },
      { status: 500 }
    );
  }
}
