"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Search,
  BookOpen,
  ExternalLink,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { useStudent } from "@/hooks/useStudent";
import { getStudentNotes, StudyNoteItem } from "@/lib/api";
import { getFileUrl } from "@/lib/session";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentNotesPage() {
  const { user_id, isLoading: isStudentLoading } = useStudent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<StudyNoteItem[]>([]);
  const [search, setSearch] = useState("");

  const loadNotes = async () => {
    if (!user_id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getStudentNotes(user_id);
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).notes || [];
        setNotes(list);
      } else {
        setError(res.message || "Unable to load study notes.");
      }
    } catch {
      setError("Network error while connecting to notes repository.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isStudentLoading && user_id) {
      loadNotes();
    } else if (!isStudentLoading && !user_id) {
      setLoading(false);
    }
  }, [user_id, isStudentLoading]);

  const filtered = notes.filter((n) => {
    const q = search.toLowerCase();
    const title = (n.notes_title || "").toLowerCase();
    const desc = (n.notes_description || "").toLowerCase();
    const cName = (n.course_name || "").toLowerCase();
    return title.includes(q) || desc.includes(q) || cName.includes(q);
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#5B21F4] animate-pulse" />
            <span className="text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
              Academic Repository
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Notes &amp; Materials
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Course lecture notes, PDF guides, and reference handouts for your enrolled courses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search notes, topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 text-xs rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {!loading && error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-red-800">{error}</p>
          <button
            onClick={loadNotes}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry Loading Notes
          </button>
        </div>
      )}

      {/* ── Skeleton Loading Grid ── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="w-24 h-5 rounded-full" />
              </div>
              <Skeleton className="w-3/4 h-5 rounded" />
              <Skeleton className="w-full h-12 rounded" />
              <Skeleton className="w-full h-9 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="p-16 text-center text-[#64748B] bg-white rounded-2xl border border-[#E2E8F0] space-y-3">
          <BookOpen className="w-12 h-12 mx-auto text-[#CBD5E1]" />
          <h3 className="text-base font-bold text-[#111827]">
            {search ? `No notes match "${search}"` : "No study notes available."}
          </h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            {search
              ? "Try searching with a different term or clear the filter."
              : "Instructors have not uploaded notes for your enrolled courses yet. Please check back later."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs text-[#5B21F4] font-bold hover:underline cursor-pointer"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* ── Notes Grid ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((note) => {
            const pdfUrl = getFileUrl(note.notes_pdf);

            return (
              <motion.div
                key={note.notes_id}
                whileHover={{ y: -3 }}
                className="bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#DDD6FE] hover:shadow-lg hover:shadow-[#5B21F4]/5 transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center shrink-0 border border-[#DDD6FE]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <Badge variant="blue" className="text-[10px]">
                      {note.course_name || "Enrolled Course"}
                    </Badge>
                  </div>

                  <h3 className="font-extrabold text-[#111827] text-base mb-1.5 leading-snug line-clamp-1">
                    {note.notes_title}
                  </h3>

                  <p className="text-xs text-[#64748B] leading-relaxed line-clamp-3 mb-4">
                    {note.notes_description || "Comprehensive lecture notes and study material."}
                  </p>

                  {/* PDF Path info */}
                  {note.notes_pdf && (
                    <div className="mb-4 p-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[10px] text-[#64748B] truncate font-mono">
                      File: {note.notes_pdf.split("/").pop()}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#F1F5F9] flex items-center gap-2">
                  {pdfUrl ? (
                    <>
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs font-bold gap-1.5 border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F1EEFF]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View PDF
                        </Button>
                      </a>
                      <a
                        href={pdfUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          size="sm"
                          className="bg-[#5B21F4] text-white hover:bg-[#4C1BD4] text-xs font-bold gap-1.5 px-3"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    </>
                  ) : (
                    <span className="text-xs text-[#94A3B8] italic">No document link</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
