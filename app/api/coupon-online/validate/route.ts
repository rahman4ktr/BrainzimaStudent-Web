// app/api/coupon-online/validate/route.ts
// Proxy handler for /api/coupon-online/validate to Brainzima PHP REST API backend
// Validates coupon applicability against database constraints and computes discount securely on server.

import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role");

    const couponCode = (body.coupon_code || "").toString().trim();
    const courseId = Number(body.course_id);

    if (!couponCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: { coupon_code: "Coupon code is required." },
        },
        { status: 422 }
      );
    }

    if (!courseId || isNaN(courseId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: { course_id: "A valid course ID is required." },
        },
        { status: 422 }
      );
    }

    // 1. Resolve authentic online course fee
    let actualCourseFee: number | null = null;
    if (body.course_fee && Number(body.course_fee) > 0) {
      actualCourseFee = Number(body.course_fee);
    } else if (body.base_amount && Number(body.base_amount) > 0) {
      actualCourseFee = Number(body.base_amount);
    } else {
      try {
        const cRes = await fetch(`${PHP_API}/onlinecoures/${courseId}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (cRes.ok) {
          const cData = await cRes.json().catch(() => null);
          if (cData?.data?.course_fee) {
            actualCourseFee = Number(cData.data.course_fee);
          }
        }
      } catch (err) {
        console.warn("[Coupon-online] Could not fetch online course fee fallback:", err);
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (headerUserId) headers["X-User-Id"] = headerUserId;
    if (headerUserRole) headers["X-User-Role"] = headerUserRole;

    const payload = {
      coupon_code: couponCode,
      course_id: courseId,
      ...(body.user_id ? { user_id: Number(body.user_id) } : {}),
      ...(body.email ? { email: String(body.email).trim() } : {}),
      ...(body.mobile ? { mobile: String(body.mobile).trim() } : {}),
    };

    const res = await fetch(`${PHP_API}/coupon-online/validate`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return NextResponse.json(
        {
          success: false,
          message:
            data?.message ||
            "Unable to validate coupon on server. Please try again.",
          errors: data?.errors,
        },
        { status: res.status || 500 }
      );
    }

    // 2. Correct discount calculation using actual online course fee
    // (Guards against backend mistakenly using offline bi_courses fee instead of online course fee)
    if (data?.success && data?.data && actualCourseFee && actualCourseFee > 0) {
      const v = data.data;
      const discountType = v.discount_type || "percentage";
      const discountVal = Number(v.discount_value || 0);

      let correctDiscount = 0;
      if (discountType === "percentage") {
        correctDiscount = Math.round((actualCourseFee * discountVal) / 100);
      } else {
        correctDiscount = Math.min(actualCourseFee, discountVal);
      }

      v.base_amount = actualCourseFee;
      v.discount_amount = correctDiscount;
      v.net_payable = Math.max(0, actualCourseFee - correctDiscount);
    }

    return NextResponse.json(data, { status: res.status || 200 });
  } catch (error: any) {
    console.error("[Coupon Validate API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to coupon validation service.",
      },
      { status: 500 }
    );
  }
}
