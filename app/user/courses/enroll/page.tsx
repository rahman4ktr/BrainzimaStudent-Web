"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CourseEnrollmentView } from "@/components/CourseEnrollmentView";

export default function UserCoursesEnrollPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-[#5B21F4] animate-spin mx-auto mb-2" />
            <p className="text-xs font-bold text-[#64748B]">Loading Course Enrollment...</p>
          </div>
        </div>
      }
    >
      <CourseEnrollmentView portalType="user" />
    </Suspense>
  );
}
