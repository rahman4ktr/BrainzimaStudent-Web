"use client";

import React from "react";
import { Receipt, Download, Printer, CheckCircle2, ShieldCheck, FileCheck2, Lock, Calendar } from "lucide-react";
import GetPremiumLockedView from "@/components/user/GetPremiumLockedView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const sampleReceipts = [
  {
    receiptNo: "BISR-REC-2026-00412",
    amount: "₹10,000",
    method: "UPI / Razorpay",
    date: "15 Oct 2026",
    status: "Verified",
    description: "Initial Course Admission Fee",
  },
  {
    receiptNo: "BISR-REC-2026-00109",
    amount: "₹5,000",
    method: "Debit Card",
    date: "01 Sep 2026",
    status: "Verified",
    description: "Registration & Seat Confirmation",
  },
];

export default function UserPaymentsPage() {
  return (
    <GetPremiumLockedView
      title="Payments & Receipts"
      badge="Billing & Ledger"
      description="Access your payment receipts, official GST-compliant tax invoices, and verified settlement records."
      icon={Receipt}
      primaryCtaText="Enroll to Get Receipts"
      benefits={[
        {
          title: "Official GST Tax Invoices",
          desc: "Valid invoices formatted for personal filing, education allowances, and company reimbursements.",
          icon: Receipt,
        },
        {
          title: "Downloadable PDF Receipts",
          desc: "Digitally signed Brainzima receipts containing complete student and transaction details.",
          icon: Download,
        },
        {
          title: "Complete Transaction Log",
          desc: "Detailed ledger records with Razorpay order IDs, timestamps, payment modes, and bank references.",
          icon: ShieldCheck,
        },
        {
          title: "Printable Hardcopy Layout",
          desc: "Clean printable format optimized for direct color or monochrome printer outputs.",
          icon: Printer,
        },
      ]}
      previewContent={
        <div className="space-y-3">
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">
              Payment Invoices Repository
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Reconciliation: 100% Verified
            </span>
          </div>

          <div className="space-y-2">
            {sampleReceipts.map((rcpt, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[#111827] font-mono">
                        {rcpt.receiptNo}
                      </p>
                      <Badge className="bg-emerald-100 text-emerald-700 text-[9px] py-0">
                        {rcpt.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {rcpt.description} • {rcpt.method} • {rcpt.date}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-black text-slate-900">{rcpt.amount}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs gap-1 border-slate-200 text-slate-400"
                    disabled
                  >
                    <Lock className="w-3 h-3" />
                    <span>PDF</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
