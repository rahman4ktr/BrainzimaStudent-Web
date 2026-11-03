// app/api/auth/forgot-password/route.ts
// Handles Forgot Password requests for normal Users and enrolled Students.
// Strictly adheres to requirements:
// 1. Checks whether the email belongs to a normal User OR a Student
// 2. If email does not exist: HTTP 404 with "Email not found." (no OTP sent, no account created)
// 3. If email exists: generates 6-digit OTP, stores expiry, and dispatches email via EmailHelper
// 4. Returns: { success: true, message: "OTP sent successfully.", data: null }

import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetOtpEmail } from "@/lib/email";
import {
  normalizeEmail,
  createPasswordResetRequest,
} from "@/lib/passwordResetStore";
import { getUserOtpState } from "@/lib/otpStore";

const PHP_API =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.brainzima.com/student/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = (body.email || "").trim();

    if (!rawEmail) {
      return NextResponse.json(
        {
          success: false,
          message: "Email address is required.",
          errors: { email: "Please enter your registered email address." },
        },
        { status: 422 }
      );
    }

    const normalizedEmail = normalizeEmail(rawEmail);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: { email: "Please enter a valid email address." },
        },
        { status: 422 }
      );
    }

    // ── STEP 1: CHECK WHETHER EMAIL BELONGS TO USER OR STUDENT ───────────────
    // Query database users/students without creating any new account
    let matchedAccount: {
      name: string;
      user_id?: number;
      student_id?: number | null;
      is_student: boolean;
      role: string;
    } | null = null;

    // A. Check database via PHP REST API
    try {
      const searchRes = await fetch(
        `${PHP_API}/user?search=${encodeURIComponent(normalizedEmail)}`,
        {
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
      const searchData = await searchRes.json().catch(() => null);

      if (searchRes.ok && searchData?.data?.users && Array.isArray(searchData.data.users)) {
        const exactUser = searchData.data.users.find(
          (u: any) => (u.email || "").trim().toLowerCase() === normalizedEmail
        );
        if (exactUser) {
          const isStudent = Boolean(
            exactUser.is_student ||
              exactUser.role === "student" ||
              exactUser.student_id
          );
          matchedAccount = {
            name: exactUser.name || "Student",
            user_id: exactUser.user_id ? Number(exactUser.user_id) : undefined,
            student_id: exactUser.student_id ? Number(exactUser.student_id) : null,
            is_student: isStudent,
            role: exactUser.role || (isStudent ? "student" : "user"),
          };
        }
      }
    } catch (err: any) {
      console.warn("[Forgot Password] PHP DB user search notice:", err?.message);
    }

    // B. Check local store if not found yet
    if (!matchedAccount) {
      const localUser = getUserOtpState(normalizedEmail);
      if (localUser) {
        const isStudent = Boolean(localUser.is_student || localUser.role === "student");
        matchedAccount = {
          name: localUser.name || "Student",
          user_id: localUser.user_id,
          student_id: localUser.student_id ?? null,
          is_student: isStudent,
          role: localUser.role || (isStudent ? "student" : "user"),
        };
      }
    }

    // C. If email does NOT exist: Return HTTP 404 "Email not found."
    if (!matchedAccount) {
      return NextResponse.json(
        {
          success: false,
          message: "Email not found.",
        },
        { status: 404 }
      );
    }

    // ── STEP 2: GENERATE AND STORE OTP ───────────────────────────────────────
    const resetReq = createPasswordResetRequest({
      email: normalizedEmail,
      name: matchedAccount.name,
      user_id: matchedAccount.user_id,
      student_id: matchedAccount.student_id,
      is_student: matchedAccount.is_student,
      role: matchedAccount.role,
    });

    if (!resetReq.rawOtp) {
      return NextResponse.json(
        {
          success: false,
          message: "Unable to process password reset request at this time.",
        },
        { status: 500 }
      );
    }

    // ── STEP 3: SEND OTP VIA SERVER-SIDE EmailHelper ──────────────────────────
    try {
      await sendPasswordResetOtpEmail({
        to: normalizedEmail,
        name: matchedAccount.name,
        otp: resetReq.rawOtp,
      });
    } catch (emailErr: any) {
      console.error("[Forgot Password] Email dispatch failed:", emailErr?.message);
      return NextResponse.json(
        {
          success: false,
          message: "Unable to deliver password reset email. Please try again later.",
        },
        { status: 500 }
      );
    }

    // ── STEP 4: SUCCESS RESPONSE ─────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        message: "OTP sent successfully.",
        data: null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Forgot Password API] Error:", error?.message);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 }
    );
  }
}
