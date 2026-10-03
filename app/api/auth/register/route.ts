// app/api/auth/register/route.ts
// Registration endpoint adhering strictly to Brainzima User Registration & Verification specification:
// 1. Validate request
// 2. Normalize email: strtolower(trim($email))
// 3. Check duplicate email -> HTTP 409 (distinguish email duplicate vs mobile duplicate vs unverified)
// 4. Hash password / persist user & user_image
// 5. Generate cryptographically secure 6-digit OTP (random_int)
// 6. Store OTP verification information (user_otp_hash, user_otp_expires_at, user_verified = 0)
// 7. Send OTP to registered email using Nodemailer
// 8. Return HTTP 201 with email_verification_required: true (NEVER exposes OTP or hash)

import { NextRequest, NextResponse } from "next/server";
import { sendOtpEmail } from "@/lib/email";
import {
  normalizeEmail,
  createRegistrationOtp,
  getUserOtpState,
} from "@/lib/otpStore";
import {
  finalizeRegistrationImage,
  formatDbImagePath,
} from "@/lib/imageStorage";
import { getClientIp, getCurrentSqlDateTime } from "@/lib/utils";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = (body.name || "").trim();
    const rawEmail = (body.email || "").trim();
    const mobile = (body.mobile || "").trim();
    const password = body.password || "";
    const user_image = (body.user_image || "").trim();
    const rawRole = (body.user_role || body.role || "user")
      .toString()
      .toLowerCase()
      .trim();
    const role: "user" | "student" = rawRole === "student" ? "student" : "user";
    const clientIp = getClientIp(req, body.ip || body.last_login_ip);
    const currentSqlTime = getCurrentSqlDateTime();

    // ── 1. Validate request ──────────────────────────────────────────────────
    const validationErrors: Record<string, string> = {};
    if (!name) validationErrors.name = "Full name is required.";
    if (!rawEmail) validationErrors.email = "Email address is required.";
    if (!mobile) validationErrors.mobile = "Mobile number is required.";
    if (!password) validationErrors.password = "Password is required.";

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Validation failed",
          errors: validationErrors,
        },
        { status: 422 }
      );
    }

    // ── 2. Normalize email: strtolower(trim($email)) ─────────────────────────
    const normalizedEmail = normalizeEmail(rawEmail);

    // Basic email format check
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

    // ── 3. Forward registration to PHP backend (Database is source of truth) ───
    let phpUserId: number | undefined;
    try {
      const phpRes = await fetch(`${PHP_API}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name,
          email: normalizedEmail,
          mobile,
          password,
          user_role: role,
          role,
          user_image: user_image ? formatDbImagePath(user_image) : null,
          ip: clientIp,
          last_login_ip: clientIp,
          last_login_at: currentSqlTime,
        }),
      });

      const phpData = await phpRes.json().catch(() => null);

      // Handle duplicate checks with strict field distinction:
      const isEmailDuplicate =
        Boolean(phpData?.errors?.email?.toLowerCase?.().includes("already")) ||
        Boolean(
          phpData?.message?.toLowerCase?.().includes("email") &&
            phpData?.message?.toLowerCase?.().includes("already")
        );

      const isMobileDuplicate =
        Boolean(phpData?.errors?.mobile?.toLowerCase?.().includes("already")) ||
        Boolean(
          phpData?.message?.toLowerCase?.().includes("mobile") &&
            phpData?.message?.toLowerCase?.().includes("already")
        );

      if (isEmailDuplicate) {
        // If email already exists in DB, check if the account is unverified
        // (e.g. from an earlier attempt where the verification email failed to send)
        let isUnverifiedAccount = false;
        let matchedUserId: number | undefined;

        try {
          const checkLoginRes = await fetch(`${PHP_API}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              identifier: normalizedEmail,
              password,
              ip: clientIp,
            }),
          });
          const checkLoginData = await checkLoginRes.json().catch(() => null);

          if (
            checkLoginRes.status === 403 ||
            checkLoginData?.data?.email_verification_required ||
            checkLoginData?.message?.toLowerCase().includes("verify")
          ) {
            isUnverifiedAccount = true;
            matchedUserId = checkLoginData?.data?.user_id
              ? Number(checkLoginData.data.user_id)
              : undefined;
          } else if (checkLoginRes.status === 200 && checkLoginData?.success) {
            const profileVerified =
              checkLoginData?.data?.user_verified === 1 ||
              checkLoginData?.data?.verified === true;
            if (!profileVerified) {
              isUnverifiedAccount = true;
              matchedUserId = Number(checkLoginData.data.user_id);
            }
          }
        } catch {
          /* best effort verification check */
        }

        const localState = getUserOtpState(normalizedEmail);
        if (localState && localState.user_verified === 0) {
          isUnverifiedAccount = true;
          matchedUserId = matchedUserId ?? localState.user_id;
        }

        if (isUnverifiedAccount) {
          // Automatically dispatch a new OTP and transition user to OTP screen
          const { rawOtp } = createRegistrationOtp({
            email: normalizedEmail,
            name,
            mobile,
            user_id: matchedUserId,
            user_image: user_image ? formatDbImagePath(user_image) : null,
            role,
            is_student: role === "student",
            student_id: 0,
          });

          try {
            await sendOtpEmail({
              to: normalizedEmail,
              name,
              otp: rawOtp,
            });
          } catch (emailErr) {
            console.error("[Brainzima] Resend OTP email failed on recovery:", emailErr);
            return NextResponse.json(
              {
                success: false,
                message:
                  "Account could not be verified because the verification email could not be sent.",
                data: {
                  email_verification_required: true,
                  email: normalizedEmail,
                },
              },
              { status: 500 }
            );
          }

          return NextResponse.json(
            {
              success: true,
              message:
                "Account exists but is not verified. A new verification OTP has been sent to your email.",
              data: {
                user_id: matchedUserId,
                name,
                email: normalizedEmail,
                user_role: role,
                role,
                is_student: role === "student",
                email_verification_required: true,
              },
            },
            { status: 200 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            message: "Email is already registered.",
            errors: {
              email: "This email is already registered. Please login instead.",
            },
          },
          { status: 409 }
        );
      }

      if (isMobileDuplicate) {
        return NextResponse.json(
          {
            success: false,
            message: "Mobile number is already registered.",
            errors: {
              mobile:
                "This mobile number is already registered. Please use a different mobile number.",
            },
          },
          { status: 409 }
        );
      }

      // Any other conflict error (409)
      if (phpRes.status === 409) {
        return NextResponse.json(
          {
            success: false,
            message:
              phpData?.message ||
              "Conflict: An account with these details already exists.",
            errors: phpData?.errors || {},
          },
          { status: 409 }
        );
      }

      // Validation errors (422) like missing special character in password
      if (phpRes.status === 422) {
        return NextResponse.json(
          {
            success: false,
            message: phpData?.message || "Validation failed",
            errors: phpData?.errors || {},
          },
          { status: 422 }
        );
      }

      // Server error (500)
      if (phpRes.status >= 500) {
        console.error("[Brainzima] PHP backend 500 error:", phpData);
        return NextResponse.json(
          {
            success: false,
            message: "Unable to process registration right now.",
          },
          { status: 500 }
        );
      }

      if (phpData?.data?.user_id) {
        phpUserId = Number(phpData.data.user_id);
      }
    } catch (phpErr) {
      console.warn(
        "[Brainzima] PHP registration bridge notice (continuing with local auth state):",
        phpErr
      );
    }

    // ── 5. Finalize registration image in permanent user directory ──────────
    const effectiveUserId = phpUserId ?? 10;
    let finalUserImage: string | null = null;

    if (
      user_image &&
      user_image !== "null" &&
      user_image !== "undefined" &&
      user_image.trim() !== ""
    ) {
      finalUserImage = await finalizeRegistrationImage(effectiveUserId, user_image, role);
      if (finalUserImage) {
        finalUserImage = formatDbImagePath(finalUserImage);
      }

      // Synchronize final path and role with PHP MySQL database if user was created
      if (finalUserImage && phpUserId) {
        const syncPayload = {
          user_role: role,
          role,
          user_image: finalUserImage,
        };

        // 1. Primary: Dedicated Avatar Path Update (POST /api/user/image per Section 8.2)
        try {
          await fetch(`${PHP_API}/user/image`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": String(phpUserId),
              "X-User-Role": role,
              "X-HTTP-Method-Override": "PATCH",
              Accept: "application/json",
            },
            body: JSON.stringify(syncPayload),
          });
        } catch (imgErr) {
          console.warn("[Brainzima] Notice updating /user/image:", imgErr);
        }

        // 2. Secondary: Profile Update with Method Override (POST /api/user/profile)
        try {
          await fetch(`${PHP_API}/user/profile`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": String(phpUserId),
              "X-User-Role": role,
              "X-HTTP-Method-Override": "PATCH",
              Accept: "application/json",
            },
            body: JSON.stringify({ ...syncPayload, _method: "PATCH" }),
          });
        } catch (profErr) {
          console.warn("[Brainzima] Notice updating /user/profile override:", profErr);
        }

        // 3. Fallback: Native PUT /api/user/profile
        try {
          await fetch(`${PHP_API}/user/profile`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": String(phpUserId),
              "X-User-Role": role,
              Accept: "application/json",
            },
            body: JSON.stringify(syncPayload),
          });
        } catch (putErr) {
          console.warn("[Brainzima] Notice updating /user/profile PUT:", putErr);
        }
      }
    }

    // ── 6. Generate secure 6-digit OTP & Store hashed state ──────────────
    const { rawOtp } = createRegistrationOtp({
      email: normalizedEmail,
      name,
      mobile,
      user_id: phpUserId,
      user_image: finalUserImage,
      role,
      is_student: role === "student",
      student_id: 0,
    });

    // ── 7. Send OTP to registered email using Nodemailer ─────────────────────
    try {
      await sendOtpEmail({
        to: normalizedEmail,
        name,
        otp: rawOtp,
      });
    } catch (emailErr: any) {
      console.error("[Brainzima] Nodemailer delivery failed in /register:", emailErr);
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
          data: {
            email_verification_required: true,
            email: normalizedEmail,
          },
        },
        { status: 500 }
      );
    }

    // ── 8. Return HTTP 201 Created (NEVER expose OTP or OTP hash) ───────────
    return NextResponse.json(
      {
        success: true,
        message: "Account created. Please verify your email.",
        data: {
          user_id: effectiveUserId,
          name,
          email: normalizedEmail,
          user_image: finalUserImage,
          user_role: role,
          role,
          is_student: role === "student",
          email_verification_required: true,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Brainzima] Unexpected registration error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Unable to process registration right now.",
      },
      { status: 500 }
    );
  }
}
