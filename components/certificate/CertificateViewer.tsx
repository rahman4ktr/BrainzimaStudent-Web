"use client";

import React, { useRef } from "react";
import {
  Award,
  Download,
  Printer,
  Share2,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  QrCode,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { OnlineResultRecord } from "@/lib/api";

interface CertificateViewerProps {
  result: OnlineResultRecord;
  studentName?: string;
  registrationNumber?: string;
  onRetakeQuiz?: () => void;
}

export default function CertificateViewer({
  result,
  studentName,
  registrationNumber,
  onRetakeQuiz,
}: CertificateViewerProps) {
  const { toast } = useToast();
  const certRef = useRef<HTMLDivElement>(null);

  const displayName =
    result.st_name ||
    studentName ||
    "Student";

  const bisrId =
    result.st_regno ||
    registrationNumber ||
    (result.std_id ? `BISR${String(result.std_id).padStart(4, "0")}` : "BISR-STUDENT");

  const courseTitle = result.course_name || `Online Course #${result.course_id}`;
  const courseCode = result.course_code || "";

  const marksScored = Number(result.marks || 0);
  const percentage = result.extra?.percentage || Math.round((marksScored / 100) * 100);

  const grade =
    percentage >= 85
      ? "Outstanding (A+)"
      : percentage >= 70
      ? "Distinction (A)"
      : percentage >= 55
      ? "First Class (B)"
      : percentage >= 40
      ? "Pass (C)"
      : "Completed";

  const issueDate = result.created_at
    ? new Date(result.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  const certNumber = `BISR-CERT-${new Date(result.created_at || Date.now()).getFullYear()}-${String(
    result.result_id || 1001
  ).padStart(5, "0")}`;

  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(
    `https://student.brainzima.com/verify?cert=${certNumber}&reg=${bisrId}&marks=${marksScored}`
  )}&size=150&centerImageUrl=https://panel.brainzima.com/assets/img/logo-brainzima-icon.png`;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${displayName} - ${courseTitle} Certificate`,
        text: `I scored ${marksScored}/100 in ${courseTitle} at Brainzima Institute! Verified Certificate No: ${certNumber}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(
        `Verified Certificate No: ${certNumber} | ${displayName} scored ${marksScored}/100 in ${courseTitle} at Brainzima Institute of Skill Research.`
      );
      toast({
        variant: "success",
        title: "Link & Details Copied",
        description: "Certificate verification info copied to clipboard.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Control Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold"
            >
              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
              Verified Certificate
            </Badge>
            <span className="text-xs text-slate-400 font-mono">
              ID: {certNumber}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Score: <strong className="text-slate-900">{marksScored}/100</strong> ({percentage}%) • Grade: <strong className="text-slate-900">{grade}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onRetakeQuiz && result.extra?.attempt && result.extra.attempt < 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetakeQuiz}
              className="h-9 px-3.5 rounded-xl text-xs font-bold border-purple-200 text-[#5B21F4] hover:bg-purple-50"
            >
              Improve Score (Attempt {result.extra.attempt + 1}/3)
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="h-9 px-3.5 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5" />
            Share
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-md shadow-[#5B21F4]/20"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* ── PRINT-OPTIMIZED CERTIFICATE CONTAINER ── */}
      <div className="overflow-x-auto pb-4">
        <div
          ref={certRef}
          id="brainzima-certificate-node"
          className="relative w-full min-w-[800px] max-w-[1040px] mx-auto bg-[#FFFCF8] rounded-3xl p-8 sm:p-12 shadow-2xl border-8 border-double border-[#D4AF37] text-slate-800 overflow-hidden select-none print:m-0 print:p-8 print:shadow-none print:border-8 print:min-w-0 print:w-full"
          style={{
            backgroundImage:
              "radial-gradient(#F5E6CA 1px, transparent 1px), radial-gradient(#F5E6CA 1px, #FFFCF8 1px)",
            backgroundSize: "40px 40px",
            backgroundPosition: "0 0, 20px 20px",
          }}
        >
          {/* Inner Ornate Gold Border Line */}
          <div className="absolute inset-3 border-2 border-[#D4AF37]/50 rounded-2xl pointer-events-none" />
          <div className="absolute inset-5 border border-[#5B21F4]/20 rounded-xl pointer-events-none" />

          {/* Corner Flourish Accents */}
          <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-[#D4AF37] rounded-tl-xl pointer-events-none" />
          <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-[#D4AF37] rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-[#D4AF37] rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-[#D4AF37] rounded-br-xl pointer-events-none" />

          {/* Watermark Crest Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-4 pointer-events-none">
            <GraduationCap className="w-[500px] h-[500px] text-[#5B21F4]" />
          </div>

          <div className="relative z-10 text-center space-y-6 sm:space-y-7">
            {/* ── Institute Header ── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shadow-[#5B21F4]/30"
                  style={{
                    background:
                      "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)",
                  }}
                >
                  <GraduationCap className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] font-black tracking-widest text-[#5B21F4] uppercase block">
                    Govt. of India Recognized • ISO 9001:2015 Certified
                  </span>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight font-serif uppercase">
                    Brainzima Institute of Skill Research
                  </h1>
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-semibold tracking-wider uppercase">
                An Autonomous National Council for Technical Education &amp; Professional Skill Development
              </p>
            </div>

            {/* Gold Ribbon Divider */}
            <div className="flex items-center justify-center gap-3">
              <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
              <div className="w-3 h-3 rounded-full bg-[#D4AF37] rotate-45" />
              <div className="h-0.5 w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
            </div>

            {/* Certificate Title */}
            <div className="space-y-2">
              <span className="text-xs sm:text-sm font-bold tracking-widest text-amber-700 uppercase block">
                Official Certification of Competency
              </span>
              <h2
                className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight font-serif uppercase"
                style={{
                  background:
                    "linear-gradient(135deg, #7C3AED 0%, #5B21F4 50%, #1E1B4B 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Certificate of Excellence
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-600 italic">
                This certificate is proudly awarded to
              </p>
            </div>

            {/* Recipient Student Name */}
            <div className="space-y-1.5 py-1">
              <h3 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-slate-950 font-serif tracking-wide underline decoration-[#D4AF37]/60 underline-offset-8">
                {displayName}
              </h3>
              <div className="pt-2 flex items-center justify-center gap-4 text-xs text-slate-500 font-semibold">
                <span>Student ID / Roll No: <strong className="text-slate-800 font-mono">{bisrId}</strong></span>
              </div>
            </div>

            {/* Course & Performance Citation */}
            <div className="max-w-2xl mx-auto space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <p>
                for having successfully completed the curriculum and cleared the rigorous Comprehensive Online Assessment for the professional certification program:
              </p>
              <div className="py-1">
                <span className="inline-block text-base sm:text-xl font-black text-[#5B21F4] font-serif tracking-tight px-4 py-1.5 bg-[#F1EEFF] rounded-xl border border-[#DDD6FE]">
                  {courseTitle} {courseCode ? `(${courseCode})` : ""}
                </span>
              </div>
            </div>

            {/* Academic Performance Metrics Box */}
            <div className="max-w-lg mx-auto grid grid-cols-3 gap-2 sm:gap-4 p-3.5 rounded-2xl bg-white/90 border border-[#D4AF37]/40 shadow-xs text-center">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Marks Obtained
                </span>
                <span className="text-sm sm:text-base font-black text-slate-900">
                  {marksScored} / 100
                </span>
              </div>
              <div className="space-y-0.5 border-x border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Percentage
                </span>
                <span className="text-sm sm:text-base font-black text-[#5B21F4]">
                  {percentage}%
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Grade / Status
                </span>
                <span className="text-xs sm:text-sm font-black text-emerald-700">
                  {grade}
                </span>
              </div>
            </div>

            {/* Bottom Seals, QR Verification & Signatures */}
            <div className="pt-6 sm:pt-8 grid grid-cols-3 items-end gap-4 border-t border-[#D4AF37]/30">
              {/* Left: Controller of Examinations */}
              <div className="text-center space-y-2">
                <div className="h-10 flex items-center justify-center">
                  <span className="font-serif italic text-lg sm:text-xl text-slate-700 font-bold tracking-wider -rotate-2 select-none">
                    ExamController.BISR
                  </span>
                </div>
                <div className="w-32 sm:w-40 h-px bg-slate-400 mx-auto" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    Controller of Examinations
                  </span>
                  <span className="text-[10px] text-slate-400">
                    BISR Examination Wing
                  </span>
                </div>
              </div>

              {/* Center: Gold Foil Hologram Seal & QR Code */}
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="relative">
                  {/* Holographic Circular Seal */}
                  <div
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center text-center shadow-lg border-4 border-white/80 p-1"
                    style={{
                      background:
                        "radial-gradient(circle, #D4AF37 0%, #AA771C 60%, #85580F 100%)",
                      color: "#FFF8E7",
                    }}
                  >
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-[#FFF8E7]" />
                    <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter leading-tight mt-0.5">
                      OFFICIAL SEAL
                    </span>
                    <span className="text-[6px] sm:text-[7px] font-extrabold tracking-widest text-[#FFF8E7]/90">
                      VERIFIED
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <img
                    src={qrUrl}
                    alt="Certificate QR Verification"
                    className="w-12 h-12 rounded-lg border border-slate-300 p-0.5 bg-white shadow-xs"
                  />
                  <div className="text-left">
                    <span className="text-[8px] font-bold text-slate-400 uppercase block leading-tight">
                      Scan to Verify
                    </span>
                    <span className="text-[9px] font-black text-slate-800 font-mono block leading-tight">
                      {certNumber}
                    </span>
                    <span className="text-[8px] text-slate-500 font-medium block">
                      Issued: {issueDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Director / Academic Head */}
              <div className="text-center space-y-2">
                <div className="h-10 flex items-center justify-center">
                  <span className="font-serif italic text-lg sm:text-xl text-[#5B21F4] font-bold tracking-wider -rotate-3 select-none">
                    Dr. R. K. Sharma
                  </span>
                </div>
                <div className="w-32 sm:w-40 h-px bg-slate-400 mx-auto" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    Director of Academics
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Brainzima Skill Institute
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
