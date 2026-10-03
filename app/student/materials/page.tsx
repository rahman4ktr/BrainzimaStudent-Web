"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  FileText,
  Download,
  ExternalLink,
  Search,
  BookOpen,
  Filter,
  AlertCircle,
  FileCode,
  FileArchive,
  Layers,
} from "lucide-react";
import { useStudent } from "@/hooks/useStudent";
import { getStudentNotes, StudyNoteItem } from "@/lib/api";
import { getFileUrl } from "@/lib/session";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentMaterialsPage() {
  const { user_id, isLoading: isStudentLoading } = useStudent();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<StudyNoteItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");

  const loadMaterials = async () => {
    if (!user_id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getStudentNotes(user_id);
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).notes || [];
        setMaterials(list);
      } else {
        setError(res.message || "Failed to load study materials.");
      }
    } catch {
      setError("Network error connecting to study repository server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isStudentLoading && user_id) {
      loadMaterials();
    } else if (!isStudentLoading && !user_id) {
      setLoading(false);
    }
  }, [user_id, isStudentLoading]);

  // Extract unique courses for filtering
  const courses = Array.from(
    new Set(materials.map((m) => m.course_name).filter(Boolean))
  ) as string[];

  const filtered = materials.filter((item) => {
    const q = search.toLowerCase();
    const titleMatch = (item.notes_title || "").toLowerCase().includes(q);
    const descMatch = (item.notes_description || "").toLowerCase().includes(q);
    const courseMatch =
      selectedCourse === "all" || item.course_name === selectedCourse;
    return (titleMatch || descMatch) && courseMatch;
  });

  const getDocType = (filePath?: string) => {
    if (!filePath) return "Document";
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "PDF Document";
    if (ext === "zip" || ext === "rar") return "Archive";
    if (ext === "doc" || ext === "docx") return "Word Document";
    return "Reference Resource";
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#08A66A] animate-pulse" />
            <span className="text-xs font-bold text-[#08A66A] uppercase tracking-wider">
              Learning Resources
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Study Materials
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Official curriculum modules, documentation, and digital handouts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11 text-xs rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* ── Course Filter Badges ── */}
      {courses.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCourse("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCourse === "all"
                ? "bg-[#111827] text-white"
                : "bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            All Courses ({materials.length})
          </button>
          {courses.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCourse(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCourse === c
                  ? "bg-[#5B21F4] text-white"
                  : "bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Error Banner ── */}
      {!loading && error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-red-800">{error}</p>
          <button
            onClick={loadMaterials}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry Loading Materials
          </button>
        </div>
      )}

      {/* ── Skeleton Loading Table ── */}
      {loading && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 border-b border-[#F1F5F9]">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-60" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="p-16 text-center text-[#64748B] bg-white rounded-2xl border border-[#E2E8F0] space-y-3">
          <FolderOpen className="w-12 h-12 mx-auto text-[#CBD5E1]" />
          <h3 className="text-base font-bold text-[#111827]">
            {search ? `No study materials match "${search}"` : "No study materials available."}
          </h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            {search
              ? "Try changing your keyword or selecting a different course filter."
              : "Course handouts and practical material files will appear here once published by faculty."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs text-[#5B21F4] font-bold hover:underline cursor-pointer"
            >
              Reset search filter
            </button>
          )}
        </div>
      )}

      {/* ── Materials Table / List ── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Material Title &amp; Description</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Course</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Type</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Path / Filename</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filtered.map((item) => {
                  const fileUrl = getFileUrl(item.notes_pdf);
                  const docType = getDocType(item.notes_pdf);
                  const filename = item.notes_pdf ? item.notes_pdf.split("/").pop() : "File";

                  return (
                    <tr
                      key={item.notes_id}
                      className="hover:bg-[#F8FAFC]/80 transition-colors group"
                    >
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#08A66A] border border-[#A7F3D0] flex items-center justify-center shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-[#111827] text-sm">
                              {item.notes_title}
                            </p>
                            <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">
                              {item.notes_description || "Study material notes & syllabus guide."}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 hidden md:table-cell">
                        <Badge variant="blue" className="text-[10px]">
                          {item.course_name || "General Course"}
                        </Badge>
                      </td>

                      <td className="py-4 px-4 hidden sm:table-cell">
                        <span className="text-[11px] font-semibold text-[#475569] bg-[#F1F5F9] px-2 py-1 rounded-md">
                          {docType}
                        </span>
                      </td>

                      <td className="py-4 px-4 hidden lg:table-cell">
                        <span className="text-[11px] font-mono text-[#64748B] truncate max-w-xs block">
                          {item.notes_pdf || "—"}
                        </span>
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right">
                        {fileUrl ? (
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-xs font-bold text-[#475569] hover:bg-[#F1EEFF] hover:text-[#5B21F4] hover:border-[#DDD6FE] transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">View</span>
                            </a>
                            <a
                              href={fileUrl}
                              download={filename}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5B21F4] text-white text-xs font-bold hover:bg-[#4C1BD4] transition-colors"
                              title="Download resource"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Download</span>
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-[#94A3B8] italic">No file link</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
