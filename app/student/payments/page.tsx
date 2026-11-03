"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt,
  Download,
  CheckCircle2,
  Calendar,
  Building2,
  GraduationCap,
  ShieldCheck,
  Search,
  Filter,
  X,
  AlertCircle,
  FileCheck2,
  Loader2,
  ImageIcon,
  FileText,
} from "lucide-react";
import { useStudent } from "@/hooks/useStudent";
import {
  getStudentFees,
  getStudentOnlineCourses,
  getCurrentStudent,
  FeeTransactionItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatIstDateTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { downloadReceiptAsImage, downloadReceiptAsPdf } from "@/lib/receiptDownload";

export default function StudentPaymentsPage() {
  const { user_id, registration_number, name, isLoading: isStudentLoading } = useStudent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FeeTransactionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "offline" | "online">("all");
  const [selectedTx, setSelectedTx] = useState<FeeTransactionItem | null>(null);
  const [downloadingTxId, setDownloadingTxId] = useState<number | string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<"image" | "pdf" | null>(null);
  const { toast } = useToast();

  const loadPayments = useCallback(async () => {
    if (!user_id) return;
    setLoading(true);
    setError(null);

    try {
      const [feeRes, onlRes, stMeRes] = await Promise.allSettled([
        getStudentFees(user_id),
        getStudentOnlineCourses(user_id, "student"),
        getCurrentStudent(user_id),
      ]);

      let txList: FeeTransactionItem[] = [];

      // 1. Process Offline Transactions from backend
      if (feeRes.status === "fulfilled" && feeRes.value.success && feeRes.value.data) {
        if (Array.isArray(feeRes.value.data)) {
          txList = [...feeRes.value.data];
        } else if (Array.isArray((feeRes.value.data as any).transactions)) {
          txList = [...(feeRes.value.data as any).transactions];
        }
      } else if (feeRes.status === "fulfilled" && !feeRes.value.success) {
        setError(feeRes.value.message || "Failed to load payment transaction history.");
      }

      // 2. Process Online Courses Purchases
      const onlineMap = new Map<number, any>();
      if (onlRes.status === "fulfilled" && onlRes.value.success && Array.isArray(onlRes.value.data)) {
        onlRes.value.data.forEach((c) => {
          onlineMap.set(Number(c.course_id), c);
        });
      }

      if (stMeRes.status === "fulfilled" && stMeRes.value.success && Array.isArray(stMeRes.value.data?.online_courses)) {
        stMeRes.value.data.online_courses.forEach((c: any) => {
          const cId = Number(c.course_id ?? c.stco_course_id);
          if (cId && !onlineMap.has(cId)) {
            onlineMap.set(cId, c);
          }
        });
      }

      for (const onl of onlineMap.values()) {
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
        const discountAmt = Number(onl.discount || onl.discount_amount || 0);
        const coupon = onl.coupon_code || onl.summary?.coupon_code || undefined;
        const paidAmt = Number(onl.amount_paid ?? onl.initial_payment ?? Math.max(0, originalFee - discountAmt));

        if (!alreadyInTx) {
          txList.push({
            transaction_id: onl.stco_id || 900000 + Number(onl.course_id),
            tr_id: onl.stco_id || 900000 + Number(onl.course_id),
            enrollment_id: onl.stco_id || onl.course_id,
            stco_id: onl.stco_id || onl.course_id,
            tr_stco_id: onl.stco_id || onl.course_id,
            tr_course_type: "online",
            student_id: Number(user_id) || 0,
            registration_no: onl.registration_number || registration_number || "BISR-ONLINE",
            student_name: onl.student_name || name || "Student",
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
            date: onl.created_at || onl.purchased_at ? formatIstDateTime(onl.created_at || onl.purchased_at) : "",
            tr_date: onl.created_at || onl.purchased_at ? formatIstDateTime(onl.created_at || onl.purchased_at) : "",
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
    } catch {
      setError("Network error while connecting to payment ledger database.");
    } finally {
      setLoading(false);
    }
  }, [user_id]);

  useEffect(() => {
    if (!isStudentLoading && user_id) {
      loadPayments();
    } else if (!isStudentLoading && !user_id) {
      setLoading(false);
    }
  }, [user_id, isStudentLoading, loadPayments]);

  const filtered = transactions.filter((t) => {
    const isOnline = Boolean(
      t.is_online ||
      t.course_format === "online" ||
      (t as any).tr_course_type === "online" ||
      (t as any).tr_stco_id
    );
    if (activeTab === "offline" && isOnline) return false;
    if (activeTab === "online" && !isOnline) return false;

    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const ref = (t.payment_reference || "").toLowerCase();
    const remark = (t.remark || "").toLowerCase();
    const course = (t.course_name || "").toLowerCase();
    const mode = (t.mode || "").toLowerCase();
    const amt = String(t.amount || "");
    const txId = String(t.transaction_id || "");
    return (
      ref.includes(q) ||
      remark.includes(q) ||
      course.includes(q) ||
      mode.includes(q) ||
      amt.includes(q) ||
      txId.includes(q)
    );
  });

  const offlineCount = transactions.filter(
    (t) =>
      !t.is_online &&
      t.course_format !== "online" &&
      (t as any).tr_course_type !== "online" &&
      !(t as any).tr_stco_id
  ).length;
  const onlineCount = transactions.filter((t) =>
    Boolean(
      t.is_online ||
      t.course_format === "online" ||
      (t as any).tr_course_type === "online" ||
      (t as any).tr_stco_id
    )
  ).length;

  const handleDownloadReceipt = async (
    tx: FeeTransactionItem,
    format: "image" | "pdf" = "pdf"
  ) => {
    if (downloadingTxId) return;
    setDownloadingTxId(tx.transaction_id);
    setDownloadingFormat(format);

    try {
      const receiptData = {
        transaction_id: tx.transaction_id,
        student_name: tx.student_name || name || "Student",
        registration_no: tx.registration_no || registration_number || "BISR-STUDENT",
        date: tx.date || "—",
        course_name: tx.course_name || "Enrolled Program",
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
      console.error("[StudentPayments] Receipt download error:", err);
      toast({
        variant: "error",
        title: "Download Issue",
        description: `Could not export receipt as ${format.toUpperCase()}. Please try again.`,
      });
    } finally {
      setDownloadingTxId(null);
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
            <span className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
              Official Invoices
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Payment Receipts &amp; History
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Verified academic payment records, transaction references, and printable fee receipts for both offline and online courses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search ref, course, tx ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-11 text-xs rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* ── Error Notice ── */}
      {!loading && error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-red-800">{error}</p>
          <button
            onClick={loadPayments}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry Loading Payments
          </button>
        </div>
      )}

      {/* ── Receipts Table ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#2563EB]" />
            <span className="font-extrabold text-[#111827] text-sm">
              All Verified Payment Transactions
            </span>
          </div>

          {/* Radix Tabs for Filtering Receipts */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="h-8 p-1">
              <TabsTrigger value="all" className="text-xs py-0.5 px-2.5 gap-1">
                <span>All Receipts</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {transactions.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="offline" className="text-xs py-0.5 px-2.5 gap-1">
                <span>Offline Center</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {offlineCount}
                </span>
              </TabsTrigger>
              <TabsTrigger value="online" className="text-xs py-0.5 px-2.5 gap-1">
                <span>Online Courses</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                  {onlineCount}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border-b border-[#F1F5F9]">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filtered.length === 0 && (
          <div className="p-16 text-center text-[#64748B] space-y-3">
            <Receipt className="w-12 h-12 text-[#CBD5E1] mx-auto" />
            <h3 className="text-base font-bold text-[#111827]">
              {searchTerm
                ? `No transactions match "${searchTerm}"`
                : activeTab === "offline"
                ? "No offline course payments found."
                : activeTab === "online"
                ? "No online course purchases found."
                : "No payment transactions found."}
            </h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              {searchTerm
                ? "Try searching for a different payment reference or clear the search filter."
                : "Fee transactions and receipts will appear here after your course payments."}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-xs text-[#2563EB] font-bold hover:underline cursor-pointer"
              >
                Clear search filter
              </button>
            )}
          </div>
        )}

        {/* Transactions Table Body */}
        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Transaction ID</th>
                  <th className="py-3.5 px-4">Date &amp; Time</th>
                  <th className="py-3.5 px-4">Course &amp; Type</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Mode</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Reference</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filtered.map((tx) => {
                  const isOnline = Boolean(
                    tx.is_online ||
                    tx.course_format === "online" ||
                    (tx as any).tr_course_type === "online" ||
                    (tx as any).tr_stco_id
                  );
                  return (
                    <tr
                      key={tx.transaction_id}
                      className="hover:bg-[#F8FAFC]/80 transition-colors"
                    >
                      <td className="py-4 px-4 sm:px-6 font-mono font-bold text-[#64748B]">
                        #{tx.transaction_id}
                      </td>

                      <td className="py-4 px-4 text-[#111827] whitespace-nowrap">
                        {tx.date || "—"}
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-bold text-[#111827]">
                          {tx.course_name || "Enrolled Course"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              isOnline
                                ? "bg-purple-100 text-[#5B21F4]"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {isOnline ? "Online Course" : "Offline Classroom"}
                          </span>
                          <span className="text-[10px] text-[#64748B]">
                            #{tx.enrollment_id}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 hidden sm:table-cell">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                          {tx.mode || "UPI"}
                        </span>
                      </td>

                      <td className="py-4 px-4 hidden md:table-cell font-mono text-[11px] text-[#64748B]">
                        {tx.payment_reference || "—"}
                      </td>

                      <td className="py-4 px-4 text-right font-black text-emerald-700 text-sm">
                        ₹{Number(tx.amount || 0).toLocaleString("en-IN")}
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTx(tx)}
                            className="text-xs font-bold border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F1EEFF] gap-1 cursor-pointer h-8 px-2.5"
                            title="View Receipt"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>View</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadReceipt(tx, "pdf")}
                            disabled={downloadingTxId === tx.transaction_id}
                            className="text-xs font-bold text-red-600 hover:bg-red-50 p-2 h-8 w-8 rounded-lg cursor-pointer"
                            title="Download Official PDF Receipt"
                          >
                            {downloadingTxId === tx.transaction_id && downloadingFormat === "pdf" ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileText className="w-3.5 h-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadReceipt(tx, "image")}
                            disabled={downloadingTxId === tx.transaction_id}
                            className="text-xs font-bold text-[#5B21F4] hover:bg-[#F1EEFF] p-2 h-8 w-8 rounded-lg cursor-pointer"
                            title="Download Receipt Image (PNG)"
                          >
                            {downloadingTxId === tx.transaction_id && downloadingFormat === "image" ? (
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

      {/* ── Printable Fee Receipt Modal (Compact & Proportional) ── */}
      <AnimatePresence>
        {selectedTx && (
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
                  onClick={() => setSelectedTx(null)}
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
                    <p className="font-extrabold text-[#111827] text-xs mt-0.5 truncate">{selectedTx.student_name || name}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[9px] uppercase font-bold">Registration No.</span>
                    <p className="font-mono font-extrabold text-[#5B21F4] text-xs mt-0.5 truncate">
                      {selectedTx.registration_no || registration_number || "BISR-ONLINE"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[9px] uppercase font-bold">Transaction ID</span>
                    <p className="font-mono font-bold text-[#111827] text-[11px] mt-0.5">#{selectedTx.transaction_id}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[9px] uppercase font-bold">Payment Date</span>
                    <p className="font-bold text-[#111827] text-[11px] mt-0.5 truncate">{selectedTx.date}</p>
                  </div>
                </div>

                <div className="border border-[#E2E8F0] rounded-xl p-2.5 sm:p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Course Name:</span>
                    <span className="font-bold text-[#111827] truncate max-w-[200px] text-right">{selectedTx.course_name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Course Type:</span>
                    <span className="font-bold text-[#5B21F4]">
                      {selectedTx.is_online || selectedTx.course_format === "online"
                        ? "Online E-Learning Program"
                        : "Offline Classroom Diploma"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Enrollment ID:</span>
                    <span className="font-mono font-bold text-[#111827]">#{selectedTx.enrollment_id}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Payment Mode:</span>
                    <span className="font-bold uppercase text-[#111827]">{selectedTx.mode}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Reference Number:</span>
                    <span className="font-mono font-bold text-[#111827] truncate max-w-[160px]">{selectedTx.payment_reference || "N/A"}</span>
                  </div>

                  {/* Course Total Fee */}
                  {Number(selectedTx.total_fee || selectedTx.course_fee || selectedTx.summary?.total_fee || 0) > 0 && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Total Course Fee:</span>
                      <span className="font-bold text-[#111827]">
                        ₹{Number(selectedTx.total_fee || selectedTx.course_fee || selectedTx.summary?.total_fee || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Coupon Applied (if any) */}
                  {(selectedTx.coupon_code || selectedTx.summary?.coupon_code) && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B] flex items-center gap-1.5">
                        <span>Coupon:</span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-100 text-[#5B21F4] font-black text-[9px] uppercase border border-purple-200">
                          {selectedTx.coupon_code || selectedTx.summary?.coupon_code}
                        </span>
                      </span>
                      <span className="font-bold text-emerald-600">
                        -₹{Number(selectedTx.discount || selectedTx.discount_amount || selectedTx.coupon_discount || selectedTx.summary?.discount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Discount if present without coupon code */}
                  {!selectedTx.coupon_code && !selectedTx.summary?.coupon_code && Number(selectedTx.discount || selectedTx.summary?.discount || 0) > 0 && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Discount Applied:</span>
                      <span className="font-bold text-emerald-600">
                        -₹{Number(selectedTx.discount || selectedTx.summary?.discount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {selectedTx.remark && (
                    <div className="flex justify-between items-center pb-1.5 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Remark:</span>
                      <span className="text-[#111827] truncate max-w-[180px]">{selectedTx.remark}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 text-xs font-black">
                    <span className="text-[#111827]">Net Amount Paid:</span>
                    <span className="text-emerald-700 text-sm font-black">
                      ₹{Number(selectedTx.amount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>

                  {(selectedTx.is_online || selectedTx.course_format === "online") && (
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
                  onClick={() => setSelectedTx(null)}
                  className="rounded-xl text-xs font-bold px-3.5 h-9 shrink-0 cursor-pointer"
                >
                  Close
                </Button>
                <div className="flex-1 flex items-center gap-2">
                  <Button
                    onClick={() => selectedTx && handleDownloadReceipt(selectedTx, "image")}
                    disabled={downloadingTxId === selectedTx.transaction_id}
                    variant="outline"
                    className="flex-1 rounded-xl border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F5F3FF] text-xs font-bold gap-1.5 h-9 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                    title="Download high-resolution PNG receipt"
                  >
                    {downloadingTxId === selectedTx.transaction_id && downloadingFormat === "image" ? (
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
                    onClick={() => selectedTx && handleDownloadReceipt(selectedTx, "pdf")}
                    disabled={downloadingTxId === selectedTx.transaction_id}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white text-xs font-bold gap-1.5 shadow-md h-9 transition-all cursor-pointer active:scale-[0.98]"
                    title="Download official PDF document receipt"
                  >
                    {downloadingTxId === selectedTx.transaction_id && downloadingFormat === "pdf" ? (
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
    </div>
  );
}

