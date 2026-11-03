"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, Play, BookOpen, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCourseImageUrl } from "@/lib/session";

export interface CourseCardProps {
  courseId: number;
  courseCode?: string;
  courseName: string;
  courseImgPath?: string | null;
  courseDuration?: string | null;
  courseValidity?: string | null;
  courseFee: number | string;
  courseType?: string;
  isEnrolled?: boolean;
  href: string;
  isOnline?: boolean;
  onBuy?: () => void;
}

export default function CourseCard({
  courseId,
  courseCode,
  courseName,
  courseImgPath,
  courseDuration = "12 Months",
  courseValidity = "Lifetime",
  courseFee,
  courseType = "Online",
  isEnrolled = false,
  href,
  isOnline = true,
  onBuy,
}: CourseCardProps) {
  const [imageError, setImageError] = useState(false);

  const feeNum = Number(courseFee || 0);
  // Calculate a realistic MRP / Original Fee (approx 30-40% higher)
  const originalFee = feeNum > 0 ? Math.round((feeNum * 1.35) / 100) * 100 : 0;
  const discountPercent = feeNum > 0 ? Math.round(((originalFee - feeNum) / originalFee) * 100) : 0;

  const resolvedImageUrl = getCourseImageUrl(courseImgPath);

  return (
    <div className="w-full flex flex-col justify-between rounded-2xl bg-white border border-[#E2E8F0] overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 group">
      {/* ── Banner Image Container (Exact Khan Global Studies UX) ── */}
      <div className="relative aspect-[16/9] w-full bg-slate-900 overflow-hidden shrink-0">
        {resolvedImageUrl && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedImageUrl}
            alt={courseName}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center p-4 text-white text-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #1E1B4B 0%, #311042 55%, #0B3B82 100%)",
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-1">
              {isOnline ? <Play className="w-5 h-5 text-white" /> : <GraduationCap className="w-5 h-5 text-white" />}
            </div>
            <span className="text-[10px] font-mono text-purple-200 uppercase tracking-wider">
              {courseCode || "BRAINZIMA"}
            </span>
            <p className="text-xs font-black text-white line-clamp-1 max-w-[85%] mt-0.5">
              {courseName}
            </p>
          </div>
        )}

        {/* ── Top-Left "🔴 Online" Badge (Pixel-perfect to user image) ── */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600/95 backdrop-blur-sm text-white font-extrabold text-[10px] sm:text-[11px] shadow-sm tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>{isOnline ? "Online" : "Classroom"}</span>
        </div>

        {/* Top-Right "Enrolled" Badge (if applicable) */}
        {isEnrolled && (
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-600/95 backdrop-blur-sm text-white font-extrabold text-[10px] shadow-sm">
            <CheckCircle2 className="w-3 h-3" />
            <span>Enrolled</span>
          </div>
        )}
      </div>

      {/* ── Card Content Body ── */}
      <div className="p-4 flex flex-col justify-between flex-1 gap-3">
        {/* Title */}
        <div>
          <Link href={href}>
            <h3 className="text-sm sm:text-base font-black text-[#111827] line-clamp-2 leading-snug group-hover:text-[#5B21F4] transition-colors min-h-[2.5rem]">
              {courseName}
            </h3>
          </Link>
        </div>

        {/* Schedule / Validity Row */}
        <div className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            {courseDuration || "12 Months"} {courseValidity ? `• ${courseValidity}` : ""}
          </span>
        </div>

        {/* Price Row (Matches User Image) */}
        <div className="pt-2 border-t border-slate-100 flex items-baseline gap-2">
          <span className="text-base sm:text-lg font-black text-[#111827]">
            ₹ {feeNum.toLocaleString("en-IN")}
          </span>
          {originalFee > feeNum && (
            <span className="text-xs text-slate-400 line-through">
              ₹ {originalFee.toLocaleString("en-IN")}
            </span>
          )}
          {discountPercent > 0 && (
            <span className="text-xs font-black text-rose-600">
              {discountPercent}% OFF
            </span>
          )}
        </div>

        {/* Action Buttons: Explore & Buy Now (Matches User Image) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link href={href} className="w-full">
            <Button
              variant="outline"
              className="w-full h-9 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Explore
            </Button>
          </Link>

          {isEnrolled ? (
            <Link href={href} className="w-full">
              <Button className="w-full h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer">
                Start Learning
              </Button>
            </Link>
          ) : (
            <Link href={href} className="w-full">
              <Button
                onClick={onBuy}
                className="w-full h-9 rounded-xl text-xs font-black bg-[#0B3B82] hover:bg-[#072B60] text-white shadow-xs cursor-pointer"
              >
                Buy Now
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

