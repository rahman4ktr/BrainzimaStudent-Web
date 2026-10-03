"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt,
  Download,
  Printer,
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
} from "lucide-react";
import { useStudent } from "@/hooks/useStudent";
import { getStudentFees, FeeTransactionItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentPaymentsPage() {
  const { user_id, registration_number, name, isLoading: isStudentLoading } = useStudent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<FeeTransactionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTx, setSelectedTx] = useState<FeeTransactionItem | null>(null);

  const loadPayments = useCallback(async () => {
    if (!user_id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getStudentFees(user_id);
      if (res.success && res.data) {
        const txList = Array.isArray(res.data)
          ? res.data
          : Array.isArray((res.data as any).transactions)
          ? (res.data as any).transactions
          : [];
        setTransactions(txList);
      } else {
        setError(res.message || "Failed to load payment transaction history.");
      }
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

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
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
            Verified academic payment records, transaction references, and printable fee receipts.
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
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#2563EB]" />
            <span className="font-extrabold text-[#111827] text-sm">
              All Verified Payment Transactions
            </span>
          </div>
          <span className="text-xs text-[#64748B] font-semibold">
            {transactions.length} Verified {transactions.length === 1 ? "Record" : "Records"}
          </span>
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
              {searchTerm ? `No transactions match "${searchTerm}"` : "No payment transactions found."}
            </h3>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              {searchTerm
                ? "Try searching for a different payment reference or clear the search filter."
                : "Fee transactions will be catalogued here after your initial installment or admission payment."}
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
                  <th className="py-3.5 px-4">Course &amp; Enrollment</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Mode</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Reference</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filtered.map((tx) => (
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
                      <p className="text-[10px] text-[#64748B]">
                        Enrollment #{tx.enrollment_id}
                      </p>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTx(tx)}
                        className="text-xs font-bold border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F1EEFF] gap-1 cursor-pointer"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>View</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Printable Fee Receipt Modal ── */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:p-0 print:bg-white">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 print:shadow-none print:border-none print:max-w-none print:w-full"
            >
              {/* Receipt Header */}
              <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold shadow-md shrink-0"
                    style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
                  >
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#111827]">Brainzima</h2>
                    <p className="text-[11px] text-[#64748B]">Official Fee Payment Receipt</p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#111827] hover:bg-[#F1F5F9] print:hidden cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Receipt Body */}
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                  <div>
                    <span className="text-[#94A3B8] text-[10px] uppercase font-bold">Student Name</span>
                    <p className="font-extrabold text-[#111827] text-sm mt-0.5">{selectedTx.student_name || name}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[10px] uppercase font-bold">Registration No.</span>
                    <p className="font-mono font-extrabold text-[#5B21F4] text-sm mt-0.5">
                      {selectedTx.registration_no || registration_number || `ST-${selectedTx.student_id}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[10px] uppercase font-bold">Transaction ID</span>
                    <p className="font-mono font-bold text-[#111827] mt-0.5">#{selectedTx.transaction_id}</p>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] text-[10px] uppercase font-bold">Payment Date</span>
                    <p className="font-bold text-[#111827] mt-0.5">{selectedTx.date}</p>
                  </div>
                </div>

                <div className="border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Course Name:</span>
                    <span className="font-bold text-[#111827]">{selectedTx.course_name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Enrollment ID:</span>
                    <span className="font-mono font-bold text-[#111827]">#{selectedTx.enrollment_id}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Payment Mode:</span>
                    <span className="font-bold uppercase text-[#111827]">{selectedTx.mode}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Reference Number:</span>
                    <span className="font-mono font-bold text-[#111827]">{selectedTx.payment_reference || "N/A"}</span>
                  </div>
                  {selectedTx.remark && (
                    <div className="flex justify-between items-center pb-2 border-b border-[#F1F5F9]">
                      <span className="text-[#64748B]">Remark:</span>
                      <span className="text-[#111827]">{selectedTx.remark}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 text-sm font-black">
                    <span className="text-[#111827]">Amount Paid:</span>
                    <span className="text-emerald-700 text-base">
                      ₹{Number(selectedTx.amount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Verification Stamp */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold">Computer Generated Official Receipt</span>
                  </div>
                  <span className="font-bold uppercase">Status: Verified</span>
                </div>
              </div>

              {/* Receipt Footer Action */}
              <div className="flex items-center gap-3 pt-2 print:hidden">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTx(null)}
                  className="flex-1 rounded-xl text-xs font-bold"
                >
                  Close
                </Button>
                <Button
                  onClick={handlePrint}
                  className="flex-1 rounded-xl bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold gap-2 shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
