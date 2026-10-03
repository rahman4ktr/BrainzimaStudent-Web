// app/api/auth/verify-smtp/route.ts
// Diagnostic endpoint to test and verify SMTP email delivery in production
// Usage:
// GET /api/auth/verify-smtp -> Tests SMTP connectivity and returns diagnostic state
// POST /api/auth/verify-smtp -> Sends a test email to a specified recipient (admin only)

import { NextRequest, NextResponse } from "next/server";
import { verifySmtpConnection, sendOtpEmail } from "@/lib/email";

export async function GET() {
  try {
    const result = await verifySmtpConnection();
    const status = result.success ? 200 : 500;
    return NextResponse.json(result, { status });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to run SMTP diagnostics.",
        error: {
          code: err?.code,
          message: err?.message,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const testTo = body.to || process.env.SMTP_USER || process.env.GMAIL_USER;

    if (!testTo) {
      return NextResponse.json(
        {
          success: false,
          message: "Please specify a 'to' email address in JSON body to test delivery.",
        },
        { status: 422 }
      );
    }

    await sendOtpEmail({
      to: testTo,
      name: "Test Recipient",
      otp: "123456",
    });

    return NextResponse.json({
      success: true,
      message: `Test verification email sent successfully to ${testTo}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to dispatch test email.",
        error: {
          code: err?.code,
          responseCode: err?.responseCode,
          response: err?.response,
          message: err?.message,
        },
      },
      { status: 500 }
    );
  }
}
