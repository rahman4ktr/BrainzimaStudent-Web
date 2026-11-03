// app/api/coupon/validate/route.ts
// Proxy handler for /api/coupon/validate to Brainzima PHP REST API backend
// Validates offline coupon applicability against bi_coupons and computes discount server-side.

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

    const res = await fetch(`${PHP_API}/coupon/validate`, {
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

    const actualFee = Number(body.course_fee || body.base_amount || 0);
    if (data?.success && data?.data && actualFee > 0) {
      const v = data.data;
      const discountType = v.discount_type || "percentage";
      const discountVal = Number(v.discount_value || 0);

      let correctDiscount = 0;
      if (discountType === "percentage") {
        correctDiscount = Math.round((actualFee * discountVal) / 100);
      } else {
        correctDiscount = Math.min(actualFee, discountVal);
      }

      v.base_amount = actualFee;
      v.discount_amount = correctDiscount;
      v.net_payable = Math.max(0, actualFee - correctDiscount);
    }

    return NextResponse.json(data, { status: res.status || 200 });
  } catch (error: any) {
    console.error("[Offline Coupon Validate API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to connect to coupon validation service.",
      },
      { status: 500 }
    );
  }
}
