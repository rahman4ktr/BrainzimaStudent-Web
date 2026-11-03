"use client";

import React from "react";
import { QrCode, ShieldCheck, Printer, Calendar, GraduationCap, Award, CheckCircle2 } from "lucide-react";
import GetPremiumLockedView from "@/components/user/GetPremiumLockedView";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";

export default function UserIdCardPage() {
  const { user } = useAuth();
  const displayName = user?.name || "Student Name";

  return (
    <GetPremiumLockedView
      title="Digital Student ID Card"
      badge="Identity Pass"
      description="Every enrolled Brainzima student is issued an official, digitally verifiable ID card with a unique BISR number and high-resolution QR code."
      icon={QrCode}
      primaryCtaText="Enroll to Get Student ID"
      benefits={[
        {
          title: "Official BISR Student ID",
          desc: "Permanent academic registration number recognized across all centers and portal services.",
          icon: ShieldCheck,
        },
        {
          title: "QuickChart Scannable QR",
          desc: "Instant identity verification by instructors, invigilators, and center managers.",
          icon: QrCode,
        },
        {
          title: "Campus & Exam Hall Pass",
          desc: "Mandatory valid admission credential for in-person workshops, classrooms & exams.",
          icon: GraduationCap,
        },
        {
          title: "Printable & Downloadable PDF",
          desc: "One-click high-resolution PDF download and direct color printing.",
          icon: Printer,
        },
      ]}
      previewContent={
        <div className="max-w-md mx-auto">
          {/* Mockup Card */}
          <div className="rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-md bg-white">
            <div
              className="p-4 text-white flex items-center justify-between"
              style={{
                background: "linear-gradient(135deg, #1E1B4B 0%, #311042 55%, #111827 100%)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#5B21F4] flex items-center justify-center text-white">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-black tracking-tight leading-none">Brainzima</p>
                  <p className="text-[9px] font-bold tracking-widest text-[#DDD6FE] uppercase">
                    Student ID Pass
                  </p>
                </div>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-mono text-[10px]">
                BISR-XXXX
              </Badge>
            </div>

            <div className="p-5 flex items-center gap-4">
              <div className="w-20 h-24 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                <GraduationCap className="w-8 h-8 opacity-40" />
                <span className="text-[9px] font-medium mt-1">Photo</span>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Full Name
                  </span>
                  <p className="text-sm font-extrabold text-[#111827] truncate">{displayName}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Course Enrolled
                  </span>
                  <p className="text-xs font-semibold text-[#5B21F4] truncate">
                    MERN Full Stack Development
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1">
                  <span>Batch: 2026</span>
                  <span>•</span>
                  <span>Center: Main Campus</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
                <QrCode className="w-10 h-10 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      }
    />
  );
}
