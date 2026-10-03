"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  UserCircle2,
  Sparkles,
  ArrowRight,
  Play,
  Star,
  TrendingUp,
  Bell,
  CheckCircle2,
  Clock,
  Zap,
  GraduationCap,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { useEnrollmentRoute } from "@/hooks/useEnrollmentRoute";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

const featuredCourses = [
  {
    id: 1,
    name: "MERN Full Stack Development",
    instructor: "Rahul Sharma",
    duration: "6 Months",
    lectures: 120,
    rating: 4.9,
    color: "#5B21F4",
    bg: "#F1EEFF",
    tag: "Most Popular",
    tagColor: "#5B21F4",
    tagBg: "#F1EEFF",
  },
  {
    id: 2,
    name: "Python AI & Machine Learning",
    instructor: "Priya Nair",
    duration: "4 Months",
    lectures: 90,
    rating: 4.8,
    color: "#08A66A",
    bg: "#ECFDF5",
    tag: "Trending",
    tagColor: "#08A66A",
    tagBg: "#ECFDF5",
  },
  {
    id: 3,
    name: "Cloud & DevOps Engineering",
    instructor: "Vikram Mehta",
    duration: "5 Months",
    lectures: 100,
    rating: 4.7,
    color: "#2563EB",
    bg: "#EFF6FF",
    tag: "New",
    tagColor: "#2563EB",
    tagBg: "#EFF6FF",
  },
];

const proFeatures = [
  { icon: TrendingUp, label: "Advanced Analytics", desc: "Track your learning progress with detailed insights" },
  { icon: Zap, label: "AI Mock Tests", desc: "AI-powered assessments tailored to your level" },
  { icon: GraduationCap, label: "Certificate Programs", desc: "Industry-recognised certificates on completion" },
  { icon: BookOpen, label: "Unlimited Materials", desc: "Access all notes, PDFs and recorded sessions" },
];

const steps = [
  { step: "01", label: "Create Your Profile", desc: "Fill in your personal & academic details", done: true },
  { step: "02", label: "Browse Courses", desc: "Explore our catalogue and pick a course", done: false },
  { step: "03", label: "Enroll & Pay Fees", desc: "Secure enrollment with easy fee payment", done: false },
  { step: "04", label: "Start Learning", desc: "Access your Student Portal & begin classes", done: false },
];

export default function UserDashboardPage() {
  const { getEnrollmentUrl } = useEnrollmentRoute();
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-screen-xl mx-auto">

      {/* ── Welcome Banner ── */}
      <motion.div {...fadeUp(0)}>
        <div
          className="relative overflow-hidden rounded-2xl p-5 md:p-8"
          style={{ background: "linear-gradient(135deg, #5B21F4 0%, #7C3AED 50%, #2563EB 100%)" }}
        >
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute top-6 right-24 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute -bottom-10 left-1/4 w-36 h-36 rounded-full bg-black/10" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                <span className="text-xs font-semibold text-white/90">Account Active</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                Welcome back, Ajit! 👋
              </h2>
              <p className="mt-2 text-sm text-white/75 max-w-md">
                You&apos;re one step away from becoming a student. Browse our courses and enroll to unlock your full Student Portal.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:items-end">
              <Link
                href="/user/courses"
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-[#5B21F4] text-sm font-bold hover:bg-white/95 transition-all shadow-lg shadow-black/20 whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                Explore Courses
              </Link>
              <Link
                href="/user/profile"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/15 transition-all whitespace-nowrap"
              >
                <UserCircle2 className="w-4 h-4" />
                Complete Profile
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Getting Started Steps ── */}
      <motion.div {...fadeUp(0.1)}>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#111827]">Getting Started</h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Complete these steps to activate your Student Portal</p>
            </div>
            <span className="text-xs font-bold text-[#5B21F4] bg-[#F1EEFF] px-2.5 py-1 rounded-full">1/4 done</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#F1F5F9]">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className={`p-4 flex items-start gap-3 ${s.done ? "bg-[#FAFFFC]" : ""}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-extrabold ${
                    s.done
                      ? "bg-[#ECFDF5] text-[#08A66A] border border-[#D1FAE5]"
                      : "bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]"
                  }`}
                >
                  {s.done ? <CheckCircle2 className="w-4 h-4" /> : s.step}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${s.done ? "text-[#08A66A]" : "text-[#111827]"}`}>{s.label}</p>
                  <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Main Grid: Featured Courses + Pro Banner ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">

        {/* Featured Courses */}
        <motion.div {...fadeUp(0.2)} className="xl:col-span-2">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">Featured Courses</h3>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">Explore our top-rated programs</p>
              </div>
              <Link href="/user/courses" className="flex items-center gap-1.5 text-xs font-bold text-[#5B21F4] hover:underline">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-[#F8FAFC]">
              {featuredCourses.map((course, i) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  className="px-5 py-4 hover:bg-[#FAFAFF] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: course.bg, color: course.color }}
                    >
                      <BookOpen className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-[#111827]">{course.name}</h4>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: course.tagBg, color: course.tagColor }}
                            >
                              {course.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] mt-0.5">by {course.instructor}</p>
                        </div>
                        <Link
                          href={getEnrollmentUrl(course.id)}
                          className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                          style={{ background: `linear-gradient(135deg, ${course.color}, #2563EB)` }}
                        >
                          Enroll <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>

                      <div className="mt-2 flex items-center gap-3 text-[11px] text-[#64748B]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {course.duration}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {course.lectures} lectures
                        </span>
                        <span className="flex items-center gap-1 text-[#F59E0B] font-semibold">
                          <Star className="w-3.5 h-3.5 fill-[#F59E0B]" />
                          {course.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Pro Features Card */}
        <motion.div {...fadeUp(0.3)}>
          <div
            className="rounded-2xl overflow-hidden h-full flex flex-col"
            style={{ background: "linear-gradient(160deg, #5B21F4 0%, #7C3AED 50%, #2563EB 100%)" }}
          >
            <div className="p-5 flex-1 relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
              <div className="absolute -bottom-6 left-1/4 w-24 h-24 rounded-full bg-black/10" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white leading-none">Pro Features</p>
                    <p className="text-[10px] text-white/60 mt-0.5">Unlock everything</p>
                  </div>
                </div>

                <p className="text-[11px] text-white/75 leading-relaxed mb-4">
                  Unlock advanced analytics, mock tests & AI study tools.
                </p>

                <div className="space-y-2.5">
                  {proFeatures.map((f, i) => (
                    <motion.div
                      key={f.label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.07 }}
                      className="flex items-start gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                        <f.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-none">{f.label}</p>
                        <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">{f.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10">
              <button className="w-full py-2.5 rounded-xl bg-white text-[#5B21F4] text-sm font-bold hover:bg-white/95 transition-all shadow-lg shadow-black/20 cursor-pointer">
                Unlock Pro Features →
              </button>
              <p className="text-center text-[10px] text-white/50 mt-2">Enroll in any course to activate</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Recent Notifications ── */}
      <motion.div {...fadeUp(0.4)}>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9]">
            <h3 className="text-sm font-bold text-[#111827]">Recent Notifications</h3>
            <Bell className="w-4 h-4 text-[#94A3B8]" />
          </div>
          <div className="divide-y divide-[#F8FAFC]">
            {[
              { text: "Your account has been activated successfully.", time: "1h ago", icon: CheckCircle2, color: "#08A66A", bg: "#ECFDF5" },
              { text: "New course: Python AI & Machine Learning is now available.", time: "3h ago", icon: BookOpen, color: "#5B21F4", bg: "#F1EEFF" },
              { text: "Complete your profile to improve your portal experience.", time: "1d ago", icon: UserCircle2, color: "#2563EB", bg: "#EFF6FF" },
            ].map((n, i) => (
              <div key={i} className="px-5 py-3.5 flex items-start gap-3 hover:bg-[#FAFAFF] transition-colors">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: n.bg, color: n.color }}
                >
                  <n.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#111827] leading-relaxed">{n.text}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="h-4" />
    </div>
  );
}
