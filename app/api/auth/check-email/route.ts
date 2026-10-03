// app/api/auth/check-email/route.ts
// Diagnostic endpoint to check if an email exists in the PHP MySQL Database vs in-memory cache
// Usage:
// GET /api/auth/check-email?email=example@gmail.com
// GET /api/auth/check-email?email=example@gmail.com&clear=1  (Clears in-memory OTP cache for this email)
// GET /api/auth/check-email?clearAll=1                     (Clears entire in-memory OTP cache)

import { NextRequest, NextResponse } from "next/server";
import {
  normalizeEmail,
  getUserOtpState,
  clearUserOtpState,
  resetAllOtpStore,
} from "@/lib/otpStore";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawEmail = searchParams.get("email") || "";
    const shouldClear = searchParams.get("clear") === "1";
    const shouldClearAll = searchParams.get("clearAll") === "1";

    if (shouldClearAll) {
      resetAllOtpStore();
      return NextResponse.json({
        success: true,
        message: "All in-memory OTP records have been cleared.",
      });
    }

    if (!rawEmail) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide an email parameter: ?email=your_email@gmail.com",
        },
        { status: 400 }
      );
    }

    const normEmail = normalizeEmail(rawEmail);

    let cleared = false;
    if (shouldClear) {
      cleared = clearUserOtpState(normEmail);
    }

    // 1. Check in-memory store
    const localOtpRecord = getUserOtpState(normEmail);

    // 2. Check PHP MySQL database
    let dbStatus = "unknown";
    let dbDetails: any = null;

    try {
      // Safe check: do NOT create accounts during probe
      dbStatus = "SAFE_CHECK_ONLY";
      dbDetails = {
        note: "Diagnostic endpoint no longer attempts mutating registrations.",
      };
    } catch (dbErr: any) {
      dbStatus = "CHECK_ERROR";
      dbDetails = dbErr?.message;
    }

    return NextResponse.json({
      success: true,
      email: normEmail,
      cleared_from_memory: cleared,
      in_memory_state: localOtpRecord
        ? {
            exists: true,
            user_verified: localOtpRecord.user_verified,
            has_pending_otp: Boolean(localOtpRecord.user_otp_hash),
            expires_at: localOtpRecord.user_otp_expires_at
              ? new Date(localOtpRecord.user_otp_expires_at).toISOString()
              : null,
          }
        : { exists: false },
      database_check: {
        status: dbStatus,
        details: dbDetails,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to execute email check.",
        error: err?.message,
      },
      { status: 500 }
    );
  }
}
