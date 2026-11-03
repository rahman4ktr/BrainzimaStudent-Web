// app/api/auth/verify-reset-otp/route.ts
// Verifies submitted Password Reset OTP.
// Strictly adheres to requirements:
// 1. Verifies 6-digit OTP against stored hash
// 2. Rejects wrong or expired OTP -> { success: false, message: "Invalid or expired OTP." }
// 3. Invalidates OTP immediately upon success (one-time use)
// 4. Marks OTP verified in server state (NO reset tokens, NO JWT)
// 5. Returns: { success: true, message: "OTP verified successfully.", data: null }

import { NextRequest, NextResponse } from "next/server";
import {
  normalizeEmail,
  verifyPasswordResetOtp,
} from "@/lib/passwordResetStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = (body.email || "").trim();
    const rawOtp = (body.otp || "").toString().trim();

    if (!rawEmail || !rawOtp) {
      return NextResponse.json(
        {
          success: false,
          message: "Email and 6-digit OTP are required.",
          errors: {
            ...(!rawEmail ? { email: "Email is required." } : {}),
            ...(!rawOtp ? { otp: "OTP is required." } : {}),
          },
        },
        { status: 422 }
      );
    }

    const normalizedEmail = normalizeEmail(rawEmail);

    // Verify OTP against stored hash
    const result = verifyPasswordResetOtp(normalizedEmail, rawOtp);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message || "Invalid or expired OTP.",
        },
        { status: result.status || 422 }
      );
    }

    // OTP verified successfully!
    return NextResponse.json(
      {
        success: true,
        message: "OTP verified successfully.",
        data: null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Verify Reset OTP API] Error:", error?.message);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify reset OTP. Please try again.",
      },
      { status: 500 }
    );
  }
}
