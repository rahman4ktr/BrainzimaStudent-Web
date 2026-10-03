"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Receipt,
  AlertCircle,
  CheckCircle2,
  TrendingDown,
  Building2,
  Clock,
  Sparkles,
  ChevronRight,
  Wallet,
  Loader2,
  X,
  ExternalLink,
  ShieldCheck,
  GraduationCap,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useStudent } from "@/hooks/useStudent";
import {
  getStudentFees,
  getStudentEnrollments,
  getEnrollmentById,
  createFeeInstallmentOrder,
  recordVerifiedFeePayment,
  FeeTransactionItem,
  EnrollmentItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

// ─── Financial Source of Truth Extractors ──────────────────────────────────
// CRITICAL: stc_dues is strictly from backend database (bi_st_course.stc_dues)
export function extractEnrollmentDues(e: any): number {
  if (!e) return 0;
  if (e.stc_dues !== undefined && e.stc_dues !== null && e.stc_dues !== "") {
    const n = Number(e.stc_dues);
    if (!isNaN(n)) return n;
  }
  if (e.dues !== undefined && e.dues !== null && e.dues !== "") {
    const n = Number(e.dues);
    if (!isNaN(n)) return n;
  }
  if (e.remaining_dues !== undefined && e.remaining_dues !== null && e.remaining_dues !== "") {
    const n = Number(e.remaining_dues);
    if (!isNaN(n)) return n;
  }
  if (e.summary?.stc_dues !== undefined && e.summary?.stc_dues !== null && e.summary?.stc_dues !== "") {
    const n = Number(e.summary.stc_dues);
    if (!isNaN(n)) return n;
  }
  if (e.summary?.dues !== undefined && e.summary?.dues !== null && e.summary?.dues !== "") {
    const n = Number(e.summary.dues);
    if (!isNaN(n)) return n;
  }
  return 0;
}

export function extractEnrollmentTotalFee(e: any): number {
  if (!e) return 0;
  if (e.stc_total_fee !== undefined && e.stc_total_fee !== null && e.stc_total_fee !== "") {
    const n = Number(e.stc_total_fee);
    if (!isNaN(n)) return n;
  }
  if (e.total_fee !== undefined && e.total_fee !== null && e.total_fee !== "") {
    const n = Number(e.total_fee);
    if (!isNaN(n)) return n;
  }
  if (e.summary?.total_fee !== undefined && e.summary?.total_fee !== null) {
    const n = Number(e.summary.total_fee);
    if (!isNaN(n)) return n;
  }
  return 0;
}

export function extractEnrollmentDiscount(e: any): number {
  if (!e) return 0;
  if (e.stc_discount !== undefined && e.stc_discount !== null && e.stc_discount !== "") {
    const n = Number(e.stc_discount);
    if (!isNaN(n)) return n;
  }
  if (e.discount !== undefined && e.discount !== null && e.discount !== "") {
    const n = Number(e.discount);
    if (!isNaN(n)) return n;
  }
  if (e.summary?.discount !== undefined && e.summary?.discount !== null) {
    const n = Number(e.summary.discount);
    if (!isNaN(n)) return n;
  }
  return 0;
}

export function extractEnrollmentInitialPayment(e: any): number {
  if (!e) return 0;
  if (e.stc_initial_payment !== undefined && e.stc_initial_payment !== null && e.stc_initial_payment !== "") {
    const n = Number(e.stc_initial_payment);
    if (!isNaN(n)) return n;
  }
  if (e.initial_payment !== undefined && e.initial_payment !== null && e.initial_payment !== "") {
    const n = Number(e.initial_payment);
    if (!isNaN(n)) return n;
  }
  return 0;
}

export function extractEnrollmentTotalPaid(e: any, transactions?: FeeTransactionItem[]): number {
  if (!e) return 0;
  const enrollmentId = Number(e.stc_id ?? e.id);
  if (transactions && transactions.length > 0) {
    const txForCourse = transactions.filter(
      (t) => Number(t.enrollment_id ?? t.tr_stc_id) === enrollmentId
    );
    if (txForCourse.length > 0) {
      return txForCourse.reduce(
        (acc, t) => acc + (Number(t.amount ?? t.tr_amount ?? 0) || 0),
        0
      );
    }
  }
  if (e.total_paid !== undefined && e.total_paid !== null && e.total_paid !== "") {
    const n = Number(e.total_paid);
    if (!isNaN(n)) return n;
  }
  if (e.total_successful_paid !== undefined && e.total_successful_paid !== null && e.total_successful_paid !== "") {
    const n = Number(e.total_successful_paid);
    if (!isNaN(n)) return n;
  }
  if (e.summary?.total_paid !== undefined && e.summary?.total_paid !== null) {
    const n = Number(e.summary.total_paid);
    if (!isNaN(n)) return n;
  }
  const fee = extractEnrollmentTotalFee(e);
  const disc = extractEnrollmentDiscount(e);
  const dues = extractEnrollmentDues(e);
  const init = extractEnrollmentInitialPayment(e);
  return Math.max(init, fee - disc - dues);
}

// ─── Status Code Error Mapping Helper ──────────────────────────────────────
function getHttpErrorMessage(
  status: number | undefined,
  defaultMsg: string,
  backendMsg?: string
): string {
  if (status === 401) return "Session expired. Please login again.";
  if (status === 403) return "You are not authorized to make this payment.";
  if (status === 404) return "Enrollment not found.";
  if (status === 422) return backendMsg || "Validation failed";
  if (status === 409) return backendMsg || "Duplicate payment reference detected. This payment has already been recorded.";
  if (backendMsg && backendMsg.trim() && backendMsg !== "Failed to initialize payment gateway order.") {
    return backendMsg;
  }
  if (status === 500) return defaultMsg || "Payment could not be completed. Please try again.";
  return backendMsg || defaultMsg;
}

export default function StudentFeesPage() {
  const { toast } = useToast();
  const {
    user_id,
    student_id,
    registration_number: sessionRegNo,
    name,
    email,
    mobile,
    isLoading: isStudentLoading,
  } = useStudent();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<FeeTransactionItem[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [summary, setSummary] = useState<{
    totalFee: number;
    discount: number;
    totalPaid: number;
    dues: number;
  }>({
    totalFee: 0,
    discount: 0,
    totalPaid: 0,
    dues: 0,
  });

  // Pay modal state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedStcId, setSelectedStcId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Gateway out-of-sync warning state
  const [gatewaySyncWarning, setGatewaySyncWarning] = useState<{
    paymentId: string;
    message: string;
  } | null>(null);

  // Confirmation state after successful payment
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    transaction_id: number;
    stc_id: number;
    student_id: number;
    course_name: string;
    amount_paid: number;
    payment_mode: string;
    payment_reference: string;
    remaining_dues: number;
    email_sent?: boolean;
    email_recipient?: string;
  } | null>(null);

  // Load Razorpay Checkout SDK dynamically if not already loaded
  useEffect(() => {
    if (typeof window !== "undefined" && !window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // ── Fetch Latest Financial Data from Backend API ───────────────────────────
  // Strictly treats backend stc_dues as single source of truth
  const loadFeeData = useCallback(async () => {
    if (!user_id) return;
    setLoading(true);
    setError(null);

    try {
      const [feeRes, enrRes] = await Promise.allSettled([
        getStudentFees(user_id),
        getStudentEnrollments(user_id),
      ]);

      let enrList: EnrollmentItem[] = [];
      let txList: FeeTransactionItem[] = [];

      // Process Transactions first so we can compute accurate per-course paid sums
      if (feeRes.status === "fulfilled" && feeRes.value.success && feeRes.value.data) {
        if (Array.isArray(feeRes.value.data)) {
          txList = feeRes.value.data;
        } else if (Array.isArray((feeRes.value.data as any).transactions)) {
          txList = (feeRes.value.data as any).transactions;
        }
        setTransactions(txList);
      } else if (feeRes.status === "fulfilled" && !feeRes.value.success) {
        const status = (feeRes.value as any)._status;
        setError(getHttpErrorMessage(status, feeRes.value.message || "Failed to load fee ledger.", feeRes.value.message));
      }

      // Process Enrollments
      if (enrRes.status === "fulfilled" && enrRes.value.success && enrRes.value.data) {
        let rawList: any[] = [];
        if (Array.isArray(enrRes.value.data)) {
          rawList = enrRes.value.data;
        } else if ("enrollments" in enrRes.value.data && Array.isArray((enrRes.value.data as any).enrollments)) {
          rawList = (enrRes.value.data as any).enrollments;
        }

        enrList = rawList.map((e: any) => {
          const dues = extractEnrollmentDues(e);
          const totalFee = extractEnrollmentTotalFee(e);
          const discount = extractEnrollmentDiscount(e);
          const initialPayment = extractEnrollmentInitialPayment(e);
          const totalPaid = extractEnrollmentTotalPaid(e, txList);

          return {
            ...e,
            stc_id: Number(e.stc_id ?? e.id),
            stc_dues: dues,
            dues: dues,
            remaining_dues: dues,
            stc_total_fee: totalFee,
            total_fee: totalFee,
            stc_discount: discount,
            discount: discount,
            stc_initial_payment: initialPayment,
            initial_payment: initialPayment,
            total_paid: totalPaid,
            total_successful_paid: totalPaid,
            course_name: e.course_name || e.crs_name || "Enrolled Course",
            course_code: e.course_code || e.crs_code || "",
            student_id: Number(e.student_id ?? e.stc_st_id ?? e.st_id),
            registration_number: e.registration_number || e.st_regno || sessionRegNo || "",
          };
        });

        setEnrollments(enrList);

        if (enrList.length > 0) {
          // Pre-select first enrollment with dues > 0, otherwise first enrollment
          const firstWithDues = enrList.find((e) => extractEnrollmentDues(e) > 0);
          const autoSelectId = firstWithDues ? firstWithDues.stc_id : enrList[0].stc_id;
          setSelectedStcId((prev) => (prev ? prev : autoSelectId));
        }
      }

      // Calculate aggregated financial summary strictly from backend fields
      const txPaidSum = txList.reduce(
        (acc, t) => acc + (Number(t.amount ?? t.tr_amount ?? 0) || 0),
        0
      );
      const enrDuesSum = enrList.reduce((acc, e) => acc + extractEnrollmentDues(e), 0);
      const enrTotalSum = enrList.reduce((acc, e) => acc + extractEnrollmentTotalFee(e), 0);
      const enrDiscSum = enrList.reduce((acc, e) => acc + extractEnrollmentDiscount(e), 0);
      const enrPaidSum = enrList.reduce((acc, e) => acc + extractEnrollmentTotalPaid(e, txList), 0);

      const totalPaid = txList.length > 0 ? txPaidSum : enrPaidSum;
      const totalDues = enrDuesSum;

      setSummary({
        totalFee: enrTotalSum,
        discount: enrDiscSum,
        totalPaid: totalPaid,
        dues: totalDues,
      });
    } catch {
      setError("Network error while connecting to student financial ledger. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user_id, sessionRegNo]);

  useEffect(() => {
    if (!isStudentLoading && user_id) {
      loadFeeData();
    } else if (!isStudentLoading && !user_id) {
      setLoading(false);
    }
  }, [user_id, isStudentLoading, loadFeeData]);

  // Selected Enrollment for Payment Modal
  const selectedEnrollment =
    enrollments.find((e) => Number(e.stc_id) === Number(selectedStcId)) ||
    enrollments[0];
  const selectedCourseDues = extractEnrollmentDues(selectedEnrollment);

  // Validate amount on input change
  const handleAmountChange = (val: string) => {
    setPayAmount(val);
    if (!val.trim()) {
      setAmountError("Please enter a valid amount greater than ₹0.");
      return;
    }
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setAmountError("Please enter a valid amount greater than ₹0.");
    } else if (num > selectedCourseDues) {
      setAmountError(
        `Payment cannot exceed the remaining dues of ₹${selectedCourseDues.toLocaleString("en-IN")}.`
      );
    } else {
      setAmountError(null);
    }
  };

  // Quick Amount Handlers (25%, 50%, 75%, Pay Full Due)
  const handleQuickAmount = (fraction: number) => {
    if (selectedCourseDues <= 0) return;
    const rawAmt = fraction === 1.0 ? selectedCourseDues : Math.round(selectedCourseDues * fraction);
    const amt = Math.max(1, Math.min(selectedCourseDues, rawAmt));
    setPayAmount(String(amt));
    setAmountError(null);
  };

  // Open modal with specific course
  const openPayModalForCourse = (stcId: number) => {
    setSelectedStcId(stcId);
    const enr = enrollments.find((e) => Number(e.stc_id) === Number(stcId));
    const dues = extractEnrollmentDues(enr);
    setPayAmount(dues > 0 ? String(dues) : "");
    setAmountError(null);
    setIsPayModalOpen(true);
  };

  // ── Core Razorpay Payment Flow ─────────────────────────────────────────────
  // 1. Fetch latest enrollment data
  // 2. Read current stc_dues
  // 3. Student enters payment amount
  // 4. Validate amount against latest dues (never allow amount > stc_dues)
  // 5. Create/open Razorpay checkout using that amount
  // 6. Complete Razorpay payment
  // 7. Obtain the Razorpay payment reference/payment ID
  // 8. Only after successful payment result, call backend POST /api/fee
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user_id || !selectedEnrollment) return;

    const amt = parseFloat(payAmount);

    // Rule 1 & 6: Amount must be > 0 and not empty
    if (isNaN(amt) || amt <= 0) {
      setAmountError("Please enter a valid amount greater than ₹0.");
      return;
    }

    // Rule 2, 4 & 5: Never allow amount > stc_dues; BLOCK PAYMENT
    if (amt > selectedCourseDues) {
      setAmountError(
        `Payment cannot exceed the remaining dues of ₹${selectedCourseDues.toLocaleString("en-IN")}.`
      );
      return;
    }

    // Check Razorpay library presence
    if (typeof window === "undefined" || !window.Razorpay) {
      toast({
        variant: "error",
        title: "Gateway Loading",
        description: "Payment gateway is loading. Please check your connection and try again.",
      });
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Step 1 & 2: Re-fetch latest enrollment to ensure stc_dues has not changed
      const freshEnrRes = await getEnrollmentById(user_id, selectedEnrollment.stc_id);
      if (freshEnrRes.success && freshEnrRes.data) {
        const latestDues = extractEnrollmentDues(freshEnrRes.data);
        if (latestDues <= 0) {
          toast({
            variant: "info",
            title: "Already Cleared",
            description: "No dues remaining for this course.",
          });
          setIsProcessingPayment(false);
          await loadFeeData();
          return;
        }
        if (amt > latestDues) {
          setAmountError(
            `Payment cannot exceed the remaining dues of ₹${latestDues.toLocaleString("en-IN")}.`
          );
          setIsProcessingPayment(false);
          await loadFeeData();
          return;
        }
      }

      // Step 5: Create server-side Razorpay Order using exact validated amount
      const orderRes = await createFeeInstallmentOrder(
        user_id,
        selectedEnrollment.stc_id,
        amt,
        student_id
      );

      if (!orderRes.success || !orderRes.data?.order_id) {
        const status = orderRes._status;
        const stage = (orderRes as any).stage || (status === 0 ? "NETWORK" : "ORDER_CREATE");
        const stageTitle =
          stage === "NETWORK"
            ? "Network Connection Error"
            : stage === "ORDER_CREATE"
            ? "Order Creation Failed"
            : "Payment Gateway Error";

        const msg = getHttpErrorMessage(
          status,
          orderRes.message || "Payment could not be completed. Please try again.",
          orderRes.message
        );
        toast({
          variant: "error",
          title: stageTitle,
          description: msg,
        });
        setIsProcessingPayment(false);
        return;
      }

      const orderData = orderRes.data;

      // Open Razorpay Checkout modal
      const options = {
        key: orderData.key,
        amount: orderData.amount, // in paise
        currency: orderData.currency || "INR",
        name: "Brainzima",
        description: `Fee Installment for ${selectedEnrollment.course_name}`,
        image: "/favicon.ico",
        order_id: orderData.order_id,
        prefill: {
          name: name || "Student",
          email: email || "",
          contact: mobile || "",
        },
        theme: {
          color: "#5B21F4",
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          // Step 8: Only after successful payment result, call POST /api/fee
          try {
            const verifyRes = await recordVerifiedFeePayment(user_id, {
              stc_id: selectedEnrollment.stc_id,
              amount: amt,
              mode: "razorpay",
              payref: response.razorpay_payment_id,
              remark: "Course fee installment payment",
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              student_id: student_id,
            });

            if (verifyRes.success && verifyRes.data) {
              // SUCCESS FLOW:
              // 1. Show success toast/modal: "Payment successful."
              // 2. Clear payment form
              // 3. Re-fetch GET /api/enrollment and GET /api/fee
              // 4. Replace all old frontend fee state with latest API response
              // 5. Update immediately: Remaining Dues, Total Paid, Payment Status, Course card, Payment history
              // 6. Do NOT calculate the new dues locally!
              const resData = verifyRes.data;
              setPayAmount("");
              setAmountError(null);
              setIsPayModalOpen(false);
              setPaymentSuccessData(resData);
              setShowSuccessModal(true);

              // Re-fetch API data directly from server
              await loadFeeData();

              toast({
                variant: "success",
                title: "Payment Successful",
                description:
                  resData.email_sent && resData.email_recipient
                    ? `Payment successful. Your payment confirmation has been sent to ${resData.email_recipient}.`
                    : resData.email_sent === false
                    ? "Payment successful. We could not send the confirmation email right now."
                    : "Payment successful.",
              });
            } else {
              // ERROR HANDLING: If Razorpay succeeds but /api/fee fails
              // DO NOT show the payment as successfully recorded in the frontend fee history.
              // Show a clear message:
              // "Payment was received by the payment gateway, but the fee record could not be updated. Please contact support with your payment reference."
              const status = verifyRes._status;
              let failMsg = "";

              if (status === 401) {
                failMsg = "Session expired. Please login again.";
              } else if (status === 403) {
                failMsg = "You are not authorized to make this payment.";
              } else if (status === 404) {
                failMsg = "Enrollment not found.";
              } else if (status === 422) {
                failMsg = verifyRes.message || "Validation failed.";
              } else if (status === 409) {
                failMsg = verifyRes.message || "Duplicate payment reference error.";
              } else {
                failMsg = "Payment was received by the payment gateway, but the fee record could not be updated. Please contact support with your payment reference.";
              }

              toast({
                variant: "error",
                title: "Fee Record Notice",
                description: failMsg,
              });

              setGatewaySyncWarning({
                paymentId: response.razorpay_payment_id,
                message: failMsg,
              });
            }
          } catch {
            toast({
              variant: "error",
              title: "Payment Sync Notice",
              description: `Payment was received by the payment gateway, but the fee record could not be updated. Please contact support with your payment reference. Reference: ${response.razorpay_payment_id}`,
            });
            setGatewaySyncWarning({
              paymentId: response.razorpay_payment_id,
              message: "Payment was received by the payment gateway, but the fee record could not be updated. Please contact support with your payment reference.",
            });
          } finally {
            setIsProcessingPayment(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessingPayment(false);
            toast({
              variant: "info",
              title: "Payment Cancelled",
              description: "Payment was not completed.",
            });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (failResponse: any) {
        setIsProcessingPayment(false);
        const errMsg =
          failResponse?.error?.description || "Payment could not be completed. Please try again.";
        console.error("[Razorpay Stage: CHECKOUT] Payment failed:", failResponse?.error);
        toast({
          variant: "error",
          title: "Payment Checkout Failed",
          description: errMsg,
        });
      });

      rzp.open();
    } catch (err: any) {
      console.error("[Fee Payment Error]:", err);
      setIsProcessingPayment(false);
      toast({
        variant: "error",
        title: "Payment Gateway Error",
        description: err.message || "Payment could not be completed. Please try again.",
      });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#08A66A] animate-pulse" />
            <span className="text-xs font-bold text-[#08A66A] uppercase tracking-wider">
              Student Finance
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Fee Details &amp; Installments
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Real-time tuition fee tracking, official receipts, and instant online installment payment.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {summary.dues > 0 ? (
            <Button
              onClick={() => {
                const firstWithDues = enrollments.find((e) => extractEnrollmentDues(e) > 0);
                if (firstWithDues) {
                  openPayModalForCourse(firstWithDues.stc_id);
                } else {
                  setIsPayModalOpen(true);
                }
              }}
              className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold rounded-xl h-10 px-4 shadow-md shadow-[#5B21F4]/20 gap-2 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              Pay Fee
            </Button>
          ) : (
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>No dues remaining</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Gateway Out-Of-Sync Warning Alert ── */}
      {gatewaySyncWarning && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-amber-800">Payment Gateway Reconciliation Notice</p>
            <p>{gatewaySyncWarning.message}</p>
            <p className="font-mono text-[11px] text-amber-700">
              Gateway Reference ID: <strong>{gatewaySyncWarning.paymentId}</strong>
            </p>
          </div>
          <button
            onClick={() => setGatewaySyncWarning(null)}
            className="ml-auto text-amber-600 hover:text-amber-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Error Banner ── */}
      {!loading && error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-red-800">{error}</p>
          <button
            onClick={loadFeeData}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry Loading Fee Data
          </button>
        </div>
      )}

      {/* ── Summary Stats Cards (Strict Real API Data) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Fee */}
        <motion.div {...fadeUp(0.05)}>
          <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] space-y-1 shadow-sm">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Total Course Fee
            </span>
            {loading ? (
              <Skeleton className="h-8 w-28 my-1" />
            ) : (
              <p className="text-2xl font-black text-[#111827]">
                ₹{summary.totalFee.toLocaleString("en-IN")}
              </p>
            )}
            <p className="text-[11px] text-[#94A3B8]">Approved curriculum fee</p>
          </div>
        </motion.div>

        {/* Discount / Scholarship */}
        <motion.div {...fadeUp(0.1)}>
          <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] space-y-1 shadow-sm">
            <span className="text-xs font-bold text-[#08A66A] uppercase tracking-wider">
              Scholarship / Discount
            </span>
            {loading ? (
              <Skeleton className="h-8 w-28 my-1" />
            ) : (
              <p className="text-2xl font-black text-[#08A66A]">
                ₹{summary.discount.toLocaleString("en-IN")}
              </p>
            )}
            <p className="text-[11px] text-[#94A3B8]">Concession applied</p>
          </div>
        </motion.div>

        {/* Total Paid */}
        <motion.div {...fadeUp(0.15)}>
          <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] space-y-1 shadow-sm">
            <span className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
              Total Amount Paid
            </span>
            {loading ? (
              <Skeleton className="h-8 w-28 my-1" />
            ) : (
              <p className="text-2xl font-black text-[#2563EB]">
                ₹{summary.totalPaid.toLocaleString("en-IN")}
              </p>
            )}
            <p className="text-[11px] text-[#94A3B8]">Verified receipts in ledger</p>
          </div>
        </motion.div>

        {/* Remaining Dues — Backend stc_dues source of truth */}
        <motion.div {...fadeUp(0.2)}>
          <div
            className={`rounded-2xl p-5 border space-y-1 shadow-sm ${
              summary.dues > 0
                ? "bg-[#FFFBEB] border-[#FEF3C7]"
                : "bg-[#ECFDF5] border-[#D1FAE5]"
            }`}
          >
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                summary.dues > 0 ? "text-[#F59E0B]" : "text-[#08A66A]"
              }`}
            >
              Remaining Dues
            </span>
            {loading ? (
              <Skeleton className="h-8 w-28 my-1" />
            ) : (
              <p
                className={`text-2xl font-black ${
                  summary.dues > 0 ? "text-[#B45309]" : "text-[#08A66A]"
                }`}
              >
                ₹{summary.dues.toLocaleString("en-IN")}
              </p>
            )}
            <p className="text-[11px] text-[#64748B]">
              {summary.dues > 0 ? "Payment Due" : "Fully Paid"}
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── Enrolled Courses Cards / Table ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#5B21F4]" />
            <h2 className="text-base font-extrabold text-[#111827]">
              Enrolled Courses &amp; Fee Status
            </h2>
          </div>
          <span className="text-xs text-[#64748B] font-semibold">
            {enrollments.length} {enrollments.length === 1 ? "Course" : "Courses"}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center text-[#64748B] space-y-2">
            <GraduationCap className="w-10 h-10 text-[#CBD5E1] mx-auto" />
            <p className="font-bold text-[#111827]">No course enrollments found.</p>
            <p className="text-xs">Once you enroll in a course, fee details will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrollments.map((enr) => {
              const cFee = extractEnrollmentTotalFee(enr);
              const cDisc = extractEnrollmentDiscount(enr);
              const cInitial = extractEnrollmentInitialPayment(enr);
              const cDues = extractEnrollmentDues(enr);
              const cTotalPaid = extractEnrollmentTotalPaid(enr, transactions);
              const isFullyPaid = cDues === 0;
              const paymentStatusText = isFullyPaid ? "Fully Paid" : "Payment Due";
              const regNo =
                enr.registration_number ||
                sessionRegNo ||
                `BISR${String(enr.student_id || student_id || "").padStart(4, "0")}`;

              return (
                <div
                  key={enr.stc_id}
                  className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm hover:border-[#DDD6FE] transition-all flex flex-col justify-between"
                >
                  {/* Course Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {enr.course_code && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1EEFF] text-[#5B21F4] uppercase">
                              {enr.course_code}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              isFullyPaid
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            {paymentStatusText}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-[#111827] text-base mt-1.5 leading-snug">
                          {enr.course_name}
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#64748B] shrink-0">
                        #{enr.stc_id}
                      </span>
                    </div>

                    <p className="text-xs text-[#64748B] mt-1">
                      Registration Number:{" "}
                      <strong className="font-mono text-[#111827]">{regNo}</strong>
                    </p>
                  </div>

                  {/* Financial Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[#F1F5F9] text-xs">
                    <div className="bg-[#F8FAFC] p-2.5 rounded-xl">
                      <p className="text-[#94A3B8] text-[10px] uppercase font-bold">Total Fee</p>
                      <p className="font-extrabold text-[#111827] text-sm mt-0.5">
                        ₹{cFee.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="bg-[#F8FAFC] p-2.5 rounded-xl">
                      <p className="text-[#94A3B8] text-[10px] uppercase font-bold">Discount</p>
                      <p className="font-extrabold text-[#08A66A] text-sm mt-0.5">
                        ₹{cDisc.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="bg-[#F8FAFC] p-2.5 rounded-xl">
                      <p className="text-[#94A3B8] text-[10px] uppercase font-bold">Initial Payment</p>
                      <p className="font-extrabold text-[#111827] text-sm mt-0.5">
                        ₹{cInitial.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="bg-[#F8FAFC] p-2.5 rounded-xl">
                      <p className="text-[#94A3B8] text-[10px] uppercase font-bold">Total Paid</p>
                      <p className="font-extrabold text-[#2563EB] text-sm mt-0.5">
                        ₹{cTotalPaid.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div
                      className={`col-span-2 p-2.5 rounded-xl border ${
                        isFullyPaid
                          ? "bg-[#ECFDF5] border-[#D1FAE5]"
                          : "bg-[#FFFBEB] border-[#FEF3C7]"
                      }`}
                    >
                      <p
                        className={`text-[10px] uppercase font-bold ${
                          isFullyPaid ? "text-emerald-700" : "text-amber-800"
                        }`}
                      >
                        Remaining Dues
                      </p>
                      <p
                        className={`font-black text-base mt-0.5 ${
                          isFullyPaid ? "text-emerald-700" : "text-amber-800"
                        }`}
                      >
                        ₹{cDues.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  {/* Course Action Buttons */}
                  <div className="pt-2 flex items-center justify-between border-t border-[#F1F5F9]">
                    <span className="text-[11px] text-[#64748B]">
                      Enrollment ID: <strong className="font-mono text-[#111827]">#{enr.stc_id}</strong>
                    </span>

                    {isFullyPaid ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>No dues remaining</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => openPayModalForCourse(enr.stc_id)}
                        className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold h-9 px-3.5 rounded-xl shadow-sm gap-1.5 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Fee</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Clean Payment History Section ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#5B21F4]" />
            <h3 className="font-extrabold text-[#111827] text-sm">
              Fee Payment History &amp; Receipts
            </h3>
          </div>
          <span className="text-xs text-[#64748B] font-semibold">
            {transactions.length} Verified {transactions.length === 1 ? "Transaction" : "Transactions"}
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-[#64748B] space-y-2">
            <Receipt className="w-10 h-10 text-[#CBD5E1] mx-auto" />
            <p className="font-bold text-[#111827]">No payment transactions found.</p>
            <p className="text-xs">Any verified tuition installments made via Razorpay will be listed here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">Tx ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Payment Reference</th>
                  <th className="py-3 px-4">Remark</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {transactions.map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#64748B]">
                      #{tx.transaction_id}
                    </td>
                    <td className="py-3.5 px-4 text-[#111827] whitespace-nowrap">
                      {tx.date || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-[#111827] font-semibold">
                      {tx.course_name || "Enrolled Course"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                        {tx.mode || "razorpay"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#5B21F4] font-semibold">
                      {tx.payment_reference || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-[#64748B]">
                      {tx.remark || "Course fee installment payment"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Completed</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-[#08A66A] whitespace-nowrap text-sm">
                      ₹{Number(tx.amount || 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* PAYMENT MODAL / FORM                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isPayModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-md w-full p-6 space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#111827] text-base leading-none">
                      Pay Fee
                    </h3>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Fast &amp; secure installment payment via Razorpay
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isProcessingPayment) {
                      setIsPayModalOpen(false);
                      setAmountError(null);
                    }
                  }}
                  disabled={isProcessingPayment}
                  className="p-1 rounded-lg text-[#94A3B8] hover:text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePaySubmit} className="space-y-4">
                {/* Course Selection Dropdown (if multiple enrollments exist) */}
                {enrollments.length > 1 && (
                  <div>
                    <Label className="text-xs font-bold text-[#111827]">Select Course</Label>
                    <select
                      value={selectedStcId || ""}
                      onChange={(e) => {
                        const newId = Number(e.target.value);
                        setSelectedStcId(newId);
                        const enr = enrollments.find((x) => Number(x.stc_id) === newId);
                        const dues = extractEnrollmentDues(enr);
                        setPayAmount(dues > 0 ? String(dues) : "");
                        setAmountError(null);
                      }}
                      disabled={isProcessingPayment}
                      className="mt-1 w-full h-11 px-3 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#111827] bg-white focus:outline-none focus:border-[#5B21F4]"
                    >
                      {enrollments.map((enr) => {
                        const dues = extractEnrollmentDues(enr);
                        return (
                          <option key={enr.stc_id} value={enr.stc_id}>
                            {enr.course_name} (Remaining Dues: ₹{dues.toLocaleString("en-IN")})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* Course & Remaining Dues Card */}
                {selectedEnrollment && (
                  <div
                    className={`p-3.5 rounded-xl border space-y-1 ${
                      selectedCourseDues > 0
                        ? "bg-[#FFFBEB] border-[#FEF3C7]"
                        : "bg-[#ECFDF5] border-[#D1FAE5]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-[#64748B]">Course:</span>
                      <span className="font-extrabold text-[#111827]">
                        {selectedEnrollment.course_name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-bold text-[#64748B]">Remaining Dues:</span>
                      <span
                        className={`text-lg font-black ${
                          selectedCourseDues > 0 ? "text-amber-800" : "text-emerald-700"
                        }`}
                      >
                        ₹{selectedCourseDues.toLocaleString("en-IN")}
                      </span>
                    </div>

                    {selectedCourseDues === 0 && (
                      <p className="text-[11px] font-bold text-emerald-700 pt-1">
                        No dues remaining for this course.
                      </p>
                    )}
                  </div>
                )}

                {/* Enter Amount Input */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-[#111827]">Enter Amount (₹)</Label>
                    {selectedCourseDues > 0 && (
                      <span className="text-[11px] text-[#64748B]">
                        Max: ₹{selectedCourseDues.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                  <Input
                    type="number"
                    min="1"
                    max={selectedCourseDues || undefined}
                    step="1"
                    placeholder={
                      selectedCourseDues > 0
                        ? `Enter amount up to ₹${selectedCourseDues.toLocaleString("en-IN")}`
                        : "0"
                    }
                    value={payAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    disabled={selectedCourseDues <= 0 || isProcessingPayment}
                    required
                    className="mt-1 h-11 text-sm font-bold rounded-xl"
                  />

                  {amountError && (
                    <p className="mt-1.5 text-xs text-red-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{amountError}</span>
                    </p>
                  )}
                </div>

                {/* Quick Amount Buttons (25%, 50%, 75%, Pay Full Due) */}
                {selectedCourseDues > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-[#64748B]">Quick Amount:</span>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickAmount(0.25)}
                        disabled={selectedCourseDues <= 0 || isProcessingPayment}
                        className="py-1.5 px-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1EEFF] hover:border-[#DDD6FE] text-[#111827] text-xs font-bold transition-all disabled:opacity-50 cursor-pointer text-center"
                      >
                        25%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAmount(0.5)}
                        disabled={selectedCourseDues <= 0 || isProcessingPayment}
                        className="py-1.5 px-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1EEFF] hover:border-[#DDD6FE] text-[#111827] text-xs font-bold transition-all disabled:opacity-50 cursor-pointer text-center"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAmount(0.75)}
                        disabled={selectedCourseDues <= 0 || isProcessingPayment}
                        className="py-1.5 px-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1EEFF] hover:border-[#DDD6FE] text-[#111827] text-xs font-bold transition-all disabled:opacity-50 cursor-pointer text-center"
                      >
                        75%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickAmount(1.0)}
                        disabled={selectedCourseDues <= 0 || isProcessingPayment}
                        className="py-1.5 px-2 rounded-xl border border-[#DDD6FE] bg-[#F1EEFF] hover:bg-[#5B21F4] hover:text-white text-[#5B21F4] text-xs font-bold transition-all disabled:opacity-50 cursor-pointer text-center whitespace-nowrap"
                      >
                        Pay Full Due
                      </button>
                    </div>
                  </div>
                )}

                {/* Gateway Banner */}
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-[#64748B]">
                      Payment Gateway
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Razorpay Verified
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#111827]">
                    Razorpay Secure Checkout
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    UPI (Google Pay, PhonePe, Paytm), Cards, Netbanking, or Wallets.
                  </p>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!isProcessingPayment) {
                        setIsPayModalOpen(false);
                        setAmountError(null);
                      }
                    }}
                    disabled={isProcessingPayment}
                    className="flex-1 rounded-xl text-xs font-bold h-11 cursor-pointer"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={
                      isProcessingPayment ||
                      selectedCourseDues <= 0 ||
                      !payAmount ||
                      parseFloat(payAmount) <= 0 ||
                      parseFloat(payAmount) > selectedCourseDues
                    }
                    className="flex-1 rounded-xl bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold h-11 shadow-md shadow-[#5B21F4]/20 gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing Payment...</span>
                      </>
                    ) : selectedCourseDues <= 0 ? (
                      <span>No dues remaining</span>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>
                          Pay{" "}
                          {payAmount && parseFloat(payAmount) > 0
                            ? `₹${parseFloat(payAmount).toLocaleString("en-IN")}`
                            : "Fee"}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CONFIRMATION STATE AFTER SUCCESSFUL PAYMENT                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSuccessModal && paymentSuccessData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-[#111827]">
                  Payment successful.
                </h3>
                <p className="text-sm text-emerald-700 font-bold mt-1">
                  ₹{Number(paymentSuccessData.amount_paid).toLocaleString("en-IN")} payment recorded successfully.
                </p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Your tuition installment has been verified by Razorpay and updated in your student fee ledger.
                </p>
              </div>

              {/* Email Confirmation Notice (Requirement 20) */}
              {paymentSuccessData.email_sent === true && paymentSuccessData.email_recipient && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl py-2 px-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Your payment confirmation has been sent to{" "}
                    <strong>{paymentSuccessData.email_recipient}</strong>
                  </span>
                </div>
              )}
              {paymentSuccessData.email_sent === false && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl py-2 px-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Payment successful. We could not send the confirmation email right now.
                  </span>
                </div>
              )}

              {/* Receipt Breakdown Card */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-2.5 text-left">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Course:</span>
                  <span className="font-bold text-[#111827]">{paymentSuccessData.course_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Transaction ID:</span>
                  <span className="font-mono font-bold text-[#111827]">#{paymentSuccessData.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Payment Reference:</span>
                  <span className="font-mono font-bold text-[#5B21F4]">{paymentSuccessData.payment_reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Payment Mode:</span>
                  <span className="uppercase font-bold text-[#111827]">{paymentSuccessData.payment_mode || "razorpay"}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-[#E2E8F0]">
                  <span className="text-[#64748B] font-bold">Remaining Dues:</span>
                  <span className="font-extrabold text-amber-700">
                    ₹{Number(paymentSuccessData.remaining_dues).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSuccessModal(false)}
                  className="flex-1 rounded-xl text-xs font-bold h-11 cursor-pointer"
                >
                  Done
                </Button>
                <Link href="/student/payments" className="flex-1">
                  <Button
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full rounded-xl bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold h-11 shadow-md gap-1.5 cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>View Receipt</span>
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
