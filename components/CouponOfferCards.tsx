"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  Sparkles,
  Percent,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Loader2,
  X,
  Check,
  Gift,
  Copy,
  PartyPopper,
  ArrowRight,
  Ticket,
  PercentCircle,
} from "lucide-react";
import {
  getOfflineCoupons,
  getOnlineCoupons,
  validateOfflineCoupon,
  validateOnlineCoupon,
  type CouponItem,
  type CouponValidationData,
  type ValidateCouponPayload,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fireCouponConfetti } from "@/lib/confetti";

export interface CouponOfferCardsProps {
  /** Strict separation: "offline" for classroom courses, "online" for LMS courses */
  courseType: "offline" | "online";
  /** Currently selected or active course ID */
  courseId?: number;
  /** Actual course fee to ensure mathematically accurate percentage discounts */
  courseFee?: number;
  /** Authenticated user details to verify eligibility for restricted coupons */
  currentUser?: {
    user_id?: number | null;
    email?: string | null;
    mobile?: string | null;
    role?: string | null;
  } | null;
  /** Currently applied coupon */
  appliedCoupon: CouponValidationData | null;
  /** Callback when coupon is successfully applied */
  onApplySuccess: (data: CouponValidationData) => void;
  /** Callback when applied coupon is removed */
  onRemoveCoupon: () => void;
  /** Optional container CSS class */
  className?: string;
}

export function CouponOfferCards({
  courseType,
  courseId,
  courseFee,
  currentUser,
  appliedCoupon,
  onApplySuccess,
  onRemoveCoupon,
  className = "",
}: CouponOfferCardsProps) {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState<boolean>(true);
  const [manualCode, setManualCode] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validatingCode, setValidatingCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Reference to prevent stale responses from applying to switched course
  const activeCourseIdRef = React.useRef<number | undefined>(courseId);
  useEffect(() => {
    activeCourseIdRef.current = courseId;
  }, [courseId]);

  // ── 1. Fetch Eligible Coupon Cards ─────────────────────────────────────────
  const fetchCoupons = useCallback(async () => {
    setIsLoadingCoupons(true);

    try {
      const uId = currentUser?.user_id ?? undefined;
      const uRole = (currentUser?.role || undefined) as any;

      // Strict separation: call the correct API endpoint
      const res =
        courseType === "offline"
          ? await getOfflineCoupons(
              {
                status: "active",
                course_id: courseId,
                user_id: uId,
              },
              uId,
              uRole
            )
          : await getOnlineCoupons(
              {
                status: "active",
                course_id: courseId,
                user_id: uId,
              },
              uId,
              uRole
            );

      if (res.success && Array.isArray(res.data)) {
        setCoupons(res.data);
      } else {
        setCoupons([]);
      }
    } catch {
      setCoupons([]);
    } finally {
      setIsLoadingCoupons(false);
    }
  }, [courseType, courseId, currentUser?.user_id, currentUser?.role]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // ── 2. Filter Eligible Coupons for Current User & Course ──────────────────
  const eligibleCoupons = useMemo(() => {
    if (!coupons || coupons.length === 0) return [];

    const currentUserIdNum = currentUser?.user_id ? Number(currentUser.user_id) : 0;
    const currentUserEmail = (currentUser?.email || "").toLowerCase().trim();
    const currentUserMobile = (currentUser?.mobile || "").trim();

    return coupons.filter((coupon) => {
      // 1. Expiry check
      if (coupon.coupon_expired === 1 || coupon.coupon_expired === true) {
        return false;
      }
      if (coupon.coupon_validity) {
        const expiryDate = new Date(coupon.coupon_validity);
        if (!isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now()) {
          return false;
        }
      }

      // 2. Course restriction check
      if (coupon.coupon_for_course === "specific" && coupon.coupon_for_course_id) {
        if (courseId && Number(coupon.coupon_for_course_id) !== Number(courseId)) {
          return false;
        }
      }

      // 3. User restriction check
      if (coupon.coupon_for === "user_id" && coupon.coupon_for_user_id) {
        if (!currentUserIdNum || Number(coupon.coupon_for_user_id) !== currentUserIdNum) {
          return false;
        }
      }

      // 4. Email restriction check
      if (coupon.coupon_for_email) {
        const reqEmail = coupon.coupon_for_email.toLowerCase().trim();
        if (currentUserEmail && reqEmail !== currentUserEmail) {
          return false;
        }
      }

      // 5. Mobile restriction check
      if (coupon.coupon_for_mobile) {
        const reqMobile = coupon.coupon_for_mobile.trim();
        if (currentUserMobile && reqMobile !== currentUserMobile) {
          return false;
        }
      }

      return true;
    });
  }, [coupons, courseId, currentUser]);

  // ── 3. Apply Coupon Handler with Confetti ──────────────────────────────────
  const handleApply = async (codeToApply: string) => {
    const cleanCode = codeToApply.trim().toUpperCase();
    if (!cleanCode) {
      setErrorMsg("Please enter or select a promo code.");
      return;
    }

    if (!courseId) {
      setErrorMsg("Please select a course first.");
      return;
    }

    const currentCourse = courseId;
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsValidating(true);
    setValidatingCode(cleanCode);

    try {
      const payload: ValidateCouponPayload = {
        coupon_code: cleanCode,
        course_id: currentCourse,
        course_fee: courseFee,
        base_amount: courseFee,
        user_id: currentUser?.user_id ?? undefined,
        email: currentUser?.email ?? undefined,
        mobile: currentUser?.mobile ?? undefined,
      };

      const callerUserId = currentUser?.user_id ?? undefined;
      const callerRole = (currentUser?.role || undefined) as any;

      // Strict separation: call the correct validation API
      const res =
        courseType === "offline"
          ? await validateOfflineCoupon(payload, callerUserId, callerRole)
          : await validateOnlineCoupon(payload, callerUserId, callerRole);

      // Guard against race conditions if user switched courses while request was pending
      if (activeCourseIdRef.current !== currentCourse) {
        return;
      }

      if (!res.success || !res.data || !res.data.is_valid) {
        const msg =
          res.message ||
          (res.errors && Object.values(res.errors)[0]) ||
          "Invalid or inapplicable promo code.";
        setErrorMsg(msg);
        return;
      }

      const verified = { ...res.data };

      // Mathematical accuracy safeguard: recalculate percentage discount against actual courseFee
      if (courseFee && courseFee > 0 && verified.discount_type === "percentage") {
        const expectedDiscount = Math.round(
          (courseFee * Number(verified.discount_value)) / 100
        );
        if (expectedDiscount > 0) {
          verified.base_amount = courseFee;
          verified.discount_amount = expectedDiscount;
          verified.net_payable = Math.max(0, courseFee - expectedDiscount);
        }
      }

      const discountAmount = Number(verified.discount_amount) || 0;

      if (discountAmount <= 0) {
        setErrorMsg("This coupon does not provide any discount for this course.");
        return;
      }

      // Apply verified coupon to parent state
      onApplySuccess(verified);
      setSuccessMsg(
        `Coupon "${verified.coupon_code}" applied! You saved ₹${discountAmount.toLocaleString("en-IN")}.`
      );
      setManualCode("");

      // ── Trigger Festive Confetti Blast! ──
      fireCouponConfetti();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to validate coupon code.");
    } finally {
      setIsValidating(false);
      setValidatingCode(null);
    }
  };

  const handleRemove = () => {
    onRemoveCoupon();
    setSuccessMsg(null);
    setErrorMsg(null);
    setManualCode("");
  };

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const formatExpiry = (valStr?: string) => {
    if (!valStr) return null;
    const d = new Date(valStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-[#5B21F4]/10 flex items-center justify-center text-[#5B21F4]">
            <Ticket className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-[#0F172A]">
            {courseType === "offline"
              ? "Offers & Discount Coupons"
              : "Offers & Discount Coupons"}
          </span>
        </div>
      </div>

      {/* ── Applied Coupon Banner (Celebration State) ── */}
      <AnimatePresence mode="wait">
        {appliedCoupon && (
          <motion.div
            key="applied-coupon-banner"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-emerald-100/30 p-3.5 shadow-sm space-y-2.5"
          >
            {/* Top row: Status pill + Remove button */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                <PartyPopper className="w-3.5 h-3.5 text-emerald-600" />
                <span>Coupon Applied</span>
              </span>
              <button
                type="button"
                onClick={handleRemove}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-100/70 bg-white/90 border border-rose-200 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>

            {/* Code & Savings summary */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-xl border border-dashed border-emerald-400 font-mono font-black text-sm text-emerald-950 shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="tracking-wider">{appliedCoupon.coupon_code}</span>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-white/90 border border-emerald-300 px-2.5 py-1 rounded-lg shadow-2xs">
                -₹{Number(appliedCoupon.discount_amount || 0).toLocaleString("en-IN")} OFF
              </span>
            </div>

            <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
              {successMsg ||
                `Coupon "${appliedCoupon.coupon_code}" is active. You saved ₹${Number(
                  appliedCoupon.discount_amount || 0
                ).toLocaleString("en-IN")} on this order.`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Manual Code Input Box ── */}
      {!appliedCoupon && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0 group">
              <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#5B21F4] transition-colors pointer-events-none" />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value.toUpperCase());
                  if (errorMsg) setErrorMsg(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApply(manualCode);
                  }
                }}
                placeholder="ENTER PROMO CODE"
                disabled={isValidating}
                className="w-full h-9.5 pl-9 pr-7 text-xs font-mono font-bold uppercase tracking-wider bg-slate-50/80 border border-slate-200 rounded-xl focus:outline-none focus:border-[#5B21F4] focus:ring-2 focus:ring-[#5B21F4]/20 focus:bg-white placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 transition-all"
              />
              {manualCode && (
                <button
                  type="button"
                  onClick={() => setManualCode("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Button
              type="button"
              onClick={() => handleApply(manualCode)}
              disabled={isValidating || !manualCode.trim()}
              className="h-9.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white shrink-0 shadow-sm shadow-[#5B21F4]/20 disabled:opacity-50 transition-all active:scale-95"
            >
              {isValidating && validatingCode === manualCode.trim().toUpperCase() ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying</span>
                </div>
              ) : (
                "Apply"
              )}
            </Button>
          </div>

          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-2 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-[11px] font-medium flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span className="leading-tight">{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Available Coupon Offer Cards Section ── */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Available Offers</span>
          </span>
          {eligibleCoupons.length > 0 && (
            <span className="text-[10px] font-extrabold bg-[#5B21F4]/10 text-[#5B21F4] px-2 py-0.5 rounded-full border border-[#5B21F4]/20">
              {eligibleCoupons.length} {eligibleCoupons.length === 1 ? "Offer Available" : "Offers Available"}
            </span>
          )}
        </div>

        {/* Loading Skeletons */}
        {isLoadingCoupons && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 animate-pulse space-y-2.5"
              >
                <div className="flex justify-between items-center">
                  <div className="h-5 bg-slate-200 rounded-lg w-24" />
                  <div className="h-5 bg-slate-200 rounded-full w-16" />
                </div>
                <div className="h-3 bg-slate-200 rounded w-40" />
                <div className="h-7 bg-slate-200 rounded-xl w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoadingCoupons && eligibleCoupons.length === 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1">
            <Gift className="w-5 h-5 text-slate-400 mx-auto" />
            <p className="text-[11px] font-semibold text-slate-600">
              No active offers found for this {courseType} course right now.
            </p>
            <p className="text-[10px] text-slate-400">
              Have a promotional voucher code? Type it in the box above to apply.
            </p>
          </div>
        )}

        {/* Coupon Offer Cards (Full-width ticket cards for spacious sidebar view) */}
        {!isLoadingCoupons && eligibleCoupons.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {eligibleCoupons.map((coupon) => {
              const isApplied =
                appliedCoupon?.coupon_code?.toUpperCase() ===
                coupon.coupon_code.toUpperCase();
              const discountDisplay =
                coupon.coupon_discount_type === "percentage"
                  ? `${Number(coupon.coupon_discount)}% OFF`
                  : `₹${Number(coupon.coupon_discount).toLocaleString("en-IN")} OFF`;
              const expiryFormatted = formatExpiry(coupon.coupon_validity);
              const isSpecificCourse = coupon.coupon_for_course === "specific";
              const isUserRestricted = coupon.coupon_for === "user_id";

              return (
                <div
                  key={coupon.coupon_id}
                  className={`relative rounded-2xl border transition-all overflow-hidden p-3.5 flex flex-col gap-2.5 ${
                    isApplied
                      ? "bg-gradient-to-r from-emerald-50/90 to-teal-50/40 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm"
                      : "bg-white hover:bg-slate-50/70 border-slate-200 hover:border-[#5B21F4]/40 hover:shadow-sm"
                  }`}
                >
                  {/* Card Top: Code & Discount Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 px-2 py-0.5 rounded-lg transition-colors group/copy">
                        <span className="font-mono font-black text-xs text-slate-900 tracking-wider">
                          {coupon.coupon_code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(coupon.coupon_code)}
                          title="Copy Code"
                          className="text-slate-400 hover:text-[#5B21F4] transition-colors p-0.5"
                        >
                          {copiedCode === coupon.coupon_code ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {copiedCode === coupon.coupon_code && (
                        <span className="text-[10px] font-bold text-emerald-600 animate-fade-in">
                          Copied!
                        </span>
                      )}

                      {isUserRestricted && (
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Exclusive
                        </span>
                      )}
                    </div>

                    <Badge className="bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs border-0">
                      {discountDisplay}
                    </Badge>
                  </div>

                  {/* Card Middle: Description & Expiry */}
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <p className="font-medium text-slate-700">
                      {isSpecificCourse
                        ? coupon.target_course_name
                          ? `Valid for: ${coupon.target_course_name}`
                          : "Valid on this specific course"
                        : courseType === "offline"
                        ? "Valid on all offline classroom courses"
                        : "Valid on all online courses"}
                    </p>
                    {expiryFormatted && (
                      <p className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                        <Calendar className="w-3 h-3" />
                        <span>Valid till {expiryFormatted}</span>
                      </p>
                    )}
                  </div>

                  {/* Card Bottom: Dotted separator + Action */}
                  <div className="pt-2 border-t border-dashed border-slate-200 flex items-center justify-between gap-2">
                    {isApplied ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Applied to Fee</span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleRemove}
                          className="h-7 px-3 text-[11px] font-bold border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-300 transition-colors rounded-xl shadow-none"
                        >
                          <X className="w-3 h-3 mr-1" />
                          <span>Remove</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] text-slate-500 font-medium">
                          Instant discount on checkout
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleApply(coupon.coupon_code)}
                          disabled={isValidating}
                          className="h-7 px-3.5 text-[11px] font-bold bg-[#0F172A] hover:bg-[#5B21F4] text-white rounded-xl shadow-none transition-all flex items-center gap-1 active:scale-95"
                        >
                          {isValidating &&
                          validatingCode === coupon.coupon_code.toUpperCase() ? (
                            <div className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Applying</span>
                            </div>
                          ) : (
                            <>
                              <span>Apply Offer</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
