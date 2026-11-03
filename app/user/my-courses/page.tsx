"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Layers, Award, Clock, ArrowRight, Play, CheckCircle2, Users } from "lucide-react";
import GetPremiumLockedView from "@/components/user/GetPremiumLockedView";
import { useAuth } from "@/context/AuthContext";
import { getStudentEnrollments, type EnrollmentItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function UserMyCoursesPage() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkEnrollments() {
      if (!user?.user_id) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await getStudentEnrollments(Number(user.user_id));
        if (res.success && res.data) {
          const list = Array.isArray(res.data)
            ? res.data
            : (res.data as any).enrollments || [];
          setEnrollments(list);
        }
      } catch {
        setEnrollments([]);
      } finally {
        setIsLoading(false);
      }
    }
    checkEnrollments();
  }, [user]);

  // If user actually has enrolled courses, direct them to view their enrolled courses in /user/courses
  if (!isLoading && enrollments.length > 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-screen-xl mx-auto space-y-6">
        <div className="p-4 rounded-2xl bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">You have {enrollments.length} Active Enrolled Course(s)!</h2>
            <p className="text-xs text-purple-100 mt-0.5">Explore your syllabus, attendance and payments</p>
          </div>
          <Link href="/user/courses">
            <Button size="sm" className="bg-white text-[#5B21F4] font-bold hover:bg-white/90">
              Go to Courses Catalog & Enrolled
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <GetPremiumLockedView
      title="My Enrolled Courses"
      badge="Academic Curriculum"
      description="Access your enrolled academic programs, class schedules, live sessions, assignments, and certified curriculum roadmaps."
      icon={BookOpen}
      primaryCtaText="Browse All Courses"
      primaryCtaUrl="/user/courses"
      benefits={[
        {
          title: "Classroom & Online Live Batches",
          desc: "Assigned batch with fixed class schedules, faculty mentors, and hands-on lab access.",
          icon: Users,
        },
        {
          title: "Live Progress & Module Roadmap",
          desc: "Step-by-step topic completion tracking, project milestones, and weekly checkpoints.",
          icon: Layers,
        },
        {
          title: "1-on-1 Mentor Guidance",
          desc: "Direct access to senior software engineers and industry veterans for doubt clearing.",
          icon: Clock,
        },
        {
          title: "Certified Industry Credentials",
          desc: "Verified certificate of completion upon clearing assignments, assessments & final project.",
          icon: Award,
        },
      ]}
      previewContent={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#5B21F4] uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded">
                Active Batch
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                Enrolled
              </Badge>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#111827]">
                Full Stack Web Development (MERN)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Batch 2026-A • Mon, Wed, Fri (10:00 AM)</p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Course Progress</span>
                <span className="text-[#5B21F4]">42%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-[#5B21F4] h-2 rounded-full w-[42%]" />
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
              <span className="text-slate-500">Next Class: React Server Components</span>
              <span className="text-[#5B21F4] font-bold">View Syllabus &rarr;</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded">
                Hybrid Course
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                Enrolled
              </Badge>
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#111827]">
                Python Data Science & Generative AI
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Weekend Intensive • Sat & Sun (2:00 PM)</p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Course Progress</span>
                <span className="text-blue-600">28%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full w-[28%]" />
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
              <span className="text-slate-500">Next Class: PyTorch Neural Networks</span>
              <span className="text-blue-600 font-bold">View Syllabus &rarr;</span>
            </div>
          </div>
        </div>
      }
    />
  );
}
