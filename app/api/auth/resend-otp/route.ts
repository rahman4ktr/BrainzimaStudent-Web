// app/api/auth/resend-otp/route.ts
// Adheres strictly to Brainzima Resend OTP & Rate Limiting specification:
// 1. Normalize email
// 2. Check 60-second cooldown rate limit -> HTTP 429
// 3. Generate new cryptographically secure 6-digit OTP
// 4. Invalidate previous OTP immediately (replaces previous hash)
// 5. Set new expiry time = now + 10 minutes
// 6. Send new OTP via Nodemailer
// 7. Return HTTP 200 (stripping OTP, never exposing to browser)

import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/email";
import { normalizeEmail, resendOtp, getUserOtpState } from "@/lib/otpStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = body.email || "";

    if (!rawEmail) {
      return NextResponse.json(
        {
          success: false,
          message: "Email is required to resend OTP.",
        },
        { status: 422 }
      );
    }

    const normalizedEmail = normalizeEmail(rawEmail);

    // If user is already verified
    const existing = getUserOtpState(normalizedEmail);
    if (existing && existing.user_verified === 1) {
      return NextResponse.json(
        {
          success: false,
          message: "Email is already verified. Please proceed to login.",
        },
        { status: 400 }
      );
    }

    // Call resendOtp to check 60s rate limit and generate new OTP
    const resendResult = resendOtp(normalizedEmail);

    // ── Check 60s rate limit -> HTTP 429 ─────────────────────────────────────
    if (resendResult.rateLimited) {
      return NextResponse.json(
        {
          success: false,
          message:
            resendResult.message ||
            "Please wait before requesting another OTP.",
          data: {
            wait_seconds: resendResult.waitSeconds,
          },
        },
        { status: 429 }
      );
    }

    if (!resendResult.rawOtp) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to generate a new OTP. Please try again.",
        },
        { status: 500 }
      );
    }

    // ── Send new OTP via Nodemailer ──────────────────────────────────────────
    try {
      await sendOtpEmail({
        to: normalizedEmail,
        name: resendResult.name || "Student",
        otp: resendResult.rawOtp,
      });
    } catch (emailErr: any) {
      console.error("[Brainzima] Resend OTP email failed in /resend-otp:", emailErr);
      const isConfigError =
        emailErr?.isConfigError ||
        emailErr?.code === "ECONFIG" ||
        emailErr?.message?.includes("configuration missing");
      const isAuthError =
        emailErr?.code === "EAUTH" || emailErr?.responseCode === 535;

      const reason = isConfigError
        ? "Email service credentials are not configured in production environment."
        : isAuthError
        ? "Email server authentication failed. Please check SMTP app password."
        : "Email delivery service is currently unreachable.";

      return NextResponse.json(
        {
          success: false,
          message:
            "Account could not be verified because the verification email could not be sent.",
          error_detail: reason,
          smtp_diagnostic_url: "/api/auth/verify-smtp",
        },
        { status: 500 }
      );
    }

    // ── Return HTTP 200 response (NEVER expose OTP or hash) ──────────────────
    return NextResponse.json(
      {
        success: true,
        message: "A new OTP has been sent to your email.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Brainzima] Resend-OTP route error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred while resending OTP.",
      },
      { status: 500 }
    );
  }
}
