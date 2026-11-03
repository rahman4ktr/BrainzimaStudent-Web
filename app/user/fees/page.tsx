"use client";

import React from "react";
import { CreditCard, Receipt, Wallet, TrendingDown, Clock, ShieldCheck, CheckCircle2, Lock } from "lucide-react";
import GetPremiumLockedView from "@/components/user/GetPremiumLockedView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function UserFeesPage() {
  return (
    <GetPremiumLockedView
      title="Fee Details & Installments"
      badge="Financial Management"
      description="Track your course fee ledger, scholarship discounts, flexible installment schedule, and dues directly from your portal."
      icon={CreditCard}
      primaryCtaText="Browse Course Fees"
      benefits={[
        {
          title: "Transparent Fee Structure",
          desc: "Complete visibility of base fees, registration fees, GST, and exclusive scholarship discounts.",
          icon: TrendingDown,
        },
        {
          title: "Flexible 0% EMI Installments",
          desc: "Split payments into stress-free monthly installments with automatic due date reminders.",
          icon: Clock,
        },
        {
          title: "Instant Razorpay Checkout",
          desc: "Pay securely via UPI (Google Pay, PhonePe, Paytm), credit/debit cards, and NetBanking.",
          icon: Wallet,
        },
        {
          title: "Automated Ledger & Receipts",
          desc: "Live payment reconciliation with immediate issuance of GST-compliant digital receipts.",
          icon: ShieldCheck,
        },
      ]}
      previewContent={
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Total Course Fee
              </span>
              <p className="text-xl font-black text-[#5B21F4] mt-0.5">₹25,000</p>
              <span className="text-[10px] text-emerald-600 font-semibold">Scholarship Applied: -₹5,000</span>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Total Paid
              </span>
              <p className="text-xl font-black text-emerald-600 mt-0.5">₹10,000</p>
              <span className="text-[10px] text-slate-500">Initial Installment Settled</span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Pending Balance
              </span>
              <p className="text-xl font-black text-amber-600 mt-0.5">₹10,000</p>
              <span className="text-[10px] text-amber-700 font-semibold">Due in 1 Installment</span>
            </div>
          </div>

          {/* Schedule Table Preview */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
              Installment Payment Schedule
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="font-semibold text-slate-700">Installment #1 (Admission Fee)</span>
                </div>
                <span className="font-mono font-bold text-slate-900">₹10,000</span>
                <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Paid</Badge>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-slate-700">Installment #2 (Mid-Term)</span>
                </div>
                <span className="font-mono font-bold text-slate-900">₹10,000</span>
                <Button size="sm" className="h-6 px-2 text-[10px] bg-[#5B21F4] text-white" disabled>
                  Pay Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}
