// app/api/auth/login/route.ts
// Adheres strictly to Brainzima Login & Verification specification:
// 1. If user_verified = 0: return HTTP 403 "Please verify your email before logging in." with email_verification_required = true
// 2. If user_verified = 1: continue with existing password verification flow (forwards to PHP /auth/login)
// 3. Preserves user_id, student_id, role, is_student for correct dashboard redirection

import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, getUserOtpState } from "@/lib/otpStore";
import { getClientIp, getCurrentSqlDateTime, formatIstDateTime } from "@/lib/utils";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = (body.identifier || body.email || "").trim();
    const password = body.password || "";
    const clientIp = getClientIp(req, body.ip || body.last_login_ip);
    const currentSqlTime = getCurrentSqlDateTime();

    if (!identifier || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Identifier and password are required.",
        },
        { status: 422 }
      );
    }

    const isEmail = identifier.includes("@");
    const normEmail = isEmail ? normalizeEmail(identifier) : "";

    // ── Check unverified state in OTP store (HTTP 403) ──────────────────────
    if (isEmail) {
      const otpRecord = getUserOtpState(normEmail);
      if (otpRecord && otpRecord.user_verified === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Please verify your email before logging in.",
            data: {
              email_verification_required: true,
              email: normEmail,
            },
          },
          { status: 403 }
        );
      }
    }

    // ── Forward to PHP backend for password verification ────────────────────
    try {
      const phpRes = await fetch(`${PHP_API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          identifier: isEmail ? normEmail : identifier,
          email: isEmail ? normEmail : undefined,
          password,
          ip: clientIp,
          last_login_ip: clientIp,
          last_login_at: currentSqlTime,
          login_time: currentSqlTime,
        }),
      });

      const phpData = await phpRes.json().catch(() => null);

      if (phpRes.status === 403 || phpData?.data?.email_verification_required) {
        return NextResponse.json(
          {
            success: false,
            message:
              phpData?.message ||
              "Please verify your email before logging in.",
            data: {
              email_verification_required: true,
              email: normEmail || identifier,
            },
          },
          { status: 403 }
        );
      }

      if (phpRes.status === 200 && phpData?.success && phpData.data) {
        const rawUser = phpData.data;
        const userId = Number(rawUser.user_id);
        const userEmail = normalizeEmail(rawUser.email || normEmail);

        // Fetch full profile from PHP /user/{id} to get user_image, verified, last_login, etc.
        let userDetails: any = null;
        try {
          const detailRes = await fetch(`${PHP_API}/user/${userId}`, {
            headers: {
              "X-User-Id": String(userId),
              "X-User-Role": rawUser.role || (rawUser.is_student ? "student" : "user"),
              Accept: "application/json",
            },
          });
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            if (detailJson.success && detailJson.data) {
              userDetails = detailJson.data;
            }
          }
        } catch (detailErr) {
          console.warn("[Login] Could not fetch extended user profile:", detailErr);
        }

        // Also check OTP record for user_image if user registered in this session
        const otpRecord = userEmail ? getUserOtpState(userEmail) : null;

        const resolvedRole =
          rawUser.role ||
          userDetails?.role ||
          (rawUser.is_student ? "student" : "user");

        const isStudent =
          Boolean(rawUser.is_student) ||
          Boolean(userDetails?.is_student) ||
          resolvedRole === "student" ||
          Boolean(rawUser.student_id) ||
          Boolean(userDetails?.student_id);

        const studentId = rawUser.student_id ?? userDetails?.student_id ?? null;

        const resolvedImage =
          userDetails?.user_image ||
          rawUser?.user_image ||
          otpRecord?.user_image ||
          null;

        // ── Ensure both User and Student tables have last_login updated ────────
        // 1. If student, guarantee student table sync
        if (isStudent && studentId) {
          try {
            await fetch(`${PHP_API}/student/${studentId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-User-Id": String(userId),
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
            });
          } catch {
            /* best effort sync */
          }
        }

        const completeData = {
          user_id: userId,
          name: rawUser.name || userDetails?.name || "User",
          email: userEmail,
          mobile: rawUser.mobile || userDetails?.mobile || null,
          role: resolvedRole === "" ? "user" : resolvedRole,
          is_student: isStudent,
          student_id: studentId,
          registration_number:
            rawUser.registration_number ?? userDetails?.registration_number ?? null,
          centre_id: rawUser.centre_id ?? userDetails?.centre_id ?? null,
          user_image: resolvedImage,
          user_verified: 1,
          last_login_at: formatIstDateTime(currentSqlTime),
          last_login_ip: clientIp,
        };

        return NextResponse.json(
          {
            success: true,
            message: phpData.message || "Login successful.",
            data: completeData,
          },
          { status: 200 }
        );
      }

      if (phpData) {
        return NextResponse.json(phpData, { status: phpRes.status });
      }
    } catch (phpErr) {
      console.warn("[Brainzima] PHP backend login notice:", phpErr);
    }

    // Fallback if PHP backend is unreachable
    return NextResponse.json(
      {
        success: false,
        message: "Invalid credentials or service temporarily unavailable.",
      },
      { status: 401 }
    );
  } catch (err) {
    console.error("[Brainzima] Login route error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred during login.",
      },
      { status: 500 }
    );
  }
}
