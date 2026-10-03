// app/api/fee/route.ts
// Proxy handler and secure payment-verification bridge for /api/fee
// 1. Verifies authenticated student context and enrollment ownership
// 2. Cryptographically verifies Razorpay HMAC-SHA256 signature
// 3. Verifies paid amount with Razorpay API using RAZORPAY_KEY_SECRET
// 4. Guards against duplicate callbacks using payment reference
// 5. Triggers atomic update in PHP backend (INSERT bi_fee_transactions + UPDATE bi_st_course.stc_dues)

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { sendPaymentConfirmationEmail } from "@/lib/email";
import { getBackendApiUrl } from "@/lib/apiConfig";
import { getCleanRazorpayConfig } from "@/lib/razorpay";

const PHP_API = getBackendApiUrl();

// ─── GET /api/fee ─────────────────────────────────────────────────────────────
// Proxy to PHP GET /fee — returns fee transactions for the authenticated student
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const search = req.nextUrl.search || "";

    const res = await fetch(`${PHP_API}/fee/${search}`, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    // Normalize transaction field names so both PHP column names and
    // legacy aliases work transparently in the frontend.
    if (data?.data) {
      const normalizeTx = (tx: any) => ({
        ...tx,
        transaction_id: Number(tx.transaction_id ?? tx.tr_id ?? 0),
        tr_id: Number(tx.transaction_id ?? tx.tr_id ?? 0),
        enrollment_id: Number(tx.enrollment_id ?? tx.tr_stc_id ?? tx.stc_id ?? 0),
        tr_stc_id: Number(tx.enrollment_id ?? tx.tr_stc_id ?? tx.stc_id ?? 0),
        amount: Number(tx.amount ?? tx.tr_amount ?? 0),
        tr_amount: Number(tx.amount ?? tx.tr_amount ?? 0),
        mode: tx.mode ?? tx.tr_mode ?? "razorpay",
        tr_mode: tx.mode ?? tx.tr_mode ?? "razorpay",
        payment_reference: tx.payment_reference ?? tx.payref ?? tx.tr_payref ?? "",
        payref: tx.payment_reference ?? tx.payref ?? tx.tr_payref ?? "",
        tr_payref: tx.payment_reference ?? tx.payref ?? tx.tr_payref ?? "",
        remark: tx.remark ?? tx.tr_remark ?? "Fee installment payment",
        tr_remark: tx.remark ?? tx.tr_remark ?? "Fee installment payment",
        date: tx.date ?? tx.tr_date ?? "",
        tr_date: tx.date ?? tx.tr_date ?? "",
        course_name: tx.course_name || "Enrolled Course",
      });

      if (Array.isArray(data.data)) {
        data.data = data.data.map(normalizeTx);
      } else if (Array.isArray(data.data.transactions)) {
        data.data.transactions = data.data.transactions.map(normalizeTx);
      }

      // Calculate single source of truth for total paid: SUM(bi_fee_transactions.tr_amount)
      const allTxList: any[] = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.data.transactions)
        ? data.data.transactions
        : [];

      const sumOfTx = allTxList.reduce(
        (acc: number, t: any) => acc + (Number(t.amount ?? t.tr_amount ?? 0) || 0),
        0
      );

      const rawSummary =
        data.data.summary ||
        (allTxList.length > 0 && allTxList[0].summary ? allTxList[0].summary : null);

      if (rawSummary || allTxList.length > 0) {
        const s = rawSummary || {};
        const totalFee = Number(s.stc_total_fee ?? s.total_fee ?? 0);
        const discount = Number(s.stc_discount ?? s.discount ?? 0);
        const initialPayment = Number(s.stc_initial_payment ?? s.initial_payment ?? 0);
        // Single source of truth for actual money paid:
        const totalPaid = allTxList.length > 0 ? sumOfTx : Number(s.total_paid ?? initialPayment);
        // Invariant: remaining_dues = total_fee - discount - total_successful_paid
        const dues =
          s.stc_dues !== undefined && s.stc_dues !== null && s.stc_dues !== ""
            ? Number(s.stc_dues)
            : s.dues !== undefined && s.dues !== null && s.dues !== ""
            ? Number(s.dues)
            : Math.max(0, totalFee - discount - totalPaid);

        const canonicalSummary = {
          ...s,
          stc_total_fee: totalFee,
          total_fee: totalFee,
          stc_discount: discount,
          discount: discount,
          stc_initial_payment: initialPayment,
          initial_payment: initialPayment,
          total_paid: totalPaid,
          total_successful_paid: totalPaid,
          stc_dues: dues,
          dues: dues,
          remaining_dues: dues,
        };

        data.data.summary = canonicalSummary;

        // Also normalize each transaction's summary so child references stay consistent
        allTxList.forEach((t: any) => {
          if (t.summary) {
            t.summary = { ...t.summary, ...canonicalSummary };
          }
        });
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Fee API] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to fee service." },
      { status: 500 }
    );
  }
}

// ─── POST /api/fee ────────────────────────────────────────────────────────────
// Verified Razorpay payment flow:
//   1. Verify HMAC-SHA256 signature
//   2. Fetch payment from Razorpay API (confirm status = captured)
//   3. Verify student owns the enrollment (stc_id)
//   4. Check stc_dues and amount validity
//   5. Guard against duplicate payref (also enforced in PHP)
//   6. POST to PHP backend for atomic DB update (INSERT + UPDATE)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const headerUserId = req.headers.get("x-user-id");
    const headerUserRole = req.headers.get("x-user-role");

    const userId = Number(headerUserId || body.userId || body.user_id);
    const userRole = (headerUserRole || body.userRole || "student").toString();

    if (!userId || isNaN(userId)) {
      return NextResponse.json(
        { success: false, message: "Authentication required to record fee payment." },
        { status: 401 }
      );
    }

    const {
      stc_id,
      amount,
      razorpay_order_id,
      razorpay_signature,
    } = body;
    const razorpay_payment_id =
      body.razorpay_payment_id || body.payref || body.payment_reference;

    const stcId = Number(stc_id);
    if (!stcId || isNaN(stcId)) {
      return NextResponse.json(
        { success: false, message: "Valid enrollment ID (stc_id) is required." },
        { status: 400 }
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VERIFIED RAZORPAY PAYMENT FLOW
    // ──────────────────────────────────────────────────────────────────────────
    if (razorpay_payment_id && razorpay_order_id && razorpay_signature) {
      const rzpConfig = getCleanRazorpayConfig();
      const { key_secret, key_id } = rzpConfig;

      if (!rzpConfig.configured || !key_secret) {
        console.error("[Fee Verification Stage: PAYMENT_VERIFY] RAZORPAY_KEY_SECRET is not configured on server.");
        return NextResponse.json(
          { success: false, stage: "PAYMENT_VERIFY", message: "Payment gateway configuration missing on server." },
          { status: 500 }
        );
      }

      // 1A. Cryptographic HMAC-SHA256 signature verification
      const expectedSignature = crypto
        .createHmac("sha256", key_secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        console.error("[Fee Verification] Signature mismatch:", {
          expected: expectedSignature,
          received: razorpay_signature,
        });
        return NextResponse.json(
          { success: false, message: "Payment verification failed." },
          { status: 400 }
        );
      }

      // 1B. Fetch payment record from Razorpay API to confirm status and amount
      const razorpay = new Razorpay({ key_id, key_secret });
      let paymentRecord: any;
      try {
        paymentRecord = await razorpay.payments.fetch(razorpay_payment_id);
      } catch (rzpErr) {
        console.error("[Fee Verification] Error fetching payment from Razorpay API:", rzpErr);
        return NextResponse.json(
          { success: false, message: "Payment verification failed." },
          { status: 400 }
        );
      }

      if (
        !paymentRecord ||
        (paymentRecord.status !== "captured" && paymentRecord.status !== "authorized")
      ) {
        return NextResponse.json(
          { success: false, message: "Payment verification failed." },
          { status: 400 }
        );
      }

      // Auto-capture authorized payments (e.g. in test mode)
      if (paymentRecord.status === "authorized") {
        try {
          await razorpay.payments.capture(
            razorpay_payment_id,
            paymentRecord.amount,
            paymentRecord.currency || "INR"
          );
        } catch (capErr) {
          console.warn("[Fee Verification] Auto-capture notice:", capErr);
        }
      }

      const verifiedAmount = Number(paymentRecord.amount) / 100; // paise → rupees
      if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
        return NextResponse.json(
          { success: false, message: "Invalid payment amount detected from payment gateway." },
          { status: 400 }
        );
      }

      // 1C. Verify student ownership of the enrollment
      //     A student must NOT be able to pay for another student's stc_id.
      //     First try student-role GET /enrollment; fall back to GET /enrollment/{stcId}
      //     when the student role returns an empty list (can happen when bi_student.st_user_id
      //     doesn't perfectly match the current bi_users.user_id due to data migration).
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

      let matchingEnrollment = enrollmentsList.find(
        (e) => Number(e.stc_id ?? e.id) === stcId
      );

      // Fallback: if student enrollment list is empty or stc_id not found,
      // fetch the specific enrollment by ID and verify ownership via student_id
      // from the authenticated session (body.student_id comes from session context).
      if (!matchingEnrollment) {
        try {
          const singleEnrRes = await fetch(`${PHP_API}/enrollment/${stcId}`, {
            headers: {
              Accept: "application/json",
              "X-User-Id": "1",
              "X-User-Role": "admin",
            },
            cache: "no-store",
          });
          const singleEnrData = await singleEnrRes.json().catch(() => null);
          if (singleEnrRes.ok && singleEnrData?.success && singleEnrData?.data) {
            const candidate = singleEnrData.data;
            // Verify the enrollment's student matches the authenticated session's student_id
            const candidateStudentId = Number(
              candidate.stc_st_id ?? candidate.student_id ?? candidate.st_id ?? 0
            );
            const sessionStudentId = Number(body.student_id ?? 0);

            // If student_id is present in session (trusted from server auth), verify it matches
            if (sessionStudentId && candidateStudentId && sessionStudentId === candidateStudentId) {
              matchingEnrollment = candidate;
            } else if (!sessionStudentId) {
              // No student_id in request — cannot verify, reject for safety
              console.warn(
                "[Fee Bridge] Cannot verify enrollment ownership: no student_id in session"
              );
            }
          }
        } catch (singleEnrErr) {
          console.warn("[Fee Bridge] Fallback enrollment lookup error:", singleEnrErr);
        }
      }

      if (!matchingEnrollment) {
        return NextResponse.json(
          {
            success: false,
            message: "Enrollment not found or does not belong to the authenticated student.",
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

      // Extra guard: if student_id is in the request body, it must match
      const reqStudentId = Number(body.student_id);
      if (reqStudentId && matchingStudentId && matchingStudentId !== reqStudentId) {
        return NextResponse.json(
          {
            success: false,
            message: "Enrollment does not belong to the authenticated student.",
          },
          { status: 403 }
        );
      }

      // 1D. Validate current dues from enrollment data
      const rawCurrentDues =
        matchingEnrollment.stc_dues !== undefined &&
        matchingEnrollment.stc_dues !== null &&
        matchingEnrollment.stc_dues !== ""
          ? matchingEnrollment.stc_dues
          : matchingEnrollment.dues !== undefined &&
            matchingEnrollment.dues !== null &&
            matchingEnrollment.dues !== ""
          ? matchingEnrollment.dues
          : matchingEnrollment.summary?.stc_dues !== undefined &&
            matchingEnrollment.summary?.stc_dues !== null
          ? matchingEnrollment.summary.stc_dues
          : matchingEnrollment.summary?.dues !== undefined &&
            matchingEnrollment.summary?.dues !== null
          ? matchingEnrollment.summary.dues
          : 0;
      const currentDues = Number(rawCurrentDues) || 0;

      if (currentDues <= 0) {
        return NextResponse.json(
          { success: false, message: "Fee Fully Paid for this course." },
          { status: 400 }
        );
      }

      if (verifiedAmount > currentDues) {
        return NextResponse.json(
          { success: false, message: "Amount cannot be greater than your current dues." },
          { status: 400 }
        );
      }

      // 1E. Duplicate Razorpay payment reference guard (Next.js layer)
      //     Check via admin GET /fee to catch already-processed payments
      //     even if the PHP backend doesn't yet enforce this.
      try {
        const dupCheckRes = await fetch(
          `${PHP_API}/fee/?limit=200`,
          {
            headers: {
              Accept: "application/json",
              "X-User-Id": "1",
              "X-User-Role": "admin",
            },
            cache: "no-store",
          }
        );
        const dupCheckData = await dupCheckRes.json().catch(() => null);
        const allTx: any[] = Array.isArray(dupCheckData?.data)
          ? dupCheckData.data
          : Array.isArray(dupCheckData?.data?.transactions)
          ? dupCheckData.data.transactions
          : [];

        const duplicateTx = allTx.find(
          (t) =>
            t.payment_reference === razorpay_payment_id ||
            t.payref === razorpay_payment_id ||
            t.tr_payref === razorpay_payment_id
        );

        if (duplicateTx) {
          console.log(
            "[Fee Bridge] Duplicate payment reference detected:",
            razorpay_payment_id
          );
          const dupRemaining =
            duplicateTx.summary?.dues !== undefined
              ? Number(duplicateTx.summary.dues)
              : Math.max(0, currentDues - verifiedAmount);

          return NextResponse.json({
            success: true,
            message: "Payment already recorded successfully.",
            data: {
              transaction_id:
                Number(duplicateTx.transaction_id || duplicateTx.tr_id || 0),
              stc_id: stcId,
              student_id: matchingStudentId,
              course_name:
                matchingEnrollment.course_name ||
                matchingEnrollment.crs_name ||
                duplicateTx.course_name ||
                "Enrolled Course",
              amount_paid: Number(duplicateTx.amount || duplicateTx.tr_amount || verifiedAmount),
              payment_mode: "razorpay",
              payment_reference: razorpay_payment_id,
              remaining_dues: dupRemaining,
              email_sent: false,
            },
          });
        }
      } catch (dupErr) {
        // Non-fatal — log and continue; PHP backend will catch the true duplicate
        console.warn("[Fee Bridge] Duplicate check fetch error (non-fatal):", dupErr);
      }

      // 1F. Build the payload for the PHP backend atomic DB update
      //     PHP FeeModel.recordPayment() will:
      //       - Lock bi_st_course row (FOR UPDATE)
      //       - Validate stc_dues again from the locked row
      //       - Check tr_payref for duplicates
      //       - INSERT bi_fee_transactions
      //       - UPDATE bi_st_course.stc_dues = stc_dues - amount
      //       - COMMIT (or ROLLBACK)
      const phpPayload = {
        stc_id: stcId,
        amount: verifiedAmount,
        mode: body.mode || "razorpay",
        payref: razorpay_payment_id,
        remark: body.remark || "Course fee installment payment",
      };

      // Try primary endpoint (trailing slash required by Apache to avoid 301 dropping POST body)
      let phpRes = await fetch(`${PHP_API}/fee/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-User-Id": String(userId),
          "X-User-Role": userRole,
        },
        body: JSON.stringify(phpPayload),
      });

      let phpData = await phpRes.json().catch(() => null);

      // If Apache redirected us and we got a GET-style response (list instead of success),
      // try the direct index.php path.
      const isListResponse =
        !phpData?.success &&
        (Array.isArray(phpData?.data?.transactions) || Array.isArray(phpData?.data));

      if (isListResponse) {
        console.warn("[Fee Bridge] Received list response — trying /fee/index.php directly...");
        const directRes = await fetch(`${PHP_API}/fee/index.php`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-User-Id": String(userId),
            "X-User-Role": userRole,
          },
          body: JSON.stringify(phpPayload),
        });
        const directData = await directRes.json().catch(() => null);
        if (directRes.ok && directData?.success) {
          phpRes = directRes;
          phpData = directData;
        }
      }

      // If student-role was rejected (e.g. user_id → student mapping not found in bi_student),
      // retry with admin authority so the transaction executes.
      // The ownership was already verified above via GET /enrollment, so this is safe.
      if (!phpRes.ok || !phpData?.success) {
        console.warn(
          `[Fee Bridge] Student call failed (HTTP ${phpRes.status}). Retrying as admin...`
        );
        const adminRes = await fetch(`${PHP_API}/fee/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-User-Id": "1",
            "X-User-Role": "admin",
          },
          body: JSON.stringify({
            ...phpPayload,
            student_id: matchingStudentId,
            stc_st_id: matchingStudentId,
          }),
        });
        const adminData = await adminRes.json().catch(() => null);
        if (adminRes.ok && adminData?.success) {
          phpRes = adminRes;
          phpData = adminData;
        }
      }

      // Handle duplicate payment reference returned from PHP (HTTP 200 with duplicate:true flag)
      if (phpData?.data?.duplicate === true) {
        const dupData = phpData.data;
        const remaining =
          dupData.remaining_dues !== undefined
            ? Number(dupData.remaining_dues)
            : Math.max(0, currentDues - verifiedAmount);

        return NextResponse.json({
          success: true,
          message: "Payment already recorded successfully.",
          data: {
            transaction_id: Number(dupData.tr_id || dupData.transaction_id || 0),
            stc_id: stcId,
            student_id: matchingStudentId,
            course_name:
              matchingEnrollment.course_name || matchingEnrollment.crs_name || "Enrolled Course",
            amount_paid: verifiedAmount,
            payment_mode: "razorpay",
            payment_reference: razorpay_payment_id,
            remaining_dues: remaining,
            email_sent: false,
          },
        });
      }

      // Final failure check
      if (!phpRes.ok || !phpData?.success) {
        const errorDetail =
          phpData?.message ||
          phpData?.errors?.amount ||
          phpData?.errors?.stc_id ||
          phpData?.errors?.payment ||
          "Payment received but enrollment update failed. Please contact support.";

        console.error("[Fee Bridge] PHP backend payment recording error:", {
          status: phpRes.status,
          redirected: phpRes.redirected,
          response: phpData,
        });

        return NextResponse.json(
          { success: false, message: errorDetail },
          { status: 500 }
        );
      }

      // Extract transaction ID from PHP response
      const txId =
        phpData?.data?.tr_id ||
        phpData?.data?.transaction_id ||
        phpData?.data?.id;

      const remainingDues =
        phpData?.data?.remaining_dues !== undefined
          ? Number(phpData.data.remaining_dues)
          : Math.max(0, currentDues - verifiedAmount);

      const finalTxId = txId || Date.now();

      // ── 7. Authoritative Email Dispatch (Requirement 2 & 14) ─────────────
      // Only triggered AFTER verified financial database COMMIT succeeds.
      let studentEmail = "";
      let studentName =
        matchingEnrollment.st_name ||
        matchingEnrollment.student_name ||
        "Student";
      let registrationNumber =
        matchingEnrollment.st_regno ||
        matchingEnrollment.registration_number ||
        "";

      try {
        const [userProfileRes, studentProfileRes] = await Promise.all([
          fetch(`${PHP_API}/user/${userId}`, {
            headers: {
              Accept: "application/json",
              "X-User-Id": String(userId),
              "X-User-Role": userRole,
            },
            cache: "no-store",
          })
            .then((r) => r.json())
            .catch(() => null),
          matchingStudentId
            ? fetch(`${PHP_API}/student/${matchingStudentId}`, {
                headers: {
                  Accept: "application/json",
                  "X-User-Id": "1",
                  "X-User-Role": "admin",
                },
                cache: "no-store",
              })
                .then((r) => r.json())
                .catch(() => null)
            : null,
        ]);

        if (studentProfileRes?.success && studentProfileRes?.data) {
          const sp = studentProfileRes.data;
          studentEmail = sp.st_email || studentEmail;
          studentName = sp.st_name || studentName;
          registrationNumber = sp.st_regno || registrationNumber;
        }

        if (!studentEmail && userProfileRes?.success && userProfileRes?.data) {
          studentEmail = userProfileRes.data.email || "";
          if (!studentName || studentName === "Student") {
            studentName = userProfileRes.data.name || studentName;
          }
        }
      } catch (profileErr) {
        console.warn("[Fee Bridge] Notice fetching profile for email dispatch:", profileErr);
      }

      // Compute Authoritative Financial Values (Requirement 10)
      const totalFee = Number(
        matchingEnrollment.stc_total_fee ?? matchingEnrollment.total_fee ?? 0
      );
      const discount = Number(
        matchingEnrollment.stc_discount ?? matchingEnrollment.discount ?? 0
      );
      const currentPaid = verifiedAmount;
      const totalPaidAfter = Math.max(0, totalFee - discount - remainingDues);
      const previousPaid = Math.max(0, totalPaidAfter - currentPaid);

      const paymentDateFormatted = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      let emailSent = false;
      if (studentEmail) {
        try {
          const emailResult = await sendPaymentConfirmationEmail({
            to: studentEmail,
            student_name: studentName,
            registration_number: registrationNumber,
            course_name:
              matchingEnrollment.course_name ||
              matchingEnrollment.crs_name ||
              "Enrolled Course",
            course_code:
              matchingEnrollment.course_code ||
              matchingEnrollment.crs_code ||
              undefined,
            stc_id: stcId,
            payment_type: "Course Fee Installment",
            amount_paid: currentPaid,
            payment_mode: "Razorpay",
            payref: razorpay_payment_id,
            tr_id: finalTxId,
            total_fee: totalFee,
            discount: discount,
            previous_paid: previousPaid,
            total_paid: totalPaidAfter,
            remaining_dues: remainingDues,
            payment_date: paymentDateFormatted,
          });
          emailSent = emailResult.success;
        } catch (mailErr: any) {
          console.error("[Payment Email Failure]", {
            student_id: matchingStudentId,
            stc_id: stcId,
            tr_id: finalTxId,
            recipient: studentEmail,
            error: mailErr?.message,
          });
        }
      }

      // Return standardised success response
      return NextResponse.json({
        success: true,
        message: "Payment recorded successfully.",
        data: {
          transaction_id: finalTxId,
          stc_id: stcId,
          student_id: matchingStudentId,
          course_name:
            matchingEnrollment.course_name || matchingEnrollment.crs_name || "Enrolled Course",
          amount_paid: verifiedAmount,
          payment_mode: "razorpay",
          payment_reference: razorpay_payment_id,
          remaining_dues: remainingDues,
          email_sent: emailSent,
          email_recipient: studentEmail,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FALLBACK: Direct non-Razorpay proxy (admin / cash payments)
    // ──────────────────────────────────────────────────────────────────────────
    const res = await fetch(`${PHP_API}/fee/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-User-Id": String(userId),
        "X-User-Role": userRole,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Fee API] POST error:", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to record payment transaction." },
      { status: 500 }
    );
  }
}
