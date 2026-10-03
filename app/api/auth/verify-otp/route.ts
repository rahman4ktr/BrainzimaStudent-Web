// app/api/auth/verify-otp/route.ts
// Adheres strictly to Brainzima OTP Verification specification:
// 1. Normalize email
// 2. Find user & check user_verified
// 3. Check OTP existence & expiry (10 min -> HTTP 422 "OTP has expired.")
// 4. Verify candidate OTP against stored hash
// 5. Invalidate OTP immediately upon success (one-time use!)
// 6. Set user_verified = 1, user_otp_hash = NULL, user_otp_expires_at = NULL
// 7. Return success with authenticated user details for seamless dashboard routing

import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, verifySubmittedOtp } from "@/lib/otpStore";
import { getClientIp, getCurrentSqlDateTime } from "@/lib/utils";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const rawEmail = body.email || "";
    const rawOtp = body.otp || "";
    const clientIp = getClientIp(req, body.ip || body.last_login_ip);
    const currentSqlTime = getCurrentSqlDateTime();

    if (!rawEmail || !rawOtp) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and 6-digit OTP are required.",
        },
        { status: 422 }
      );
    }

    const normalizedEmail = normalizeEmail(rawEmail);
    const candidateOtp = String(rawOtp).trim();

    // Verify OTP against stored hash (checks expiry, timing-safe hash comparison, and clears on success)
    const result = verifySubmittedOtp(normalizedEmail, candidateOtp);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: result.status }
      );
    }

    const user = result.user;

    // Ensure PHP DB has user_image synced if assigned during registration
    if (user.user_id && user.user_image) {
      try {
        fetch(`${PHP_API}/user/image`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": String(user.user_id),
            "X-User-Role": user.role || "user",
            "X-HTTP-Method-Override": "PATCH",
            Accept: "application/json",
          },
          body: JSON.stringify({ user_image: user.user_image }),
        }).catch(() => {});
      } catch {
        /* best-effort sync */
      }
    }

    // ── Update last_login_at and last_login_ip in backend for User & Student ──
    if (user.user_id) {
      // 1. Sync User profile last login
      try {
        fetch(`${PHP_API}/user/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": String(user.user_id),
            "X-User-Role": user.role || "user",
            "X-HTTP-Method-Override": "PATCH",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: user.name,
            last_login_at: currentSqlTime,
            last_login_ip: clientIp,
            ip: clientIp,
            _method: "PATCH",
          }),
        }).catch(() => {});
      } catch {
        /* best effort sync */
      }

      // 2. If student, sync Student table last login
      if (user.is_student || user.student_id || user.role === "student") {
        if (user.student_id) {
          try {
            fetch(`${PHP_API}/student/${user.student_id}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-User-Id": String(user.user_id),
                "X-User-Role": "admin",
                "X-HTTP-Method-Override": "PATCH",
                Accept: "application/json",
              },
              body: JSON.stringify({
                last_login_at: currentSqlTime,
                last_login_ip: clientIp,
                ip: clientIp,
                _method: "PATCH",
              }),
            }).catch(() => {});
          } catch {
            /* best effort sync */
          }
        }
      }
    }

    // Return success response per specification with updated login info
    return NextResponse.json(
      {
        success: true,
        message: "Email verified successfully.",
        data: {
          verified: true,
          user: {
            user_id: user.user_id ?? 10,
            student_id: user.student_id ?? null,
            registration_number: user.registration_number ?? null,
            name: user.name,
            email: user.email,
            mobile: user.mobile ?? null,
            role: user.role ?? "user",
            is_student: user.is_student ?? false,
            centre_id: null,
            user_image: user.user_image ?? null,
            user_verified: 1,
            last_login_at: currentSqlTime,
            last_login_ip: clientIp,
          },
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Brainzima] Verify-OTP error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred during verification.",
      },
      { status: 500 }
    );
  }
}
