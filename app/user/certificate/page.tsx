"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Loader2,
  Calendar,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";
import { getOnlineResults, type OnlineResultRecord } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import CertificateViewer from "@/components/certificate/CertificateViewer";
import CourseQuizModal from "@/components/quiz/CourseQuizModal";

export default function UserCertificatePage() {
  const router = useRouter();
  const session = getSession();

  const [results, setResults] = useState<OnlineResultRecord[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Retake modal state
  const [retakeModalOpen, setRetakeModalOpen] = useState<boolean>(false);

  const currentUserId = session?.user_id ? Number(session.user_id) : undefined;
  const currentStudentId = session?.student_id ? Number(session.student_id) : undefined;
  const currentUserRole = (session?.role as "user" | "student") || "user";
  const studentName = session?.name || "Student";
  const registrationNumber = session?.registration_number || undefined;

  const loadResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getOnlineResults(
        {
          std_id: currentStudentId,
          user_id: currentUserId,
        },
        currentUserId,
        currentUserRole,
        currentStudentId
      );

      if (res.success && res.data && Array.isArray(res.data.results)) {
        // Filter only passed results (marks >= 40)
        const validResults = res.data.results.filter(
          (r: OnlineResultRecord) => Number(r.marks || 0) >= 40
        );
        setResults(validResults);
        if (validResults.length > 0) {
          setSelectedResultIndex(0);
        }
      } else {
        setResults([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load certificates.");
    } finally {
      setIsLoading(false);
    }
  }, [currentStudentId, currentUserId, currentUserRole]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const activeResult = results[selectedResultIndex] || null;

  return (
    <div className="space-y-6 sm:space-y-8 pb-16">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F1EEFF] text-[#5B21F4] text-xs font-bold border border-[#DDD6FE]">
              <Award className="w-3.5 h-3.5 text-[#5B21F4]" />
              Official Credentials
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111827] tracking-tight">
            Verified Certificates
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B]">
            Official course completion credentials and quiz test assessment records.
          </p>
        </div>

        <Link href="/user/online-courses">
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl text-xs font-bold border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F1EEFF]"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Online Courses &amp; Quizzes
          </Button>
        </Link>
      </div>

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="p-16 rounded-3xl bg-white border border-[#E2E8F0] text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#5B21F4] mx-auto" />
          <p className="text-xs font-semibold text-[#64748B]">
            Verifying examination records &amp; loading certificates...
          </p>
        </div>
      )}

      {/* ── EMPTY STATE (User has not given quiz test yet) ── */}
      {!isLoading && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 sm:p-14 rounded-3xl bg-gradient-to-br from-white via-[#FAF5FF] to-[#F0FDF4] border border-[#DDD6FE] text-center space-y-6 shadow-sm max-w-2xl mx-auto"
        >
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center shadow-lg shadow-[#5B21F4]/15">
            <Award className="w-10 h-10 stroke-[2]" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#5B21F4] bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              Examination Required
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
              No Certificate Earned Yet
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
              Official Brainzima certificates are awarded upon passing the comprehensive online quiz examination (50 questions • 100 marks, minimum 40% to pass). You have up to <strong>3 chances</strong> per course.
            </p>
          </div>

          {/* Guidelines bullet points */}
          <div className="bg-white/80 rounded-2xl p-4 border border-[#E2E8F0] text-left text-xs text-[#475569] space-y-2 max-w-md mx-auto">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>50 Random questions per examination attempt</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>2 Marks per question (Total 100 Marks)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Instant evaluation with Government-recognized certificate</span>
            </div>
          </div>

          <div>
            <Link href="/user/online-courses">
              <Button className="h-11 px-6 rounded-2xl font-bold text-xs sm:text-sm bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-lg shadow-[#5B21F4]/25">
                <span>Go to Online Courses &amp; Take Quiz</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── POPULATED STATE (Has completed quiz & earned certificates) ── */}
      {!isLoading && results.length > 0 && activeResult && (
        <div className="space-y-6">
          {/* If student has multiple certificates, render course selection tabs */}
          {results.length > 1 && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {results.map((r, idx) => (
                <button
                  key={r.result_id || idx}
                  type="button"
                  onClick={() => setSelectedResultIndex(idx)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer border ${
                    selectedResultIndex === idx
                      ? "bg-[#5B21F4] text-white border-[#5B21F4] shadow-md shadow-[#5B21F4]/20"
                      : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>{r.course_name || `Course #${r.course_id}`}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/20 font-mono">
                    {r.marks}M
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Certificate Viewer Component */}
          <CertificateViewer
            result={activeResult}
            studentName={studentName}
            registrationNumber={registrationNumber}
            onRetakeQuiz={() => setRetakeModalOpen(true)}
          />
        </div>
      )}

      {/* ── Retake Quiz Modal ── */}
      {activeResult && (
        <CourseQuizModal
          isOpen={retakeModalOpen}
          onClose={() => setRetakeModalOpen(false)}
          courseId={activeResult.course_id}
          courseName={activeResult.course_name || "Online Course"}
          courseCode={activeResult.course_code}
          currentUserId={currentUserId}
          currentStudentId={currentStudentId}
          currentUserRole={currentUserRole}
          studentName={studentName}
          registrationNumber={registrationNumber}
          existingResult={activeResult}
          onQuizCompleted={() => {
            loadResults();
          }}
        />
      )}
    </div>
  );
}
