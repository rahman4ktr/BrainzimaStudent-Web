"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  GraduationCap,
  BookOpen,
  Crown,
  ChevronRight,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useEnrollmentRoute } from "@/hooks/useEnrollmentRoute";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

export interface BenefitItem {
  title: string;
  desc: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface GetPremiumLockedViewProps {
  title: string;
  badge?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  benefits: BenefitItem[];
  previewContent?: React.ReactNode;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
}

const sampleQuickCourses = [
  {
    id: 1,
    name: "MERN Full Stack Development",
    duration: "6 Months",
    mode: "Offline & Online",
    rating: "4.9",
    tag: "Most Popular",
  },
  {
    id: 2,
    name: "Python AI & Machine Learning",
    duration: "4 Months",
    mode: "Classroom",
    rating: "4.8",
    tag: "Trending",
  },
  {
    id: 3,
    name: "Cloud Computing & DevOps",
    duration: "5 Months",
    mode: "Hybrid",
    rating: "4.7",
    tag: "High Demand",
  },
];

export default function GetPremiumLockedView({
  title,
  badge = "Student Portal Feature",
  description,
  icon: IconComponent,
  benefits,
  previewContent,
  primaryCtaText = "Explore Courses to Unlock",
  primaryCtaUrl = "/user/courses",
}: GetPremiumLockedViewProps) {
  const { getEnrollmentUrl } = useEnrollmentRoute();

  return (
    <div className="p-3 sm:p-5 md:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-screen-xl mx-auto">
      {/* ── Page Header ── */}
      <motion.div {...fadeUp(0)} className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="bg-[#F1EEFF] text-[#5B21F4] border-[#DDD6FE] gap-1 px-2.5 py-0.5 text-xs font-semibold"
          >
            <Lock className="w-3 h-3 text-[#5B21F4]" />
            {badge}
          </Badge>
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80 flex items-center gap-1">
            <Crown className="w-3 h-3 text-amber-500" />
            Requires Course Enrollment
          </span>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white shadow-md shadow-[#5B21F4]/20 shrink-0"
                style={{
                  background: "linear-gradient(135deg, #5B21F4 0%, #7C3AED 55%, #2563EB 100%)",
                }}
              >
                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#111827] tracking-tight">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] mt-0.5 max-w-2xl">
                  {description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href={primaryCtaUrl}>
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white shadow-md shadow-[#5B21F4]/25 gap-1.5 cursor-pointer font-bold h-9 px-4 text-xs"
              >
                <span>{primaryCtaText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── Premium Hero Card ── */}
      <motion.div {...fadeUp(0.08)}>
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-[#5B21F4]/15 border border-white/20"
          style={{
            background: "linear-gradient(135deg, #1E1B4B 0%, #311042 50%, #111827 100%)",
          }}
        >
          {/* Decorative glowing blobs */}
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#5B21F4]/30 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 left-1/3 w-64 h-64 rounded-full bg-[#2563EB]/25 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-300 text-xs font-bold">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Get Full Student Access</span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight leading-snug">
                Unlock {title} & Your Complete Student Portal
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                You are currently logged in as a <strong>Prospective Student</strong>. You don’t have an active course enrollment yet. Once you enroll in any offline or online program, this feature and all your academic records will automatically unlock.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <Link href="/user/courses">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-[#5B21F4] via-[#7C3AED] to-[#2563EB] hover:opacity-95 text-white font-bold shadow-lg shadow-[#5B21F4]/40 h-11 px-6 text-sm gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Explore Courses to Unlock</span>
                </Button>
              </Link>
              <Link href="/user/online-courses">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold h-11 px-6 text-sm gap-2 backdrop-blur-md cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-indigo-300" />
                  <span>Browse Online Programs</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── What You Unlock Grid ── */}
      <motion.div {...fadeUp(0.12)} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#111827]">
              Included When You Unlock Student Access
            </h3>
            <p className="text-xs text-[#64748B]">
              Perks and resources activated instantly upon enrolling in any Brainzima course
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {benefits.map((benefit, idx) => {
            const BIcon = benefit.icon || CheckCircle2;
            return (
              <Card
                key={idx}
                className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-all duration-200 hover:border-[#DDD6FE] flex flex-col justify-between group"
              >
                <div className="space-y-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <BIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#111827] group-hover:text-[#5B21F4] transition-colors">
                      {benefit.title}
                    </h4>
                    <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                      {benefit.desc}
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-[#F1F5F9] flex items-center text-[11px] font-bold text-emerald-600 gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Unlocked with Course</span>
                </div>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* ── Interactive Feature Preview (Locked State) ── */}
      {previewContent && (
        <motion.div {...fadeUp(0.16)} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#5B21F4]" />
              <h3 className="text-base sm:text-lg font-bold text-[#111827]">
                Feature Preview (How Active Students See This)
              </h3>
            </div>
            <Badge variant="outline" className="text-[11px] font-medium bg-slate-50 text-slate-600">
              Sample Student View
            </Badge>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-[#E2E8F0] bg-white shadow-sm p-4 sm:p-6">
            {/* The actual preview UI */}
            <div className="select-none pointer-events-none opacity-80 filter blur-[0.8px]">
              {previewContent}
            </div>

            {/* Overlaid Lock Banner */}
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-white/95 backdrop-blur-xl border border-white/60 p-5 rounded-2xl shadow-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center shadow-inner">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#111827]">
                    Content Locked
                  </h4>
                  <p className="text-xs text-[#64748B] mt-1">
                    This section will populate with your live student data, files, and records as soon as you enroll in a course.
                  </p>
                </div>
                <Link href="/user/courses">
                  <Button
                    size="sm"
                    className="w-full bg-[#5B21F4] hover:bg-[#4C1BD4] text-white font-bold h-9 text-xs shadow-md shadow-[#5B21F4]/20 cursor-pointer"
                  >
                    <span>Enroll Now to Unlock</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Popular Programs Quick Enroll Bar ── */}
      <motion.div {...fadeUp(0.2)} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#111827]">
            Popular Courses to Get Started
          </h3>
          <Link
            href="/user/courses"
            className="text-xs font-bold text-[#5B21F4] hover:underline flex items-center gap-0.5"
          >
            <span>View All Courses</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sampleQuickCourses.map((c) => (
            <div
              key={c.id}
              className="p-3.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm flex items-center justify-between gap-3 hover:border-[#DDD6FE] transition-colors"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-[#5B21F4] uppercase tracking-wider">
                  {c.tag}
                </span>
                <p className="text-xs font-bold text-[#111827] truncate mt-0.5">
                  {c.name}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5">
                  <span>{c.duration}</span>
                  <span>•</span>
                  <span className="flex items-center text-amber-500 font-semibold gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {c.rating}
                  </span>
                </div>
              </div>
              <Link href={getEnrollmentUrl(c.id)}>
                <Button
                  size="sm"
                  className="bg-[#F1EEFF] hover:bg-[#5B21F4] text-[#5B21F4] hover:text-white font-bold text-xs h-8 px-3 shrink-0 transition-colors shadow-none cursor-pointer"
                >
                  Enroll
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
