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
  Download,
  BookOpen,
  Play,
  FileCheck2,
  ImageIcon,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useStudent } from "@/hooks/useStudent";
import { downloadReceiptAsImage, downloadReceiptAsPdf } from "@/lib/receiptDownload";
import {
  getStudentFees,
  getStudentEnrollments,
  getStudentOnlineCourses,
  getCurrentStudent,
  getEnrollmentById,
  createFeeInstallmentOrder,
  recordVerifiedFeePayment,
  FeeTransactionItem,
  EnrollmentItem,
  OnlineEnrolledCourse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatIstDateTime } from "@/lib/utils";

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
// Remaining dues = max(0, total_fee - discount - total_paid)
export function extractEnrollmentDues(e: any, transactions?: FeeTransactionItem[]): number {
  if (!e) return 0;
  const totalFee = extractEnrollmentTotalFee(e);
  const discount = extractEnrollmentDiscount(e);
  const netFee = Math.max(0, totalFee - discount);
  const totalPaid = extractEnrollmentTotalPaid(e, transactions);
  const computedDues = Math.max(0, netFee - totalPaid);

  let rawDues: number | null = null;
  if (e.stc_dues !== undefined && e.stc_dues !== null && e.stc_dues !== "") {
    const n = Number(e.stc_dues);
    if (!isNaN(n)) rawDues = n;
  } else if (e.dues !== undefined && e.dues !== null && e.dues !== "") {
    const n = Number(e.dues);
    if (!isNaN(n)) rawDues = n;
  } else if (e.remaining_dues !== undefined && e.remaining_dues !== null && e.remaining_dues !== "") {
    const n = Number(e.remaining_dues);
    if (!isNaN(n)) rawDues = n;
  } else if (e.summary?.stc_dues !== undefined && e.summary?.stc_dues !== null && e.summary?.stc_dues !== "") {
    const n = Number(e.summary.stc_dues);
    if (!isNaN(n)) rawDues = n;
  } else if (e.summary?.dues !== undefined && e.summary?.dues !== null && e.summary?.dues !== "") {
    const n = Number(e.summary.dues);
    if (!isNaN(n)) rawDues = n;
  }

  if (rawDues !== null) {
    return Math.min(rawDues, computedDues);
  }

  return computedDues;
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
  const isOnline = Boolean(e.is_online || e.stco_id || e.course_format === "online");
  const enrollmentId = Number(e.stc_id ?? e.stco_id ?? e.id);
  if (transactions && transactions.length > 0) {
    const txForCourse = transactions.filter((t) => {
      const txIsOnline = Boolean(
        t.is_online ||
        t.course_format === "online" ||
        (t as any).tr_course_type === "online" ||
        (t as any).tr_stco_id ||
        (t as any).stco_id
      );
      if (isOnline !== txIsOnline) return false;
      const txId = isOnline
        ? Number((t as any).tr_stco_id ?? (t as any).stco_id ?? t.enrollment_id)
        : Number(t.tr_stc_id ?? t.stc_id ?? t.enrollment_id);
      return txId === enrollmentId;
    });
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
  const dues = Number(e.stc_dues ?? e.dues ?? (e.summary?.stc_dues ?? fee));
  const init = extractEnrollmentInitialPayment(e);
  return Math.max(init, Math.max(0, fee - disc - dues));
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
  const [onlineCourses, setOnlineCourses] = useState<OnlineEnrolledCourse[]>([]);
  const [coursesTab, setCoursesTab] = useState<"all" | "offline" | "online">("all");
  const [txTab, setTxTab] = useState<"all" | "offline" | "online">("all");
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<FeeTransactionItem | null>(null);
  const [downloadingReceiptTxId, setDownloadingReceiptTxId] = useState<number | string | null>(null);
  const [downloadingReceiptFormat, setDownloadingReceiptFormat] = useState<"image" | "pdf" | null>(null);

  const handleDownloadReceipt = async (
    tx: FeeTransactionItem,
    format: "image" | "pdf" = "pdf"
  ) => {
    if (downloadingReceiptTxId) return;
    setDownloadingReceiptTxId(tx.transaction_id);
    setDownloadingReceiptFormat(format);

    try {
      const receiptData = {
        transaction_id: tx.transaction_id,
        student_name: tx.student_name || name || "Student",
        registration_no:
          tx.registration_no ||
          tx.registration_number ||
          sessionRegNo ||
          "BISR-ONLINE",
        date: tx.date || "—",
        course_name: tx.course_name || "Enrolled Course",
        course_type:
          tx.is_online || tx.course_format === "online"
            ? "Online E-Learning Program"
            : "Offline Classroom Diploma",
        is_online: Boolean(tx.is_online || tx.course_format === "online"),
        enrollment_id: tx.enrollment_id,
        payment_mode: tx.mode || "RAZORPAY",
        reference_number: tx.payment_reference || "N/A",
        total_fee: Number(tx.total_fee || tx.course_fee || tx.summary?.total_fee || 0),
        discount: Number(
          tx.discount ||
            tx.discount_amount ||
            tx.coupon_discount ||
            tx.summary?.discount ||
            0
        ),
        coupon_code: tx.coupon_code || tx.summary?.coupon_code || undefined,
        remark: tx.remark,
        net_amount: Number(tx.amount || 0),
      };

      let filename = "";
      if (format === "pdf") {
        filename = await downloadReceiptAsPdf(receiptData);
      } else {
        filename = await downloadReceiptAsImage(receiptData);
      }

      toast({
        variant: "success",
        title: format === "pdf" ? "PDF Receipt Downloaded! 📄" : "Receipt Image Downloaded! 🖼️",
        description: `Official receipt saved as "${filename}".`,
      });
    } catch (err) {
      console.error("[StudentFees] Receipt download error:", err);
      toast({
        variant: "error",
        title: "Download Issue",
        description: `Could not export receipt as ${format.toUpperCase()}. Please try again.`,
      });
    } finally {
      setDownloadingReceiptTxId(null);
      setDownloadingReceiptFormat(null);
    }
  };

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
  // Strictly treats backend stc_dues as single source of truth for offline courses
  // and includes verified online courses and payments
  const loadFeeData = useCallback(async () => {
    if (!user_id) return;
    setLoading(true);
    setError(null);

    try {
      const [feeRes, enrRes, onlRes, stMeRes] = await Promise.allSettled([
        getStudentFees(user_id),
        getStudentEnrollments(user_id),
        getStudentOnlineCourses(user_id, "student"),
        getCurrentStudent(user_id),
      ]);

      let enrList: EnrollmentItem[] = [];
      let txList: FeeTransactionItem[] = [];
      let onlList: OnlineEnrolledCourse[] = [];
      const onlineMap = new Map<number, OnlineEnrolledCourse>();

      // 1. Process Online Courses
      if (onlRes.status === "fulfilled" && onlRes.value.success && Array.isArray(onlRes.value.data)) {
        onlRes.value.data.forEach((c) => {
          onlineMap.set(Number(c.course_id), { ...c, course_format: "online" });
        });
      }

      if (stMeRes.status === "fulfilled" && stMeRes.value.success && Array.isArray(stMeRes.value.data?.online_courses)) {
        stMeRes.value.data.online_courses.forEach((c: any) => {
          const cId = Number(c.course_id ?? c.stco_course_id);
          if (cId && !onlineMap.has(cId)) {
            onlineMap.set(cId, {
              course_id: cId,
              course_code: c.course_code || `ONL-${cId}`,
              course_name: c.course_name || `Online Course #${cId}`,
              course_fee: Number(c.course_fee ?? c.stco_total_fee ?? 0),
              amount_paid: Number(c.amount_paid ?? c.stco_initial_payment ?? c.course_fee ?? 0),
              course_format: "online",
              created_at: c.created_at,
              registration_number: c.st_regno || sessionRegNo || null,
              student_id: Number(c.student_id ?? c.stco_st_id ?? user_id) || null,
            });
          }
        });
      }

      onlList = Array.from(onlineMap.values());
      setOnlineCourses(onlList);

      // 2. Process Transactions (INCLUDING both offline and online)
      if (feeRes.status === "fulfilled" && feeRes.value.success && feeRes.value.data) {
        if (Array.isArray(feeRes.value.data)) {
          txList = [...feeRes.value.data];
        } else if (Array.isArray((feeRes.value.data as any).transactions)) {
          txList = [...(feeRes.value.data as any).transactions];
        }
      } else if (feeRes.status === "fulfilled" && !feeRes.value.success) {
        const status = (feeRes.value as any)._status;
        setError(getHttpErrorMessage(status, feeRes.value.message || "Failed to load fee ledger.", feeRes.value.message));
      }

      // Add any online courses that aren't already represented in txList
      for (const onl of onlList) {
        const payRef = onl.razorpay_payment_id || `ONL_PUR_${onl.course_id}`;
        const alreadyInTx = txList.some(
          (t) =>
            (onl.razorpay_payment_id &&
              (t.payment_reference === onl.razorpay_payment_id ||
                t.payref === onl.razorpay_payment_id ||
                (t as any).tr_payref === onl.razorpay_payment_id)) ||
            ((t.is_online || t.course_format === "online" || (t as any).tr_course_type === "online") &&
              (Number(t.enrollment_id) === Number(onl.stco_id) ||
                Number((t as any).tr_stco_id) === Number(onl.stco_id) ||
                Number(t.course_id) === Number(onl.course_id)))
        );
        const originalFee = Number(onl.course_fee || onl.total_fee || onl.amount_paid || 0);
        const discountAmt = Number(onl.discount || 0);
        const coupon = onl.coupon_code || undefined;
        const paidAmt = Number(onl.amount_paid ?? Math.max(0, originalFee - discountAmt));

        if (!alreadyInTx) {
          txList.push({
            transaction_id: onl.stco_id || 900000 + Number(onl.course_id),
            tr_id: onl.stco_id || 900000 + Number(onl.course_id),
            enrollment_id: onl.stco_id || onl.course_id,
            stco_id: onl.stco_id || onl.course_id,
            tr_stco_id: onl.stco_id || onl.course_id,
            tr_course_type: "online",
            amount: paidAmt,
            tr_amount: paidAmt,
            total_fee: originalFee,
            course_fee: originalFee,
            discount: discountAmt,
            discount_amount: discountAmt,
            coupon_code: coupon,
            coupon_discount: discountAmt,
            amount_paid: paidAmt,
            initial_payment: paidAmt,
            dues: 0,
            remaining_dues: 0,
            mode: "razorpay",
            tr_mode: "razorpay",
            payment_reference: payRef,
            payref: payRef,
            tr_payref: payRef,
            remark: coupon
              ? `Online Course Enrollment: ${onl.course_name} (Coupon '${coupon}' applied: ₹${discountAmt} off)`
              : `Online Course Enrollment: ${onl.course_name}`,
            tr_remark: coupon
              ? `Online Course Enrollment: ${onl.course_name} (Coupon '${coupon}' applied: ₹${discountAmt} off)`
              : `Online Course Enrollment: ${onl.course_name}`,
            date: onl.created_at ? formatIstDateTime(onl.created_at) : "",
            tr_date: onl.created_at ? formatIstDateTime(onl.created_at) : "",
            student_id: Number(student_id || user_id || 0),
            registration_no: onl.registration_number || sessionRegNo || "BISR-ONLINE",
            student_name: name || "Student",
            course_name: onl.course_name,
            course_code: onl.course_code,
            course_format: "online",
            is_online: true,
            status: "completed",
            summary: {
              total_fee: originalFee,
              discount: discountAmt,
              total_paid: paidAmt,
              dues: 0,
              coupon_code: coupon || null,
              course_fee: originalFee,
              initial_payment: paidAmt,
            },
          });
        }
      }

      // Sort newest first
      txList.sort(
        (a, b) =>
          new Date(b.date || b.tr_date || 0).getTime() - new Date(a.date || a.tr_date || 0).getTime()
      );
      setTransactions(txList);

      // 3. Process Offline Enrollments
      if (enrRes.status === "fulfilled" && enrRes.value.success && enrRes.value.data) {
        let rawList: any[] = [];
        if (Array.isArray(enrRes.value.data)) {
          rawList = enrRes.value.data;
        } else if ("enrollments" in enrRes.value.data && Array.isArray((enrRes.value.data as any).enrollments)) {
          rawList = (enrRes.value.data as any).enrollments;
        }

        enrList = rawList.map((e: any) => {
          const totalFee = extractEnrollmentTotalFee(e);
          const discount = extractEnrollmentDiscount(e);
          const initialPayment = extractEnrollmentInitialPayment(e);
          const totalPaid = extractEnrollmentTotalPaid(e, txList);
          const dues = extractEnrollmentDues(e, txList);

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
            course_format: "offline" as const,
          };
        });

        setEnrollments(enrList);

        if (enrList.length > 0) {
          // Pre-select first enrollment with dues > 0, otherwise first enrollment
          const firstWithDues = enrList.find((e) => extractEnrollmentDues(e, txList) > 0);
          const autoSelectId = firstWithDues ? firstWithDues.stc_id : enrList[0].stc_id;
          setSelectedStcId((prev) => (prev ? prev : autoSelectId));
        }
      }

      // 4. Calculate aggregated financial summary (both offline center courses + online courses)
      const enrTotalSum = enrList.reduce((acc, e) => acc + extractEnrollmentTotalFee(e), 0);
      const onlTotalSum = onlList.reduce((acc, c) => acc + Number(c.course_fee || 0), 0);

      const enrDiscSum = enrList.reduce((acc, e) => acc + extractEnrollmentDiscount(e), 0);

      const enrPaidSum = enrList.reduce((acc, e) => acc + extractEnrollmentTotalPaid(e, txList), 0);
      const onlPaidSum = onlList.reduce((acc, c) => acc + Number(c.amount_paid || c.course_fee || 0), 0);

      const enrDuesSum = enrList.reduce((acc, e) => acc + extractEnrollmentDues(e, txList), 0);

      setSummary({
        totalFee: enrTotalSum + onlTotalSum,
        discount: enrDiscSum,
        totalPaid: enrPaidSum + onlPaidSum,
        dues: enrDuesSum,
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#5B21F4]" />
            <h2 className="text-base font-extrabold text-[#111827]">
              Enrolled Courses &amp; Fee Status
            </h2>
          </div>
          
          {/* Radix Tabs for Courses & Fee Status */}
          <Tabs value={coursesTab} onValueChange={(v) => setCoursesTab(v as any)}>
            <TabsList className="h-9 p-1">
              <TabsTrigger value="all" className="text-xs py-1 px-3 gap-1.5">
                <span>All Courses</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {enrollments.length + onlineCourses.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="offline" className="text-xs py-1 px-3 gap-1.5">
                <span>Offline Classroom</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {enrollments.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="online" className="text-xs py-1 px-3 gap-1.5">
                <span>Online Courses</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                  {onlineCourses.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
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
        ) : enrollments.length === 0 && onlineCourses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center text-[#64748B] space-y-2">
            <GraduationCap className="w-10 h-10 text-[#CBD5E1] mx-auto" />
            <p className="font-bold text-[#111827]">No course enrollments found.</p>
            <p className="text-xs">Once you enroll in a course, fee details will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Offline Courses */}
            {(coursesTab === "all" || coursesTab === "offline") &&
              enrollments.map((enr) => {
                const cFee = extractEnrollmentTotalFee(enr);
                const cDisc = extractEnrollmentDiscount(enr);
                const cInitial = extractEnrollmentInitialPayment(enr);
                const cTotalPaid = extractEnrollmentTotalPaid(enr, transactions);
                const cDues = extractEnrollmentDues(enr, transactions);
                const isFullyPaid = cDues === 0;
                const paymentStatusText = isFullyPaid ? "Fully Paid" : "Payment Due";
                const regNo = enr.registration_number || sessionRegNo || null;

                return (
                  <div
                    key={`off_${enr.stc_id}`}
                    className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm hover:border-[#DDD6FE] transition-all flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="h-1 w-full absolute top-0 left-0 bg-gradient-to-r from-blue-600 to-indigo-600" />
                    {/* Course Header */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Offline Classroom
                            </span>
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

                      <div className="text-xs text-[#64748B] mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span>Registration Number:</span>
                        {regNo ? (
                          <strong className="font-mono text-[#111827]">{regNo}</strong>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            Pending (Pay at Study Centre)
                          </span>
                        )}
                      </div>
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

            {/* 2. Online Courses */}
            {(coursesTab === "all" || coursesTab === "online") &&
              onlineCourses.map((onl) => {
                const feeNum = Number(onl.course_fee || onl.amount_paid || 0);
                const paidNum = Number(onl.amount_paid || onl.course_fee || 0);
                const regNo = onl.registration_number || sessionRegNo || null;
                const matchingTx = transactions.find(
                  (t) =>
                    (onl.razorpay_payment_id && t.payment_reference === onl.razorpay_payment_id) ||
                    (t.is_online && Number(t.enrollment_id || t.course_id) === Number(onl.course_id)) ||
                    (t.course_format === "online" && Number(t.enrollment_id || t.course_id) === Number(onl.course_id))
                );

                return (
                  <div
                    key={`onl_${onl.course_id}`}
                    className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm hover:border-[#DDD6FE] transition-all flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="h-1 w-full absolute top-0 left-0 bg-gradient-to-r from-[#5B21F4] to-purple-500" />
                    {/* Header */}
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-[#5B21F4] border border-purple-200">
                              Online Course
                            </span>
                            {onl.course_code && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1EEFF] text-[#5B21F4] uppercase font-mono">
                                {onl.course_code}
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                              Fully Paid
                            </span>
                          </div>
                          <h3 className="font-extrabold text-[#111827] text-base mt-1.5 leading-snug">
                            {onl.course_name}
                          </h3>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#64748B] shrink-0">
                          #{onl.stco_id || onl.course_id}
                        </span>
                      </div>

                      <div className="text-xs text-[#64748B] mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span>Registration Number:</span>
                        {regNo ? (
                          <strong className="font-mono text-[#111827]">{regNo}</strong>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Active Online Student
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[#F1F5F9] text-xs">
                      <div className="bg-[#F8FAFC] p-2.5 rounded-xl">
                        <p className="text-[#94A3B8] text-[10px] uppercase font-bold">Total Fee</p>
                        <p className="font-extrabold text-[#111827] text-sm mt-0.5">
                          ₹{feeNum.toLocaleString("en-IN")}
                        </p>
                      </div>

                      <div className="bg-[#F8FAFC] p-2.5 rounded-xl">
                        <p className="text-[#94A3B8] text-[10px] uppercase font-bold">Discount</p>
                        <p className="font-extrabold text-[#08A66A] text-sm mt-0.5">₹0</p>
                      </div>

                      <div className="bg-[#F8FAFC] p-2.5 rounded-xl">
                        <p className="text-[#94A3B8] text-[10px] uppercase font-bold">Initial Payment</p>
                        <p className="font-extrabold text-[#111827] text-sm mt-0.5">
                          ₹{paidNum.toLocaleString("en-IN")}
                        </p>
                      </div>

                      <div className="bg-[#F8FAFC] p-2.5 rounded-xl">
                        <p className="text-[#94A3B8] text-[10px] uppercase font-bold">Total Paid</p>
                        <p className="font-extrabold text-[#2563EB] text-sm mt-0.5">
                          ₹{paidNum.toLocaleString("en-IN")}
                        </p>
                      </div>

                      <div className="col-span-2 p-2.5 rounded-xl border bg-[#ECFDF5] border-[#D1FAE5]">
                        <p className="text-[10px] uppercase font-bold text-emerald-700">Remaining Dues</p>
                        <p className="font-black text-base mt-0.5 text-emerald-700">₹0</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-between border-t border-[#F1F5F9] gap-2">
                      <span className="text-[11px] text-[#64748B]">
                        Status: <strong className="text-emerald-700">Full Access Active</strong>
                      </span>

                      <div className="flex items-center gap-2">
                        {matchingTx && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReceiptTx(matchingTx)}
                            className="h-8 px-2.5 text-xs font-bold border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F1EEFF] gap-1 cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </Button>
                        )}
                        <Button
                          asChild
                          size="sm"
                          className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold h-8 px-3 rounded-xl shadow-sm gap-1 cursor-pointer"
                        >
                          <Link href={`/student/online-courses/${onl.course_id}`}>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Go to Course</span>
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── Clean Payment History Section ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden space-y-0">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#5B21F4]" />
            <h3 className="font-extrabold text-[#111827] text-sm">
              Fee Payment History &amp; Receipts
            </h3>
          </div>

          {/* Radix Tabs for Transaction Format */}
          <Tabs value={txTab} onValueChange={(v) => setTxTab(v as any)}>
            <TabsList className="h-8 p-1">
              <TabsTrigger value="all" className="text-xs py-0.5 px-2.5 gap-1">
                <span>All Payments</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {transactions.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="offline" className="text-xs py-0.5 px-2.5 gap-1">
                <span>Offline</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {transactions.filter((t) => !t.is_online && t.course_format !== "online" && (t as any).tr_course_type !== "online" && !(t as any).tr_stco_id).length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="online" className="text-xs py-0.5 px-2.5 gap-1">
                <span>Online</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                  {transactions.filter((t) => Boolean(t.is_online || t.course_format === "online" || (t as any).tr_course_type === "online" || (t as any).tr_stco_id)).length}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
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
            <p className="text-xs">Any verified tuition installments or online course purchases will be listed here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">Tx ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Course &amp; Format</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Payment Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {transactions
                  .filter((tx) => {
                    const isOnline = Boolean(
                      tx.is_online ||
                      tx.course_format === "online" ||
                      (tx as any).tr_course_type === "online" ||
                      (tx as any).tr_stco_id
                    );
                    if (txTab === "offline") return !isOnline;
                    if (txTab === "online") return isOnline;
                    return true;
                  })
                  .map((tx) => {
                    const isOnline = Boolean(
                      tx.is_online ||
                      tx.course_format === "online" ||
                      (tx as any).tr_course_type === "online" ||
                      (tx as any).tr_stco_id
                    );
                    return (
                      <tr key={tx.transaction_id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#64748B]">
                          #{tx.transaction_id}
                        </td>
                        <td className="py-3.5 px-4 text-[#111827] whitespace-nowrap">
                          {tx.date || "—"}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-[#111827]">
                            {tx.course_name || "Enrolled Course"}
                          </p>
                          <span
                            className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                              isOnline
                                ? "bg-purple-100 text-[#5B21F4]"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {isOnline ? "Online Course" : "Offline Classroom"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                            {tx.mode || "razorpay"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#5B21F4] font-semibold">
                          {tx.payment_reference || "—"}
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
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedReceiptTx(tx)}
                              className="h-7 px-2.5 text-xs font-bold border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F1EEFF] gap-1 cursor-pointer"
                              title="View Receipt"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>View</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReceipt(tx, "pdf")}
                              disabled={downloadingReceiptTxId === tx.transaction_id}
                              className="h-7 w-7 p-0 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                              title="Download Official PDF Receipt"
                            >
                              {downloadingReceiptTxId === tx.transaction_id && downloadingReceiptFormat === "pdf" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadReceipt(tx, "image")}
                              disabled={downloadingReceiptTxId === tx.transaction_id}
                              className="h-7 w-7 p-0 text-xs font-bold text-[#5B21F4] hover:bg-[#F1EEFF] rounded-lg cursor-pointer"
                              title="Download Receipt Image (PNG)"
                            >
                              {downloadingReceiptTxId === tx.transaction_id && downloadingReceiptFormat === "image" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Official Printable Fee Receipt Modal (Compact & Proportional) ── */}
      <AnimatePresence>
        {selectedReceiptTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-md w-full p-4 sm:p-5 space-y-3 print:shadow-none print:border-none print:max-w-none print:w-full my-auto"
            >
              {/* Receipt Header */}
              <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold shadow-sm shrink-0"
                    style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
                  >
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-[#111827] leading-none">Brainzima</h2>
                    <p className="text-[10px] text-[#64748B] mt-0.5">Official Fee Payment Receipt</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedReceiptTx(null)}
                  className="p-1 rounded-lg text-[#94A3B8] hover:text-[#111827] hover:bg-[#F1F5F9] print:hidden cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Receipt Body */}
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <span className="text-[#94A3B8] text-[9px] uppercase font-bold">Student Name</span>
                    <p className="font-extrabold text-[#111827] text-xs mt-0.5 truncate">{selectedReceiptTx.student_name || name}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[9px] uppercase font-bold">Registration No.</span>
                    <p className="font-mono font-extrabold text-[#5B21F4] text-xs mt-0.5 truncate">
                      {selectedReceiptTx.registration_no || selectedReceiptTx.registration_number || sessionRegNo || "BISR-ONLINE"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[9px] uppercase font-bold">Transaction ID</span>
                    <p className="font-mono font-bold text-[#111827] text-[11px] mt-0.5">#{selectedReceiptTx.transaction_id}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[9px] uppercase font-bold">Payment Date</span>
                    <p className="font-bold text-[#111827] text-[11px] mt-0.5 truncate">{selectedReceiptTx.date}</p>
                  </div>
                </div>

                <div className="border border-[#E2E8F0] rounded-xl p-2.5 sm:p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Course Name:</span>
                    <span className="font-bold text-[#111827] truncate max-w-[200px] text-right">{selectedReceiptTx.course_name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Course Type:</span>
                    <span className="font-bold text-[#5B21F4]">
                      {selectedReceiptTx.is_online || selectedReceiptTx.course_format === "online"
                        ? "Online E-Learning Program"
                        : "Offline Classroom Diploma"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Enrollment ID:</span>
                    <span className="font-mono font-bold text-[#111827]">#{selectedReceiptTx.enrollment_id}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Payment Mode:</span>
                    <span className="font-bold uppercase text-[#111827]">{selectedReceiptTx.mode}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Reference Number:</span>
                    <span className="font-mono font-bold text-[#111827] truncate max-w-[160px]">{selectedReceiptTx.payment_reference || "N/A"}</span>
                  </div>

                  {/* Course Total Fee */}
                  {Number(selectedReceiptTx.total_fee || selectedReceiptTx.course_fee || selectedReceiptTx.summary?.total_fee || 0) > 0 && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Total Course Fee:</span>
                      <span className="font-bold text-[#111827]">
                        ₹{Number(selectedReceiptTx.total_fee || selectedReceiptTx.course_fee || selectedReceiptTx.summary?.total_fee || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Coupon Applied (if any) */}
                  {(selectedReceiptTx.coupon_code || selectedReceiptTx.summary?.coupon_code) && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B] flex items-center gap-1.5">
                        <span>Coupon:</span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-100 text-[#5B21F4] font-black text-[9px] uppercase border border-purple-200">
                          {selectedReceiptTx.coupon_code || selectedReceiptTx.summary?.coupon_code}
                        </span>
                      </span>
                      <span className="font-bold text-emerald-600">
                        -₹{Number(selectedReceiptTx.discount || selectedReceiptTx.discount_amount || selectedReceiptTx.coupon_discount || selectedReceiptTx.summary?.discount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Discount if present without coupon code */}
                  {!selectedReceiptTx.coupon_code && !selectedReceiptTx.summary?.coupon_code && Number(selectedReceiptTx.discount || selectedReceiptTx.summary?.discount || 0) > 0 && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Discount Applied:</span>
                      <span className="font-bold text-emerald-600">
                        -₹{Number(selectedReceiptTx.discount || selectedReceiptTx.summary?.discount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {selectedReceiptTx.remark && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Remark:</span>
                      <span className="text-[#111827] truncate max-w-[180px]">{selectedReceiptTx.remark}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 text-xs font-black">
                    <span className="text-[#111827]">Net Amount Paid:</span>
                    <span className="text-emerald-700 text-sm font-black">
                      ₹{Number(selectedReceiptTx.amount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>

                  {(selectedReceiptTx.is_online || selectedReceiptTx.course_format === "online") && (
                    <div className="flex justify-between items-center pt-0.5 text-[10px] text-slate-500">
                      <span>Remaining Dues:</span>
                      <span className="font-bold text-emerald-600">₹0.00 (Fully Cleared)</span>
                    </div>
                  )}
                </div>

                {/* Verification Stamp */}
                <div className="flex items-center justify-between p-2 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold">Computer Generated Official Receipt</span>
                  </div>
                  <span className="font-bold uppercase text-[9px]">Status: Verified</span>
                </div>
              </div>

              {/* Receipt Footer Actions: Close, Download Image, Download PDF */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1.5 print:hidden">
                <Button
                  variant="outline"
                  onClick={() => setSelectedReceiptTx(null)}
                  className="rounded-xl text-xs font-bold px-3.5 h-9 shrink-0 cursor-pointer"
                >
                  Close
                </Button>
                <div className="flex-1 flex items-center gap-2">
                  <Button
                    onClick={() => selectedReceiptTx && handleDownloadReceipt(selectedReceiptTx, "image")}
                    disabled={downloadingReceiptTxId === selectedReceiptTx?.transaction_id}
                    variant="outline"
                    className="flex-1 rounded-xl border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F5F3FF] text-xs font-bold gap-1.5 h-9 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                    title="Download high-resolution PNG receipt"
                  >
                    {downloadingReceiptTxId === selectedReceiptTx?.transaction_id && downloadingReceiptFormat === "image" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-3.5 h-3.5 text-[#5B21F4]" />
                        <span>Download Image</span>
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => selectedReceiptTx && handleDownloadReceipt(selectedReceiptTx, "pdf")}
                    disabled={downloadingReceiptTxId === selectedReceiptTx?.transaction_id}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white text-xs font-bold gap-1.5 shadow-md h-9 transition-all cursor-pointer active:scale-[0.98]"
                    title="Download official PDF document receipt"
                  >
                    {downloadingReceiptTxId === selectedReceiptTx?.transaction_id && downloadingReceiptFormat === "pdf" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-white" />
                        <span>Download PDF</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                        const dues = extractEnrollmentDues(enr, transactions);
                        setPayAmount(dues > 0 ? String(dues) : "");
                        setAmountError(null);
                      }}
                      disabled={isProcessingPayment}
                      className="mt-1 w-full h-11 px-3 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#111827] bg-white focus:outline-none focus:border-[#5B21F4]"
                    >
                      {enrollments.map((enr) => {
                        const dues = extractEnrollmentDues(enr, transactions);
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
