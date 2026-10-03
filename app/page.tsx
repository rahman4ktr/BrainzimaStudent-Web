"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  UserRound,
  UserPlus,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  BadgeCheck,
  BarChart3,
  CreditCard,
  KeyRound,
  HelpCircle,
  Building2,
  Mail,
  Phone,
  BookOpen,
  ChevronDown,
  LoaderCircle,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  loginUser,
  registerUser,
  uploadUserImage,
  forgotPassword,
  verifyOtp,
  resendOtp,
  getCourses,
  type Course,
} from "@/lib/api";
import { saveSession, getSession, getRedirectPath } from "@/lib/session";
import { useToast } from "@/components/ui/toast";

// ── Mode types ──────────────────────────────────────────────────────────────
type AuthMode = "login" | "register" | "forgot" | "otp";

// ── Client-side email masking (te****@gmail.com) ─────────────────────────────
function maskEmailDisplay(email: string): string {
  const normalized = (email || "").trim().toLowerCase();
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return normalized;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}****@${domain}`;
}

// ── Format countdown seconds as MM:SS (e.g. 09:42) ───────────────────────────
function formatTimerSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// ── Error display component ─────────────────────────────────────────────────
function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#EF4444] text-xs flex items-start gap-2"
      role="alert"
    >
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="flex-1 font-medium">{message}</span>
    </motion.div>
  );
}

// ── Success display component ───────────────────────────────────────────────
function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#08A66A] text-xs flex items-start gap-2"
    >
      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="flex-1 font-medium">{message}</span>
    </motion.div>
  );
}

export default function RootLoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Redirect if already logged in
  useEffect(() => {
    const session = getSession();
    if (session) {
      const redirectPath = getRedirectPath(session);
      router.replace(redirectPath);
    }
  }, [router]);

  // ── Auth mode ────────────────────────────────────────────────────────────
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  // ── Shared UI state ──────────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Login form ───────────────────────────────────────────────────────────
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // ── Register form ─────────────────────────────────────────────────────────
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("adca");
  const [courseList, setCourseList] = useState<Course[]>([]);
  const [regEmailError, setRegEmailError] = useState<string | null>(null);
  const [userImageFile, setUserImageFile] = useState<File | null>(null);
  const [userImagePreview, setUserImagePreview] = useState<string | null>(null);

  // ── Fetch dynamic courses for registration dropdown ────────────────────────
  useEffect(() => {
    let active = true;
    getCourses()
      .then((res) => {
        if (active && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setCourseList(res.data);
          setSelectedCourse((prev) => {
            // Keep current if already selected from the list, else select first
            const exists = res.data?.some(
              (c) => c.course_code.toLowerCase() === prev.toLowerCase()
            );
            return exists ? prev : (res.data ? res.data[0].course_code.toLowerCase() : "adca");
          });
        }
      })
      .catch((err) => {
        console.error("[Registration] Failed to load courses:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // ── Forgot password form ─────────────────────────────────────────────────
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // ── OTP Verification state ───────────────────────────────────────────────
  const [otpEmail, setOtpEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpTimerSeconds, setOtpTimerSeconds] = useState(600); // 10 minutes
  const [resendCooldown, setResendCooldown] = useState(60); // 60 seconds
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState("");
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // ── 10-minute validity timer & 60-second cooldown interval ────────────────
  useEffect(() => {
    if (authMode !== "otp") return;

    const interval = setInterval(() => {
      setOtpTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [authMode]);

  // Focus the first OTP input when opening OTP mode
  useEffect(() => {
    if (authMode === "otp") {
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 150);
    }
  }, [authMode]);

  // ── Helper to switch mode ────────────────────────────────────────────────
  function switchMode(mode: AuthMode) {
    setAuthMode(mode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setRegEmailError(null);
    setOtpError(null);
    setShowPassword(false);
  }

  // ── LOGIN HANDLER ─────────────────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!identifier.trim()) {
      setErrorMessage("Please enter your Registration No., Email, or Mobile.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginUser(identifier.trim(), password);

      // ── Handle unverified account (HTTP 403) ─────────────────────────────
      if (res._status === 403 || res.data?.email_verification_required) {
        const unverifiedEmail =
          res.data?.email ||
          (identifier.includes("@") ? identifier.trim().toLowerCase() : "");

        setOtpEmail(unverifiedEmail);
        setPendingPassword(password);
        setOtpDigits(["", "", "", "", "", ""]);
        setOtpTimerSeconds(600);
        setResendCooldown(60);
        setAuthMode("otp");

        toast({
          variant: "error",
          title: "Email Verification Required",
          description: "Please verify your email before logging in.",
          duration: 6000,
        });

        // Proactively send a new OTP if email is known
        if (unverifiedEmail) {
          resendOtp(unverifiedEmail).catch(() => { });
        }
        return;
      }

      if (!res.success || !res.data) {
        setErrorMessage(
          res.message || "Invalid credentials. Please check and try again."
        );
        return;
      }

      // Save session
      saveSession(res.data);

      // Post-login redirect: is_student takes priority over role
      const redirectPath = getRedirectPath(res.data);
      router.push(redirectPath);
    } catch {
      setErrorMessage("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── REGISTER HANDLER ──────────────────────────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setRegEmailError(null);

    // Frontend validation
    if (
      !regName.trim() ||
      !regEmail.trim() ||
      !regMobile.trim() ||
      !regPassword
    ) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    // Normalize email (trim + lowercase)
    const normalizedEmail = regEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setRegEmailError("Please enter a valid email address.");
      return;
    }
    if (!/^\d{10}$/.test(regMobile.trim())) {
      setErrorMessage("Mobile number must be exactly 10 digits.");
      return;
    }
    if (regPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(regPassword)) {
      setErrorMessage(
        "Password must contain at least one uppercase letter (A-Z)."
      );
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(regPassword)) {
      setErrorMessage(
        "Password must contain at least one special character (e.g. @, #, $, !)."
      );
      return;
    }

    setIsLoading(true);
    try {
      // 1. Upload profile image if selected by user
      let userImagePath: string | undefined = undefined;
      if (userImageFile) {
        try {
          const uploadRes = await uploadUserImage(userImageFile, undefined, undefined, "user", false);
          if (uploadRes.success && (uploadRes.user_image || uploadRes.db_path)) {
            userImagePath = uploadRes.user_image || uploadRes.db_path;
          }
        } catch (uploadErr) {
          console.warn("[Registration] User image upload failed:", uploadErr);
        }
      }

      const res = await registerUser(
        regName.trim(),
        normalizedEmail,
        regMobile.trim(),
        regPassword,
        userImagePath
      );

      if (!res.success) {
        // ── Step 8: Handle unverified existing account ────────────────────
        if (
          res.data?.email_verification_required ||
          res.message?.toLowerCase().includes("not verified")
        ) {
          toast({
            variant: "info",
            title: "Account Exists (Not Verified)",
            description:
              res.message ||
              "An account with this email already exists but is not verified. Please verify your email to complete admission.",
            duration: 8000,
            action: {
              label: "Verify Email",
              onClick: () => {
                setOtpEmail(normalizedEmail);
                setPendingPassword(regPassword);
                setOtpDigits(["", "", "", "", "", ""]);
                setOtpTimerSeconds(600);
                setResendCooldown(60);
                setAuthMode("otp");
              },
            },
          });
          setErrorMessage("Please complete email verification for this account.");
          return;
        }

        // ── Step 9 & 16: Genuine duplicate email check (409 Conflict) ────
        const isDuplicateEmail =
          res._status === 409 &&
          (Boolean(res.errors?.email?.toLowerCase().includes("already")) ||
            Boolean(
              res.message?.toLowerCase().includes("email") &&
              res.message?.toLowerCase().includes("already")
            ));

        if (isDuplicateEmail) {
          setRegEmailError("This email is already registered. Please login instead.");

          toast({
            variant: "error",
            title: "Email Already Registered",
            description:
              "This email is already registered. Please login with your existing account.",
            duration: 8000,
            action: {
              label: "Go to Login",
              onClick: () => {
                setIdentifier(normalizedEmail);
                switchMode("login");
              },
            },
          });
          return;
        }

        // ── Check duplicate mobile number (Do NOT show Email Already Registered)
        const isDuplicateMobile =
          res._status === 409 &&
          (Boolean(res.errors?.mobile?.toLowerCase().includes("already")) ||
            Boolean(
              res.message?.toLowerCase().includes("mobile") &&
              res.message?.toLowerCase().includes("already")
            ));

        if (isDuplicateMobile) {
          setErrorMessage(
            res.errors?.mobile ||
            "This mobile number is already registered. Please use another mobile number."
          );
          return;
        }

        // ── Field-specific validation errors (422) ────────────────────────
        if (res.errors && Object.keys(res.errors).length > 0) {
          if (res.errors.email) {
            setRegEmailError(res.errors.email);
          }
          if (res.errors.mobile) {
            setErrorMessage(res.errors.mobile);
          } else if (res.errors.password) {
            setErrorMessage(res.errors.password);
          } else if (res.errors.name) {
            setErrorMessage(res.errors.name);
          } else if (!res.errors.email) {
            const firstMsg = Object.values(res.errors)[0];
            setErrorMessage(firstMsg);
          }
          return;
        }

        // ── Generic or 500 server error ──────────────────────────────────
        setErrorMessage(
          res.message || "Unable to process registration right now. Please try again."
        );
        return;
      }

      // ── Registration Success (201) ── Transition to OTP Verification ────
      setOtpEmail(normalizedEmail);
      setPendingPassword(regPassword);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpTimerSeconds(600);
      setResendCooldown(60);
      setAuthMode("otp");

      toast({
        variant: "success",
        title: "Account Created",
        description: `We've sent a 6-digit verification code to ${normalizedEmail}`,
        duration: 6000,
      });
    } catch {
      setErrorMessage("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP VERIFICATION HANDLER ──────────────────────────────────────────────
  const handleVerifyOtpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOtpError(null);

    const otpCode = otpDigits.join("");
    if (otpCode.length !== 6) {
      setOtpError("Please enter all 6 digits of the OTP.");
      return;
    }

    if (otpTimerSeconds <= 0) {
      setOtpError("OTP has expired. Please click Resend OTP to get a new code.");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await verifyOtp(otpEmail, otpCode);

      if (!res.success) {
        setOtpError(res.message || "Invalid or expired OTP.");
        toast({
          variant: "error",
          title: "Verification Failed",
          description: res.message || "Invalid or expired OTP.",
          duration: 5000,
        });
        return;
      }

      // ── Email Verified Successfully ──
      toast({
        variant: "success",
        title: "Email Verified",
        description: "Email verified successfully.",
        duration: 4000,
      });

      // If user session data was returned from verify-otp
      if (res.data?.user) {
        saveSession(res.data.user);
        const redirectPath = getRedirectPath(res.data.user);
        router.push(redirectPath);
        return;
      }

      // If we have preserved user password from registration or login attempt, auto-login
      if (pendingPassword) {
        const loginRes = await loginUser(otpEmail, pendingPassword);
        if (loginRes.success && loginRes.data) {
          saveSession(loginRes.data);
          const redirectPath = getRedirectPath(loginRes.data);
          router.push(redirectPath);
          return;
        }
      }

      // Fallback: return to login screen with verified message
      setIdentifier(otpEmail);
      switchMode("login");
      setSuccessMessage("Email verified successfully! Sign in to access your portal.");
    } catch {
      setOtpError("Network error. Please check your connection and try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // ── RESEND OTP HANDLER ────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResendingOtp) return;
    setIsResendingOtp(true);
    setOtpError(null);

    try {
      const res = await resendOtp(otpEmail);

      if (!res.success) {
        if (res._status === 429) {
          const waitSecs = res.data?.wait_seconds ?? 60;
          setResendCooldown(waitSecs);
          setOtpError(
            res.message || "Please wait before requesting another OTP."
          );
          toast({
            variant: "error",
            title: "Rate Limited",
            description:
              res.message || "Please wait before requesting another OTP.",
          });
          return;
        }

        setOtpError(res.message || "Failed to resend OTP.");
        return;
      }

      // Reset timers and clear inputs
      setResendCooldown(60);
      setOtpTimerSeconds(600); // 10 minutes renewed
      setOtpDigits(["", "", "", "", "", ""]);
      otpInputsRef.current[0]?.focus();

      toast({
        variant: "success",
        title: "New OTP Sent",
        description: "A new OTP has been sent to your email.",
        duration: 5000,
      });
    } catch {
      setOtpError("Network error. Could not resend OTP.");
    } finally {
      setIsResendingOtp(false);
    }
  };

  // ── OTP INPUT CHANGE / KEYDOWN / PASTE HANDLERS ────────────────────────────
  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);
    if (otpError) setOtpError(null);

    // If entered a digit, move focus to next input
    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleVerifyOtpSubmit();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text");
    const digitsOnly = paste.replace(/\D/g, "").slice(0, 6);
    if (!digitsOnly) return;

    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = digitsOnly[i] || "";
    }
    setOtpDigits(updated);
    if (otpError) setOtpError(null);

    // Focus on the next empty or last filled box
    const nextIndex = Math.min(digitsOnly.length, 5);
    otpInputsRef.current[nextIndex]?.focus();
  };

  // ── FORGOT PASSWORD HANDLER ───────────────────────────────────────────────
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!forgotEmail.trim()) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(forgotEmail.trim());
      setForgotSent(true);
    } catch {
      setErrorMessage("Network error. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <main className="min-h-screen w-full bg-[#F8FAFC] text-[#111827] flex flex-col justify-between p-3 sm:p-5 md:p-8 lg:p-10 relative overflow-x-hidden font-sans">
      {/* Ambient decorative orbs */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-40 -left-40 w-96 h-96 rounded-full bg-[#5B21F4]/8 blur-3xl hidden md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed top-1/2 -right-40 w-96 h-96 rounded-full bg-[#08A66A]/8 blur-3xl hidden md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-40 left-1/3 w-96 h-96 rounded-full bg-[#2563EB]/8 blur-3xl hidden md:block"
      />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* MAIN CARD                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div className="w-full max-w-[1200px] min-h-[660px] lg:min-h-[700px] mx-auto my-auto bg-white rounded-2xl md:rounded-[24px] border border-[#E2E8F0] shadow-xl md:shadow-2xl md:shadow-slate-900/5 overflow-hidden flex flex-col lg:flex-row relative z-10">
        {/* ── LEFT: Branding column ─────────────────────────────────────── */}
        <div className="w-full lg:w-[44%] lg:basis-[44%] bg-gradient-to-br from-[#FAF9FF] via-[#F4F6FF] to-[#ECFDF5] p-5 sm:p-7 md:p-9 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#E2E8F0] relative shrink-0">
          <div
            className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[radial-gradient(#111827_1px,transparent_1px)] [background-size:16px_16px]"
            aria-hidden
          />

          <div className="relative z-10">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2.5 mb-5"
            >
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-md shadow-[#5B21F4]/20 shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)",
                }}
              >
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#111827] leading-none">
                  Brainzima
                </h1>
                <span className="text-[10px] sm:text-[11px] font-bold tracking-widest text-[#5B21F4] uppercase">
                  Student Portal
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mb-3.5 inline-block"
            >
              <Badge
                variant="blue"
                className="text-[11px] sm:text-xs py-1 px-3"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Official Academic Portal
              </Badge>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-extrabold tracking-tight text-[#111827] leading-[1.2]"
            >
              Welcome to Your{" "}
              <span
                className="bg-clip-text text-transparent inline-block"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #5B21F4 0%, #7C3AED 50%, #2563EB 100%)",
                }}
              >
                Learning Portal
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mt-2.5 sm:mt-3 text-[#475569] text-xs sm:text-sm md:text-[15px] leading-relaxed"
            >
              Access your enrolled courses, notes, attendance, fee receipts, and
              academic records in one place.
            </motion.p>
          </div>

          {/* Feature cards */}
          <div className="my-5 sm:my-6 space-y-2.5 relative z-10">
            {[
              {
                icon: BadgeCheck,
                title: "Verified Certificate & ID Card",
                sub: "Get digitally verified credentials",
                color: "#08A66A",
                bg: "#ECFDF5",
                border: "#D1FAE5",
              },
              {
                icon: BarChart3,
                title: "Biometric Attendance Tracking",
                sub: "Secure and real-time attendance logs",
                color: "#2563EB",
                bg: "#EFF6FF",
                border: "#DBEAFE",
              },
              {
                icon: CreditCard,
                title: "Instant Verified Fee Receipts",
                sub: "Download receipts anytime, anywhere",
                color: "#F59E0B",
                bg: "#FFFBEB",
                border: "#FEF3C7",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.2 + i * 0.06 }}
                whileHover={{ x: 3 }}
                className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-white/80 backdrop-blur-sm border border-white shadow-sm"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: f.bg,
                    borderColor: f.border,
                    color: f.color,
                  }}
                >
                  <f.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-bold text-[#111827] truncate">
                    {f.title}
                  </h3>
                  <p className="text-[11px] text-[#475569] truncate">{f.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Floating student count */}
          <div className="hidden lg:flex items-center justify-center relative py-2">
            <motion.div
              animate={{ y: [-3, 3, -3] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-white/60 border border-[#E2E8F0] shadow-sm"
            >
              <div className="flex -space-x-2">
                {["5K+", "25+", "✓"].map((v, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full text-white flex items-center justify-center text-[10px] font-bold ring-2 ring-white"
                    style={{
                      backgroundColor: ["#5B21F4", "#08A66A", "#2563EB"][i],
                    }}
                  >
                    {v}
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-[#475569]">
                <span className="font-bold text-[#111827]">5,000+ Students</span>{" "}
                learning at Brainzima
              </div>
            </motion.div>
          </div>

          {/* Bottom sign-off */}
          <div className="relative z-10 pt-3 border-t border-[#E2E8F0]/70 flex items-center justify-between text-[11px] text-[#64748B]">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#5B21F4] shrink-0" />
              <span className="truncate">
                Official Academic Portal • Brainzima
              </span>
            </div>
            <span className="hidden sm:inline text-[#08A66A] font-semibold">
              ISO Certified
            </span>
          </div>
        </div>

        {/* ── RIGHT: Auth forms ─────────────────────────────────────────── */}
        <div className="w-full lg:w-[56%] lg:basis-[56%] bg-white p-5 sm:p-7 md:p-9 lg:p-10 flex flex-col justify-between">
          <div className="w-full">
            {/* Form Header */}
            <div className="mb-5 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
                {authMode === "login" && "Sign In to Portal"}
                {authMode === "register" && "Create New Account"}
                {authMode === "forgot" && "Reset Your Password"}
                {authMode === "otp" && "Verify Your Email"}
              </h2>
              <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                {authMode === "login" &&
                  "Enter your credentials to access your dashboard"}
                {authMode === "register" &&
                  "Register to get started — verify email to complete admission"}
                {authMode === "forgot" &&
                  "Enter your registered email to receive reset instructions"}
                {authMode === "otp" &&
                  "Enter the 6-digit verification code sent to your email"}
              </p>
            </div>

            {/* Error / Success Banners */}
            <FormError message={errorMessage} />
            <FormSuccess message={successMessage} />

            {/* ── Tab Switcher (Visible only on Login / Register) ── */}
            {authMode !== "forgot" && authMode !== "otp" && (
              <div
                role="tablist"
                aria-label="Portal Mode"
                className="grid grid-cols-2 gap-2 sm:gap-3 mb-5 p-1 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0]"
              >
                {[
                  {
                    mode: "login" as AuthMode,
                    icon: GraduationCap,
                    label: "Student / User Login",
                    sub: "Sign in to account",
                    activeColor: "#08A66A",
                    activeBorder: "#08A66A",
                  },
                  {
                    mode: "register" as AuthMode,
                    icon: UserPlus,
                    label: "New Admission",
                    sub: "Apply for course",
                    activeColor: "#5B21F4",
                    activeBorder: "#5B21F4",
                  },
                ].map((tab) => {
                  const active = authMode === tab.mode;
                  return (
                    <button
                      key={tab.mode}
                      type="button"
                      role="tab"
                      id={`tab-${tab.mode}`}
                      aria-selected={active}
                      onClick={() => switchMode(tab.mode)}
                      className={`flex items-center gap-2 sm:gap-2.5 p-2.5 sm:p-3 rounded-xl text-left transition-all min-h-[48px] select-none cursor-pointer ${active
                          ? "bg-white shadow-sm"
                          : "border border-transparent text-[#64748B] hover:text-[#111827] hover:bg-slate-100/60"
                        }`}
                      style={
                        active ? { border: `2px solid ${tab.activeBorder}` } : {}
                      }
                    >
                      <div
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                        style={
                          active
                            ? {
                              backgroundColor: tab.activeColor + "18",
                              color: tab.activeColor,
                            }
                            : { backgroundColor: "#F1F5F9", color: "#94A3B8" }
                        }
                      >
                        <tab.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-xs sm:text-sm font-bold leading-tight flex items-center gap-1.5 truncate"
                          style={active ? { color: "#111827" } : {}}
                        >
                          {tab.label}
                          {active && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: tab.activeColor }}
                            />
                          )}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-[#64748B] truncate mt-0.5">
                          {tab.sub}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/* FORMS                                                       */}
            {/* ══════════════════════════════════════════════════════════ */}
            <AnimatePresence mode="wait">
              {/* ── LOGIN FORM ─────────────────────────────────────────── */}
              {authMode === "login" && (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  onSubmit={handleLoginSubmit}
                  className="space-y-4"
                  noValidate
                >
                  {/* Identifier */}
                  <div className="space-y-1.5">
                    <Label htmlFor="login-identifier" required>
                      Registration No. / Email / Mobile
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                        <UserRound className="w-4 h-4" />
                      </div>
                      <Input
                        id="login-identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. BISR0001 or student@brainzima.com"
                        className="pl-10 h-12 text-xs sm:text-sm"
                        autoComplete="username"
                        required
                      />
                    </div>
                    <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                      <Info className="w-3 h-3 text-[#94A3B8] shrink-0" />
                      Enter your BISR ID, registered email, or 10-digit mobile
                      number.
                    </p>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password" required>
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => switchMode("forgot")}
                        className="text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline focus-visible:outline-none cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                        <LockKeyhole className="w-4 h-4" />
                      </div>
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="pl-10 pr-11 h-12 text-xs sm:text-sm"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#475569] cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Login CTA */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-[50px] sm:h-[52px] rounded-xl text-white font-bold text-sm sm:text-base flex items-center justify-between px-5 shadow-lg shadow-[#08A66A]/20 hover:shadow-xl hover:shadow-[#08A66A]/25 active:scale-[0.99] transition-all cursor-pointer border-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #08A66A 0%, #059669 100%)",
                      }}
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2 w-full">
                          <LoaderCircle className="w-5 h-5 animate-spin" />
                          <span>Signing in...</span>
                        </div>
                      ) : (
                        <>
                          <span className="mx-auto pl-6 font-extrabold tracking-wide">
                            Enter Portal
                          </span>
                          <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </>
                      )}
                    </Button>
                  </div>


                  {/* OR + Forgot button */}
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#E2E8F0]" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-[#94A3B8] font-bold text-[10px] tracking-wider">
                        OR
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#F1EEFF] hover:bg-[#E9E4FF] border border-[#DDD6FE] text-[#5B21F4] font-bold text-xs flex items-center justify-center gap-2 transition-colors min-h-[44px] cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Forgot password? Reset with Email →
                  </button>
                </motion.form>
              )}

              {/* ── REGISTER FORM ──────────────────────────────────────── */}
              {authMode === "register" && (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  onSubmit={handleRegisterSubmit}
                  className="space-y-3.5"
                  noValidate
                >
                  {/* Full Name */}
                  <div className="space-y-1">
                    <Label htmlFor="reg-name" required>
                      Full Name
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                        <UserRound className="w-4 h-4" />
                      </div>
                      <Input
                        id="reg-name"
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Ajit Kumar"
                        className="pl-10 h-11 text-xs sm:text-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Email + Mobile grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Email with inline error state */}
                    <div className="space-y-1">
                      <Label htmlFor="reg-email" required>
                        Email Address
                      </Label>
                      <div className="relative">
                        <div
                          className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none ${regEmailError ? "text-[#EF4444]" : "text-[#94A3B8]"
                            }`}
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <Input
                          id="reg-email"
                          type="email"
                          value={regEmail}
                          onChange={(e) => {
                            setRegEmail(e.target.value);
                            if (regEmailError) setRegEmailError(null);
                          }}
                          placeholder="student@example.com"
                          className="pl-9 h-11 text-xs"
                          hasError={!!regEmailError}
                          aria-invalid={!!regEmailError}
                          aria-describedby={
                            regEmailError ? "reg-email-error" : undefined
                          }
                          required
                        />
                      </div>
                      {/* Inline field-level error */}
                      {regEmailError && (
                        <motion.p
                          id="reg-email-error"
                          role="alert"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-[#EF4444] mt-1"
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {regEmailError}
                          {regEmailError.toLowerCase().includes("registered") && (
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIdentifier(regEmail.trim().toLowerCase());
                                  switchMode("login");
                                }}
                                className="underline text-[#5B21F4] hover:text-[#4C1BD4] font-bold cursor-pointer whitespace-nowrap"
                              >
                                Login instead →
                              </button>
                              <span className="text-[#94A3B8]">•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setForgotEmail(regEmail.trim().toLowerCase());
                                  switchMode("forgot");
                                }}
                                className="underline text-[#5B21F4] hover:text-[#4C1BD4] font-semibold cursor-pointer whitespace-nowrap"
                              >
                                Reset password
                              </button>
                            </div>
                          )}
                        </motion.p>
                      )}
                    </div>

                    {/* Mobile */}
                    <div className="space-y-1">
                      <Label htmlFor="reg-mobile" required>
                        Mobile Number
                      </Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <Input
                          id="reg-mobile"
                          type="tel"
                          value={regMobile}
                          onChange={(e) => setRegMobile(e.target.value)}
                          placeholder="9876543210"
                          className="pl-9 h-11 text-xs"
                          maxLength={10}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Course Selection */}
                  <div className="space-y-1">
                    <Label htmlFor="reg-course" required>
                      Interested Course
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <select
                        id="reg-course"
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        className="w-full h-11 pl-10 pr-9 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#111827] focus:bg-white focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/15 transition-all appearance-none cursor-pointer"
                      >
                        {courseList.length > 0 ? (
                          courseList.map((course) => (
                            <option
                              key={course.course_id}
                              value={course.course_code.toLowerCase()}
                            >
                              {course.course_name} ({course.course_duration} )
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="adca">
                              Advanced Diploma in Computer Applications (12 Months • ₹8,000)
                            </option>
                            <option value="dwd">
                              Diploma in Web Development (10 Months • ₹40,000)
                            </option>
                            <option value="mern">
                              MERN Stack Development (9 Months • ₹45,000)
                            </option>
                            <option value="java">
                              Java Full Stack Development (10 Months • ₹42,000)
                            </option>
                            <option value="cyber">
                              Cyber Security Fundamentals (8 Months • ₹35,000)
                            </option>
                          </>
                        )}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <Label htmlFor="reg-password" required>
                      Create Password
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                        <LockKeyhole className="w-4 h-4" />
                      </div>
                      <Input
                        id="reg-password"
                        type={showPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="e.g. Student@123"
                        className="pl-10 pr-11 h-11 text-xs sm:text-sm"
                        required
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide" : "Show"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#475569] cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {/* Live Password Rules Indicator */}
                    <div className="pt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#64748B]">
                      <span
                        className={`flex items-center gap-1 ${regPassword.length >= 8
                            ? "text-emerald-600 font-bold"
                            : ""
                          }`}
                      >
                        {regPassword.length >= 8 ? "✓" : "•"} 8+ chars
                      </span>
                      <span
                        className={`flex items-center gap-1 ${/[A-Z]/.test(regPassword)
                            ? "text-emerald-600 font-bold"
                            : ""
                          }`}
                      >
                        {/[A-Z]/.test(regPassword) ? "✓" : "•"} 1 Uppercase (A-Z)
                      </span>
                      <span
                        className={`flex items-center gap-1 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(regPassword)
                            ? "text-emerald-600 font-bold"
                            : ""
                          }`}
                      >
                        {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(regPassword)
                          ? "✓"
                          : "•"}{" "}
                        1 Special char (!@#$)
                      </span>
                    </div>
                  </div>

                  {/* Profile Photo (PNG) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reg-image">
                        Profile Photo (PNG / Image)
                      </Label>
                      {userImageFile && (
                        <span className="text-[11px] text-[#5B21F4] font-semibold truncate max-w-[180px]">
                          {userImageFile.name}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <input
                        id="reg-image"
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUserImageFile(file);
                            setUserImagePreview(URL.createObjectURL(file));
                          } else {
                            setUserImageFile(null);
                            setUserImagePreview(null);
                          }
                        }}
                        className="w-full h-11 pl-10 pr-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#475569] file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#F1EEFF] file:text-[#5B21F4] hover:file:bg-[#DDD6FE] focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/15 transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Info notice */}
                  <div className="p-2.5 rounded-xl bg-[#F1EEFF] border border-[#DDD6FE] text-[#5B21F4] text-[11px] flex items-start gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      After submitting, a 6-digit verification code will be sent
                      to your email.
                    </span>
                  </div>

                  {/* Submit */}
                  <div className="pt-1">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-[50px] sm:h-[52px] rounded-xl text-white font-bold text-sm sm:text-base flex items-center justify-between px-5 shadow-lg shadow-[#5B21F4]/20 hover:shadow-xl active:scale-[0.99] transition-all cursor-pointer border-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)",
                      }}
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2 w-full">
                          <LoaderCircle className="w-5 h-5 animate-spin" />
                          <span>Creating Account &amp; Sending OTP...</span>
                        </div>
                      ) : (
                        <>
                          <span className="mx-auto pl-6 font-extrabold tracking-wide">
                            Apply for New Admission
                          </span>
                          <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                            <ArrowRight className="w-4 h-4" />
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </motion.form>
              )}

              {/* ── OTP VERIFICATION FORM ──────────────────────────────── */}
              {authMode === "otp" && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-5"
                >
                  {/* OTP Header Card */}
                  <div className="p-4 rounded-2xl bg-[#F5F3FF] border border-[#DDD6FE] text-center space-y-1.5">
                    <div className="w-10 h-10 rounded-full bg-[#EDE9FE] text-[#5B21F4] flex items-center justify-center mx-auto mb-1">
                      <Mail className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-extrabold text-[#111827]">
                      Verify your email
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      We sent a 6-digit verification code to:
                    </p>
                    <p className="text-sm font-black text-[#5B21F4] tracking-wide font-mono">
                      {otpEmail}
                    </p>
                    <button
                      type="button"
                      onClick={() => switchMode("register")}
                      className="text-[11px] text-[#5B21F4] hover:underline font-semibold cursor-pointer block mx-auto pt-0.5"
                    >
                      Wrong email? Edit details
                    </button>
                  </div>

                  {/* Spam Folder Advisory */}
                  <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2 text-left">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      <strong>Can&apos;t find the email?</strong> Please check your <strong>Spam</strong>, <strong>Junk</strong>, or <strong>Promotions</strong> folder. The OTP code is valid for 10 minutes.
                    </span>
                  </div>

                  {/* Inline OTP Error */}
                  {otpError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#EF4444] text-xs flex items-start gap-2"
                      role="alert"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="flex-1 font-medium">{otpError}</span>
                    </motion.div>
                  )}

                  {/* 6 Digit Input Boxes */}
                  <form onSubmit={handleVerifyOtpSubmit} className="space-y-5">
                    <div className="flex justify-center items-center gap-2 sm:gap-3">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => {
                            otpInputsRef.current[idx] = el;
                          }}
                          id={`otp-digit-${idx}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={digit}
                          onChange={(e) =>
                            handleOtpDigitChange(idx, e.target.value)
                          }
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          aria-label={`Digit ${idx + 1} of verification code`}
                          className={`w-11 h-14 sm:w-13 sm:h-16 text-center text-xl sm:text-2xl font-black font-mono rounded-xl sm:rounded-2xl border-2 transition-all outline-none ${digit
                              ? "border-[#5B21F4] bg-[#FAF9FF] text-[#5B21F4] shadow-sm shadow-[#5B21F4]/10"
                              : "border-[#E2E8F0] bg-white text-[#111827] focus:border-[#5B21F4] focus:ring-4 focus:ring-[#5B21F4]/10"
                            }`}
                        />
                      ))}
                    </div>

                    {/* Timer: 09:42 */}
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#64748B]">
                      <Clock
                        className={`w-3.5 h-3.5 ${otpTimerSeconds < 60
                            ? "text-[#EF4444] animate-pulse"
                            : "text-[#5B21F4]"
                          }`}
                      />
                      <span>Code expires in:</span>
                      <span
                        className={`font-mono font-bold ${otpTimerSeconds < 60
                            ? "text-[#EF4444]"
                            : "text-[#111827]"
                          }`}
                      >
                        {formatTimerSeconds(otpTimerSeconds)}
                      </span>
                    </div>

                    {/* Primary: Verify Email CTA */}
                    <Button
                      type="submit"
                      disabled={isVerifyingOtp}
                      className="w-full h-[50px] sm:h-[52px] rounded-xl text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#5B21F4]/20 hover:shadow-xl active:scale-[0.99] transition-all cursor-pointer border-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)",
                      }}
                    >
                      {isVerifyingOtp ? (
                        <>
                          <LoaderCircle className="w-5 h-5 animate-spin" />
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Verify Email</span>
                        </>
                      )}
                    </Button>

                    {/* Secondary: Resend OTP (Disabled until 60s cooldown completes) */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || isResendingOtp}
                        onClick={handleResendOtp}
                        className={`text-xs font-bold flex items-center gap-1.5 py-1 px-2 rounded-lg transition-colors cursor-pointer ${resendCooldown > 0 || isResendingOtp
                            ? "text-[#94A3B8] cursor-not-allowed bg-slate-50"
                            : "text-[#5B21F4] hover:text-[#4314B5] hover:bg-[#F5F3FF]"
                          }`}
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isResendingOtp ? "animate-spin" : ""
                            }`}
                        />
                        {resendCooldown > 0
                          ? `Resend OTP (${resendCooldown}s)`
                          : isResendingOtp
                            ? "Sending..."
                            : "Resend OTP"}
                      </button>

                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className="text-xs font-medium text-[#64748B] hover:text-[#111827] hover:underline cursor-pointer"
                      >
                        ← Back to Sign In
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ── FORGOT PASSWORD FORM ───────────────────────────────── */}
              {authMode === "forgot" && (
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  {forgotSent ? (
                    <div className="p-5 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] text-center space-y-3">
                      <CheckCircle2 className="w-10 h-10 text-[#08A66A] mx-auto" />
                      <h4 className="text-sm font-bold text-[#111827]">
                        Reset Instructions Sent
                      </h4>
                      <p className="text-xs text-[#475569]">
                        If an account exists for{" "}
                        <span className="font-semibold text-[#111827]">
                          {forgotEmail}
                        </span>
                        , password reset instructions have been sent. Check your
                        inbox.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          switchMode("login");
                          setForgotSent(false);
                          setForgotEmail("");
                        }}
                        className="w-full text-xs font-bold mt-2"
                      >
                        ← Return to Sign In
                      </Button>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleForgotSubmit}
                      className="space-y-4"
                      noValidate
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="forgot-email" required>
                          Registered Email Address
                        </Label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                            <Mail className="w-4 h-4" />
                          </div>
                          <Input
                            id="forgot-email"
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="e.g. student@brainzima.com"
                            className="pl-10 h-12 text-xs sm:text-sm"
                            required
                          />
                        </div>
                        <p className="text-[11px] text-[#64748B]">
                          Enter the email address linked to your account. Reset
                          instructions will be sent to this email.
                        </p>
                      </div>

                      <div className="pt-1">
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="w-full h-12 rounded-xl text-white font-bold text-sm bg-[#2563EB] hover:bg-[#1D4ED8] shadow-md shadow-[#2563EB]/20 cursor-pointer"
                        >
                          {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                              <LoaderCircle className="w-4 h-4 animate-spin" />
                              <span>Sending Instructions...</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <span>Send Password Reset Instructions</span>
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          )}
                        </Button>
                      </div>

                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className="w-full py-2.5 text-xs font-bold text-[#475569] hover:text-[#111827] text-center cursor-pointer block"
                      >
                        ← Back to Sign In
                      </button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Card footer toggle */}
          <div className="mt-6 pt-4 border-t border-[#E2E8F0] text-center">
            {authMode === "login" ? (
              <p className="text-xs text-[#475569]">
                Not registered yet?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="font-bold text-[#5B21F4] hover:underline cursor-pointer"
                >
                  Apply for New Admission →
                </button>
              </p>
            ) : authMode === "register" ? (
              <p className="text-xs text-[#475569]">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-bold text-[#08A66A] hover:underline cursor-pointer"
                >
                  Sign in to Portal →
                </button>
              </p>
            ) : authMode === "otp" ? (
              <p className="text-xs text-[#475569]">
                Already verified?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-bold text-[#08A66A] hover:underline cursor-pointer"
                >
                  Sign in to Portal →
                </button>
              </p>
            ) : (
              <p className="text-xs text-[#475569]">
                Remembered your password?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-bold text-[#08A66A] hover:underline cursor-pointer"
                >
                  Sign in →
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Page Footer */}
      <footer className="w-full max-w-[1200px] mx-auto mt-4 pt-2 text-center text-xs text-[#64748B] flex flex-col sm:flex-row items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-[#5B21F4]" />
          <span>Official Academic Portal • Brainzima Institute</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] sm:text-xs">
          <a
            href="mailto:support@brainzima.com"
            className="hover:text-[#111827] hover:underline flex items-center gap-1 text-[#2563EB]"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Need help? Contact Support</span>
          </a>
          <span className="text-[#CBD5E1]">|</span>
          <span className="text-[#94A3B8]">v3.0 Secured</span>
        </div>
      </footer>
    </main>
  );
}
