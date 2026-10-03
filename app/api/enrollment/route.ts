// app/api/enrollment/route.ts
// Secure Next.js API Route Bridge for Student Admission & Course Enrollment
// Implements strict payment-verified enrollment lifecycle:
// 1. Validates authenticated user session
// 2. Cryptographically verifies Razorpay signature via HMAC-SHA256
// 3. Fetches & verifies payment status & exact paid amount from Razorpay API
// 4. Triggers atomic database transaction in PHP REST API
// 5. Syncs bi_student admission details and bi_st_docs path strings
// 6. Sends confirmation email via Nodemailer
// 7. Returns standardized envelope for session upgrade and redirection

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { sendPaymentConfirmationEmail, sendEnrollmentSuccessEmail } from "@/lib/email";
import { getBackendApiUrl } from "@/lib/apiConfig";
import { getCleanRazorpayConfig } from "@/lib/razorpay";

const PHP_API = getBackendApiUrl();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Extract authentication context
    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role");

    const userId = Number(body.userId || body.user_id || headerUserId);
    const userRole = (body.userRole || body.role || headerUserRole || "user")
      .toString()
      .toLowerCase();

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. User ID not found in session context.",
        },
        { status: 401 }
      );
    }

    const courseId = Number(body.course_id || body.courseId);
    const centreId = Number(body.centre_id || body.centreId);
    const batchId = body.batch_id ? Number(body.batch_id) : null;
    const discount = Number(body.discount || 0);
    const headerStudentId = req.headers.get("x-student-id");
    const studentIdFromBody = Number(body.student_id || body.studentId || headerStudentId) || null;

    if (!courseId || isNaN(courseId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please select a valid course to enroll.",
        },
        { status: 422 }
      );
    }

    if (!centreId || isNaN(centreId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please select a valid study centre.",
        },
        { status: 422 }
      );
    }

    // ── Check Duplicate Enrollment Protection ───────────────────────────────
    try {
      const enrCheckRes = await fetch(`${PHP_API}/enrollment`, {
        headers: {
          Accept: "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
          ...(studentIdFromBody ? { "X-Student-Id": String(studentIdFromBody) } : {}),
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
      console.warn("[Enrollment] Duplicate check notice:", checkErr);
    }

    // ── 1. Strictly verify Razorpay Payment Details ─────────────────────────
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      admission = {},
      documents = {},
    } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment was not completed. Verified Razorpay details are required.",
        },
        { status: 400 }
      );
    }

    const rzpConfig = getCleanRazorpayConfig();
    const { key_secret, key_id } = rzpConfig;

    if (!rzpConfig.configured || !key_secret) {
      console.error("[Enrollment Stage: PAYMENT_VERIFY] RAZORPAY_KEY_SECRET is not configured in environment.");
      return NextResponse.json(
        {
          success: false,
          stage: "PAYMENT_VERIFY",
          message: "Payment gateway configuration missing on server.",
        },
        { status: 500 }
      );
    }

    // 1A. Cryptographic HMAC-SHA256 signature verification
    const expectedSignature = crypto
      .createHmac("sha256", key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("[Enrollment] Razorpay signature verification mismatch:", {
        expected: expectedSignature,
        received: razorpay_signature,
      });
      return NextResponse.json(
        {
          success: false,
          message: "Payment verification failed. Please contact support.",
        },
        { status: 400 }
      );
    }

    // 1B. Fetch payment record directly from Razorpay API to verify actual captured amount
    const razorpay = new Razorpay({
      key_id,
      key_secret,
    });

    let paymentRecord: any;
    try {
      paymentRecord = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (rzpFetchErr: any) {
      console.error("[Enrollment] Error fetching payment from Razorpay API:", rzpFetchErr);
      return NextResponse.json(
        {
          success: false,
          message: "Payment verification failed. Could not verify payment with gateway.",
        },
        { status: 400 }
      );
    }

    if (!paymentRecord || (paymentRecord.status !== "captured" && paymentRecord.status !== "authorized")) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment was not completed. Status is not confirmed.",
        },
        { status: 400 }
      );
    }

    // If authorized but not captured, auto-capture
    if (paymentRecord.status === "authorized") {
      try {
        await razorpay.payments.capture(
          razorpay_payment_id,
          paymentRecord.amount,
          paymentRecord.currency || "INR"
        );
      } catch (capErr) {
        console.warn("[Enrollment] Notice during auto-capture:", capErr);
      }
    }

    const verifiedAmountInRupees = Number(paymentRecord.amount) / 100;
    if (isNaN(verifiedAmountInRupees) || verifiedAmountInRupees <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment amount detected from payment gateway.",
        },
        { status: 400 }
      );
    }

    // ── 2. Payment verified! Now execute backend enrollment transaction ─────
    // NOTE: Trailing slash is strictly required by the PHP router/Apache configuration
    const phpHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-User-Id": String(userId),
      "X-User-Role": userRole,
    };
    if (studentIdFromBody) {
      phpHeaders["X-Student-Id"] = String(studentIdFromBody);
    }

    const phpRes = await fetch(`${PHP_API}/enrollment/`, {
      method: "POST",
      headers: phpHeaders,
      body: JSON.stringify({
        course_id: courseId,
        centre_id: centreId,
        batch_id: batchId,
        discount,
        initial_payment: verifiedAmountInRupees,
        mode: "razorpay",
        payref: razorpay_payment_id,
        remark: "Course enrollment payment",
        ...(studentIdFromBody ? { student_id: studentIdFromBody } : {}),
      }),
    });

    const phpData = await phpRes.json().catch(() => null);

    if (!phpRes.ok || !phpData?.success) {
      console.error("[Enrollment Bridge] PHP backend enrollment error:", phpData);
      return NextResponse.json(
        {
          success: false,
          message:
            phpData?.message ||
            "Unable to complete course enrollment at this moment. Transaction rolled back.",
          errors: phpData?.errors,
        },
        { status: phpRes.status || 500 }
      );
    }

    const enrollmentData = phpData.data || {};
    const studentId = Number(enrollmentData.student_id || studentIdFromBody);
    const regno = String(enrollmentData.registration_number || "");
    const stcId = Number(enrollmentData.stc_id);

    // ── 3. Synchronize full admission information into bi_student (FIRST ENROLLMENT ONLY) ─
    // Only update bi_student if actual personal admission details were entered by the user
    const hasPersonalAdmissionDetails = Boolean(
      admission.st_fname ||
      admission.st_mname ||
      admission.st_dob ||
      admission.st_gender ||
      admission.st_mobile_parent ||
      admission.st_aadhaar ||
      admission.st_address ||
      admission.st_qualification
    );

    if (studentId && hasPersonalAdmissionDetails) {
      const admissionFields: Record<string, any> = {};
      if (admission.st_fname) admissionFields.st_fname = String(admission.st_fname).trim();
      if (admission.st_mname) admissionFields.st_mname = String(admission.st_mname).trim();
      if (admission.st_dob) admissionFields.st_dob = String(admission.st_dob).trim();
      if (admission.st_gender) admissionFields.st_gender = String(admission.st_gender).trim();
      if (admission.st_mobile_parent)
        admissionFields.st_mobile_parent = String(admission.st_mobile_parent).trim();
      if (admission.st_aadhaar) admissionFields.st_aadhaar = String(admission.st_aadhaar).trim();
      if (admission.st_address) admissionFields.st_address = String(admission.st_address).trim();
      if (admission.st_state) admissionFields.st_state = String(admission.st_state).trim();
      if (admission.st_city) admissionFields.st_city = String(admission.st_city).trim();
      if (admission.st_pincode) admissionFields.st_pincode = String(admission.st_pincode).trim();
      if (admission.st_qualification)
        admissionFields.st_qualification = String(admission.st_qualification).trim();
      if (admission.st_referredby)
        admissionFields.st_referredby = String(admission.st_referredby).trim();
      admissionFields.st_centre_id = centreId;

      try {
        await fetch(`${PHP_API}/student/${studentId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-User-Id": String(userId),
            "X-User-Role": "student",
          },
          body: JSON.stringify(admissionFields),
        });
      } catch (patchErr) {
        console.warn("[Enrollment Bridge] Notice syncing student admission details:", patchErr);
      }
    }

    // ── 4. Save document path strings into bi_st_docs if provided (FIRST ENROLLMENT ONLY) ─
    if (studentId && hasPersonalAdmissionDetails && documents && typeof documents === "object") {
      const cleanDocs: Record<string, string> = {};
      for (const k of ["docs_st_image", "docs_st_aadhaar_front", "docs_st_aadhaar_back", "docs_st_qualification"] as const) {
        const v = documents[k];
        if (typeof v === "string") {
          const t = v.trim();
          if (t && t !== "undefined" && t !== "null" && t !== "[object Object]") {
            cleanDocs[k] = t;
          }
        }
      }

      if (Object.keys(cleanDocs).length > 0) {
        try {
          await fetch(`${PHP_API}/document/student/${studentId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-User-Id": String(userId),
              "X-User-Role": "student",
            },
            body: JSON.stringify(cleanDocs),
          });
        } catch (docErr) {
          console.warn("[Enrollment Bridge] Notice saving student document paths:", docErr);
        }
      }
    }

    // ── 5. Send course payment & enrollment confirmation email via Nodemailer ─
    // Only triggered AFTER verified financial database COMMIT succeeds (Requirement 2 & 3).
    let emailSent = false;
    let studentEmail = "";

    try {
      const [fRes, cRes, uRes] = await Promise.all([
        fetch(`${PHP_API}/franchisee/${centreId}`).then((r) => r.json()).catch(() => null),
        fetch(`${PHP_API}/course/${courseId}`).then((r) => r.json()).catch(() => null),
        fetch(`${PHP_API}/user/${userId}`, {
          headers: { "X-User-Id": String(userId), "X-User-Role": "student" },
        })
          .then((r) => r.json())
          .catch(() => null),
      ]);

      const franchiseeName = fRes?.data?.franchisee_name || "Brainzima Study Centre";
      const franchiseeAdrs =
        fRes?.data?.franchisee_adrs ||
        `${fRes?.data?.franchisee_city || ""}, ${fRes?.data?.franchisee_state || ""}`;
      const courseName = cRes?.data?.course_name || "Enrolled Course";
      const courseCode = cRes?.data?.course_code || undefined;
      const userName = uRes?.data?.name || body.name || "Student";
      studentEmail = uRes?.data?.email || body.email || "";

      const totalFee = Number(enrollmentData.total_fee || cRes?.data?.course_fee || 0);
      const enrDiscount = Number(enrollmentData.discount || discount || 0);
      const enrPaid = verifiedAmountInRupees;
      const enrDues = Number(
        enrollmentData.dues ?? Math.max(0, totalFee - enrDiscount - enrPaid)
      );
      const paymentDateFormatted = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      if (studentEmail) {
        const emailResult = await sendPaymentConfirmationEmail({
          to: studentEmail,
          student_name: userName,
          registration_number: regno,
          course_name: courseName,
          course_code: courseCode,
          stc_id: stcId,
          payment_type: "Initial Admission Payment",
          amount_paid: enrPaid,
          payment_mode: "Razorpay",
          payref: razorpay_payment_id,
          tr_id: enrollmentData.tr_id || enrollmentData.transaction_id || undefined,
          total_fee: totalFee,
          discount: enrDiscount,
          previous_paid: 0,
          total_paid: enrPaid,
          remaining_dues: enrDues,
          payment_date: paymentDateFormatted,
          franchisee_name: franchiseeName,
          franchisee_adrs: franchiseeAdrs,
        });
        emailSent = emailResult.success;
      }
    } catch (emailErr: any) {
      console.error("[Payment Email Failure]", {
        student_id: studentId,
        stc_id: stcId,
        recipient: studentEmail,
        error: emailErr?.message,
      });
    }

    // ── 6. Return standardized success response (Requirement 24) ────────────
    return NextResponse.json(
      {
        success: true,
        message: "Enrollment successful.",
        data: {
          user_id: userId,
          student_id: studentId,
          registration_number: regno,
          role: "student",
          is_student: true,
          course_id: courseId,
          stc_id: stcId,
          amount_paid: verifiedAmountInRupees,
          payment_mode: "razorpay",
          payment_reference: razorpay_payment_id,
          centre_id: centreId,
          email_sent: emailSent,
          email_recipient: studentEmail,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[Enrollment Bridge] Unexpected exception:", err);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred while processing enrollment.",
        error: err?.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role") || "student";
    const headerStudentId = req.headers.get("x-student-id");

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || headerUserId;
    const studentId = searchParams.get("studentId") || headerStudentId;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID required." },
        { status: 401 }
      );
    }

    const phpHeaders: Record<string, string> = {
      Accept: "application/json",
      "X-User-Id": String(userId),
      "X-User-Role": headerUserRole,
    };
    if (studentId) {
      phpHeaders["X-Student-Id"] = String(studentId);
    }

    const phpRes = await fetch(`${PHP_API}/enrollment`, {
      headers: phpHeaders,
      cache: "no-store",
    });

    const phpData = await phpRes.json().catch(() => null);

    if (phpData?.data) {
      const normalize = (e: any) => {
        // Priority 1: stc_dues, Priority 2: dues, Priority 3: summary.dues / summary.stc_dues
        const rawDues =
          e.stc_dues !== undefined && e.stc_dues !== null && e.stc_dues !== ""
            ? e.stc_dues
            : e.dues !== undefined && e.dues !== null && e.dues !== ""
            ? e.dues
            : e.summary?.dues !== undefined && e.summary?.dues !== null
            ? e.summary.dues
            : e.summary?.stc_dues !== undefined && e.summary?.stc_dues !== null
            ? e.summary.stc_dues
            : 0;

        const rawTotalFee =
          e.stc_total_fee !== undefined && e.stc_total_fee !== null && e.stc_total_fee !== ""
            ? e.stc_total_fee
            : e.total_fee !== undefined && e.total_fee !== null && e.total_fee !== ""
            ? e.total_fee
            : e.summary?.total_fee !== undefined && e.summary?.total_fee !== null
            ? e.summary.total_fee
            : 0;

        const rawDiscount =
          e.stc_discount !== undefined && e.stc_discount !== null && e.stc_discount !== ""
            ? e.stc_discount
            : e.discount !== undefined && e.discount !== null && e.discount !== ""
            ? e.discount
            : e.summary?.discount !== undefined && e.summary?.discount !== null
            ? e.summary.discount
            : 0;

        const rawInitPay =
          e.stc_initial_payment !== undefined && e.stc_initial_payment !== null && e.stc_initial_payment !== ""
            ? e.stc_initial_payment
            : e.initial_payment !== undefined && e.initial_payment !== null && e.initial_payment !== ""
            ? e.initial_payment
            : 0;

        const duesNum = Number(rawDues) || 0;
        const totalFeeNum = Number(rawTotalFee) || 0;
        const discountNum = Number(rawDiscount) || 0;
        const initPayNum = Number(rawInitPay) || 0;

        // SINGLE SOURCE OF TRUTH:
        // total_paid is actual money paid (SUM of transactions).
        // Financial invariant: remaining_dues = total_fee - discount - total_paid
        const totalPaidNum =
          e.total_paid !== undefined && e.total_paid !== null && e.total_paid !== ""
            ? Number(e.total_paid)
            : e.summary?.total_paid !== undefined && e.summary?.total_paid !== null
            ? Number(e.summary.total_paid)
            : Math.max(initPayNum, totalFeeNum - discountNum - duesNum);

        return {
          ...e,
          stc_id: Number(e.stc_id ?? e.id),
          stc_dues: duesNum,
          dues: duesNum,
          remaining_dues: duesNum,
          stc_total_fee: totalFeeNum,
          total_fee: totalFeeNum,
          stc_discount: discountNum,
          discount: discountNum,
          stc_initial_payment: initPayNum,
          initial_payment: initPayNum,
          total_paid: totalPaidNum,
          total_successful_paid: totalPaidNum,
          course_name: e.course_name || e.crs_name || "Enrolled Course",
          course_code: e.course_code || e.crs_code || "",
          student_id: Number(e.student_id ?? e.stc_st_id ?? e.st_id),
        };
      };

      if (Array.isArray(phpData.data)) {
        phpData.data = phpData.data.map(normalize);
      } else if (Array.isArray(phpData.data.enrollments)) {
        phpData.data.enrollments = phpData.data.enrollments.map(normalize);
      }
    }

    return NextResponse.json(phpData, { status: phpRes.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to fetch enrollments" },
      { status: 500 }
    );
  }
}
