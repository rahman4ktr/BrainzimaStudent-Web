"use client";

import React from "react";
import { FileText, Download, BookOpen, ExternalLink, Sparkles, FileCheck, Lock } from "lucide-react";
import GetPremiumLockedView from "@/components/user/GetPremiumLockedView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const sampleNotes = [
  {
    title: "Full Stack Architecture & RESTful API Best Practices",
    course: "MERN Stack",
    size: "4.2 MB",
    type: "PDF Document",
    date: "Updated Oct 2026",
  },
  {
    title: "React State Management: Redux Toolkit & Zustand Deep Dive",
    course: "Frontend Masterclass",
    size: "3.8 MB",
    type: "PDF Document",
    date: "Updated Sep 2026",
  },
  {
    title: "Python Machine Learning: Regression, Classification & Clustering",
    course: "AI & ML",
    size: "5.1 MB",
    type: "PDF Document",
    date: "Updated Oct 2026",
  },
  {
    title: "SQL Query Optimization & Indexing Strategies Cheatsheet",
    course: "Database Systems",
    size: "2.4 MB",
    type: "Cheatsheet",
    date: "Updated Aug 2026",
  },
];

export default function UserNotesPage() {
  return (
    <GetPremiumLockedView
      title="Notes & Materials"
      badge="Study Repository"
      description="Access comprehensive handwritten faculty notes, chapter-wise slides, interview cheatsheets, and lecture materials."
      icon={FileText}
      primaryCtaText="Enroll to Unlock Notes"
      benefits={[
        {
          title: "Handwritten Notes from Top Mentors",
          desc: "Carefully curated notes covering real-world patterns, tricky interview questions, and key formulas.",
          icon: FileText,
        },
        {
          title: "Downloadable PDF Summaries",
          desc: "Clean, high-resolution study guides that you can read offline, annotate, and print anytime.",
          icon: Download,
        },
        {
          title: "Interview Cheatsheets",
          desc: "Condensed rapid-revision sheets for system design, data structures, algorithms, and frameworks.",
          icon: Sparkles,
        },
        {
          title: "Updated with Latest Releases",
          desc: "Notes are regularly refreshed every semester to stay aligned with current industry tools and versions.",
          icon: BookOpen,
        },
      ]}
      previewContent={
        <div className="space-y-3">
          <div className="p-3 bg-purple-50/70 border border-purple-200/60 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-[#5B21F4]">
              42 Available Notes for Enrolled Students
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Filter by Course: All (Active)
            </span>
          </div>

          <div className="space-y-2">
            {sampleNotes.map((note, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#5B21F4] flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#111827] truncate">
                      {note.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span className="text-[#5B21F4] font-semibold">{note.course}</span>
                      <span>•</span>
                      <span>{note.type} ({note.size})</span>
                      <span>•</span>
                      <span>{note.date}</span>
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs gap-1.5 border-slate-200 text-slate-400 shrink-0"
                  disabled
                >
                  <Lock className="w-3 h-3" />
                  <span>Download</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
