// app/api/razorpay/order/route.ts
// Secure server-side Razorpay order creation for Course Admission and Student Fee Installments.
// Strictly guards RAZORPAY_KEY_SECRET (server-only) and validates payable amounts.

import { NextRequest, NextResponse } from "next/server";
import { getCleanRazorpayConfig, getRazorpayClient } from "@/lib/razorpay";
import { getBackendApiUrl } from "@/lib/apiConfig";

const PHP_API = getBackendApiUrl();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { amount, course_id, discount = 0, stc_id } = body;

    const config = getCleanRazorpayConfig();

    if (!config.configured) {
      console.error("[Razorpay Order Stage: ORDER_CREATE] Missing Razorpay credentials in environment:", {
        hasKeyId: Boolean(config.key_id),
        hasSecret: Boolean(config.key_secret),
      });
      return NextResponse.json(
        {
          success: false,
          stage: "ORDER_CREATE",
          message:
            "Razorpay payment gateway credentials not configured on server. Please ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in environment.",
        },
        { status: 500 }
      );
    }

    const { key_id, key_secret } = config;

    // Require authenticated user
    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role");
    const userId = Number(headerUserId || body.userId || body.user_id);
    const userRole = (headerUserRole || body.userRole || "student").toString();

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { success: false, message: "Authentication required to initiate payment." },
        { status: 401 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Payment amount must be greater than zero." },
        { status: 400 }
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE A: Student Fee Installment Payment (stc_id provided)
    // ──────────────────────────────────────────────────────────────────────────
    if (stc_id) {
      const stcId = Number(stc_id);
      if (!stcId || isNaN(stcId)) {
        return NextResponse.json(
          { success: false, message: "Valid Enrollment ID (stc_id) is required." },
          { status: 400 }
        );
      }

      // 1. Verify student ownership and fetch enrollment details from PHP backend
      const enrRes = await fetch(`${PHP_API}/enrollment`, {
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
        cache: "no-store",
      });
      const enrData = await enrRes.json().catch(() => null);

      let enrollmentsList: any[] = [];
      if (enrData?.success && enrData?.data) {
        if (Array.isArray(enrData.data)) {
          enrollmentsList = enrData.data;
        } else if (Array.isArray(enrData.data.enrollments)) {
          enrollmentsList = enrData.data.enrollments;
        }
      }

      const matchingEnrollment = enrollmentsList.find(
        (e) => Number(e.stc_id ?? e.id) === stcId
      );

      if (!matchingEnrollment) {
        return NextResponse.json(
          {
            success: false,
            message: "Enrollment not found or does not belong to authenticated student.",
          },
          { status: 403 }
        );
      }

      const matchingStudentId = Number(
        matchingEnrollment.student_id ??
        matchingEnrollment.stc_st_id ??
        matchingEnrollment.st_id ??
        body.student_id ??
        0
      );

      // Check student ownership if student_id is provided in request
      const reqStudentId = Number(body.student_id);
      if (reqStudentId && matchingStudentId && matchingStudentId !== reqStudentId) {
        return NextResponse.json(
          {
            success: false,
            message: "Enrollment does not belong to authenticated student.",
          },
          { status: 403 }
        );
      }

      const rawCurrentDues =
        matchingEnrollment.stc_dues !== undefined && matchingEnrollment.stc_dues !== null && matchingEnrollment.stc_dues !== ""
          ? matchingEnrollment.stc_dues
          : matchingEnrollment.dues !== undefined && matchingEnrollment.dues !== null && matchingEnrollment.dues !== ""
          ? matchingEnrollment.dues
          : matchingEnrollment.summary?.dues !== undefined && matchingEnrollment.summary?.dues !== null
          ? matchingEnrollment.summary.dues
          : 0;
      const currentDues = Number(rawCurrentDues) || 0;

      if (currentDues <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Fee is already fully paid for this course.",
          },
          { status: 400 }
        );
      }

      if (numAmount > currentDues) {
        return NextResponse.json(
          {
            success: false,
            message: "Amount cannot be greater than your current dues.",
          },
          { status: 400 }
        );
      }

      // Initialize Razorpay SDK on server
      const razorpay = getRazorpayClient();

      const amountInPaise = Math.round(numAmount * 100);
      const receipt = `rcpt_fee_${Date.now()}_u${userId}_stc${stcId}`.slice(0, 40);

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          type: "fee_installment",
          user_id: String(userId),
          stc_id: String(stcId),
          student_id: String(matchingEnrollment.student_id || ""),
          course_name: String(matchingEnrollment.course_name || ""),
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || key_id,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE B: Course Admission Enrollment (course_id provided)
    // ──────────────────────────────────────────────────────────────────────────
    const courseId = Number(course_id);
    if (!courseId || isNaN(courseId)) {
      return NextResponse.json(
        { success: false, message: "Valid Course ID is required." },
        { status: 400 }
      );
    }

    // 1. Check if authenticated user is already enrolled in this course
    try {
      const enrCheckRes = await fetch(`${PHP_API}/enrollment`, {
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
        cache: "no-store",
      });
      const enrCheckData = await enrCheckRes.json().catch(() => null);
      let existingList: any[] = [];
      if (enrCheckData?.data) {
        if (Array.isArray(enrCheckData.data)) {
          existingList = enrCheckData.data;
        } else if (Array.isArray(enrCheckData.data.enrollments)) {
          existingList = enrCheckData.data.enrollments;
        }
      }
      const isAlready = existingList.some(
        (e: any) => Number(e.course_id ?? e.stc_course_id) === courseId
      );
      if (isAlready) {
        return NextResponse.json(
          {
            success: false,
            message: "You are already enrolled in this course.",
          },
          { status: 409 }
        );
      }
    } catch (checkErr) {
      console.warn("[Razorpay Order] Duplicate check notice:", checkErr);
    }

    // 2. Fetch official course fee from backend
    const courseRes = await fetch(`${PHP_API}/course/${courseId}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const courseData = await courseRes.json().catch(() => null);

    if (!courseRes.ok || !courseData?.data) {
      return NextResponse.json(
        { success: false, message: "Course details could not be verified from backend." },
        { status: 404 }
      );
    }

    const officialFee = Number(courseData.data.course_fee || 0);
    const cleanDiscount = Math.max(0, Math.min(Number(discount || 0), officialFee));
    const netPayable = Math.max(0, officialFee - cleanDiscount);

    if (numAmount > netPayable) {
      return NextResponse.json(
        {
          success: false,
          message: `Payment amount cannot exceed net payable of ₹${netPayable.toLocaleString("en-IN")}.`,
        },
        { status: 400 }
      );
    }

    // 2. Initialize Razorpay SDK on server
    const razorpay = getRazorpayClient();

    const amountInPaise = Math.round(numAmount * 100);
    const receipt = `rcpt_${Date.now()}_u${userId}_c${courseId}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        type: "course_admission",
        user_id: String(userId),
        course_id: String(courseId),
        course_name: String(courseData.data.course_name || ""),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || key_id,
      },
    });
  } catch (error: any) {
    const errCode = error?.error?.code || error?.code || "ORDER_CREATION_FAILED";
    const errDesc =
      error?.error?.description ||
      error?.message ||
      "Failed to initialize payment gateway order.";

    console.error("[Razorpay Order Stage: ORDER_CREATE] Error creating order:", {
      code: errCode,
      description: errDesc,
      status: error?.statusCode,
    });

    return NextResponse.json(
      {
        success: false,
        stage: "ORDER_CREATE",
        code: errCode,
        message: `Payment gateway error: ${errDesc}`,
      },
      { status: 500 }
    );
  }
}
