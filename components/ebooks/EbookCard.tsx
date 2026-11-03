"use client";

import React from "react";
import {
  BookOpen,
  Calendar,
  Layers,
  User,
  FileText,
  Code2,
  Atom,
  Server,
  FileCode2,
  Database,
  Sparkles,
} from "lucide-react";
import { EbookRecord } from "@/lib/api";

interface EbookCardProps {
  ebook: EbookRecord;
  onReadPdf: (ebook: EbookRecord) => void;
}

// Convert long academic database titles into clean, concise book titles
function getCleanTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("python")) return "Python Data Science";
  if (t.includes("node") || t.includes("full stack")) return "Full Stack Node.js";
  if (t.includes("react")) return "React.js Patterns";
  if (t.includes("javascript")) return "JavaScript ES6+";
  if (t.includes("html")) return "HTML5 & Modern CSS3";
  if (t.includes("java") && !t.includes("script")) return "Java Algorithms";
  if (t.includes("cyber") || t.includes("security")) return "Cybersecurity Essentials";
  if (t.includes("cloud") || t.includes("aws")) return "AWS Cloud Computing";

  // Default: take part before colon or first 3 words
  const parts = title.split(":");
  if (parts.length > 0 && parts[0].trim().length < 35) {
    return parts[0].trim();
  }
  return title.slice(0, 30);
}

// Get short tech tag (Python, Node.js, React, JavaScript, HTML5)
function getTechTag(title: string, category?: string): string {
  const t = `${title} ${category || ""}`.toLowerCase();
  if (t.includes("python")) return "Python";
  if (t.includes("node") || t.includes("full stack")) return "Node.js";
  if (t.includes("react")) return "React.js";
  if (t.includes("javascript") || t.includes("js")) return "JavaScript";
  if (t.includes("html") || t.includes("css")) return "HTML5";
  if (t.includes("cyber")) return "Security";
  if (t.includes("cloud") || t.includes("aws")) return "AWS";
  return category?.split("&")[0].trim() || "Technology";
}

// Get concise 1-line subtitle
function getShortSubtitle(title: string, subtitle?: string): string {
  const t = title.toLowerCase();
  if (t.includes("python")) return "Data Tools & Analysis";
  if (t.includes("node") || t.includes("full stack")) return "REST APIs & Databases";
  if (t.includes("react")) return "Clean Code & Best Practices";
  if (t.includes("javascript")) return "Modern ES6+ Standards";
  if (t.includes("html")) return "Responsive Web Design";
  if (subtitle && subtitle.length > 0 && subtitle.length < 40) return subtitle;
  return "Verified Brainzima Guide";
}

export default function EbookCard({ ebook, onReadPdf }: EbookCardProps) {
  const cleanTitle = getCleanTitle(ebook.ebook_title);
  const techTag = getTechTag(ebook.ebook_title, ebook.category);
  const shortSubtitle = getShortSubtitle(ebook.ebook_title, ebook.ebook_subtitle);
  const theme = ebook.extra?.cover_style?.theme || "purple";

  // Render proportional 3D Book Cover preview
  const renderBookCover = () => {
    switch (theme) {
      case "python":
        return (
          <div className="relative w-full aspect-[1/1.3] rounded-xl overflow-hidden shadow-md bg-gradient-to-br from-[#1E293B] via-[#0F172A] to-[#1E3A8A] p-2.5 sm:p-3 flex flex-col justify-between text-white border border-sky-500/30">
            {/* Book Spine Crease on Left */}
            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/50 via-black/15 to-transparent pointer-events-none" />
            <div className="flex justify-between items-center z-10">
              <span className="text-[9px] font-bold tracking-widest text-sky-300 font-mono">
                PYTHON 3.12
              </span>
              <div className="w-5 h-5 rounded-md bg-sky-500/20 flex items-center justify-center text-sky-400">
                <Code2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-auto text-center z-10 px-1">
              <h4 className="font-black text-xs sm:text-sm leading-tight text-white drop-shadow">
                {cleanTitle}
              </h4>
              <p className="text-[9px] text-sky-200/80 mt-1 line-clamp-1">
                {shortSubtitle}
              </p>
            </div>
            <div className="text-[8px] font-medium text-slate-300 border-t border-slate-700/80 pt-1 z-10 flex items-center justify-between">
              <span className="truncate max-w-[80px]">{ebook.ebook_author}</span>
              <span>{ebook.extra?.pages || 548}p</span>
            </div>
          </div>
        );

      case "cyan":
        // React
        return (
          <div className="relative w-full aspect-[1/1.3] rounded-xl overflow-hidden shadow-md bg-gradient-to-br from-[#0F172A] via-[#0369A1] to-[#0284C7] p-2.5 sm:p-3 flex flex-col justify-between text-white border border-cyan-400/30">
            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/50 via-black/15 to-transparent pointer-events-none" />
            <div className="flex justify-between items-center z-10">
              <span className="text-[9px] font-bold tracking-widest text-cyan-200 font-mono">
                REACT 19
              </span>
              <div className="w-5 h-5 rounded-md bg-cyan-500/20 flex items-center justify-center text-cyan-300">
                <Atom className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-auto text-center z-10 px-1">
              <h4 className="font-black text-xs sm:text-sm leading-tight text-white drop-shadow">
                {cleanTitle}
              </h4>
              <p className="text-[9px] text-cyan-100/80 mt-1 line-clamp-1">
                {shortSubtitle}
              </p>
            </div>
            <div className="text-[8px] font-medium text-cyan-100/70 border-t border-cyan-500/30 pt-1 z-10 flex items-center justify-between">
              <span className="truncate max-w-[80px]">{ebook.ebook_author}</span>
              <span>{ebook.extra?.pages || 448}p</span>
            </div>
          </div>
        );

      case "yellow":
        // JavaScript
        return (
          <div className="relative w-full aspect-[1/1.3] rounded-xl overflow-hidden shadow-md bg-gradient-to-br from-[#1E293B] via-[#854D0E] to-[#EAB308] p-2.5 sm:p-3 flex flex-col justify-between text-white border border-amber-400/30">
            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/50 via-black/15 to-transparent pointer-events-none" />
            <div className="flex justify-between items-center z-10">
              <span className="text-[9px] font-bold tracking-widest text-amber-300 font-mono">
                ES6+ / JS
              </span>
              <div className="w-5 h-5 rounded-md bg-amber-400/20 font-black text-[10px] text-amber-300 flex items-center justify-center">
                JS
              </div>
            </div>
            <div className="my-auto text-center z-10 px-1">
              <h4 className="font-black text-xs sm:text-sm leading-tight text-white drop-shadow">
                {cleanTitle}
              </h4>
              <p className="text-[9px] text-amber-100/90 mt-1 line-clamp-1">
                {shortSubtitle}
              </p>
            </div>
            <div className="text-[8px] font-medium text-amber-100/70 border-t border-amber-500/30 pt-1 z-10 flex items-center justify-between">
              <span className="truncate max-w-[80px]">{ebook.ebook_author}</span>
              <span>{ebook.extra?.pages || 704}p</span>
            </div>
          </div>
        );

      case "aws":
      case "cyber":
      case "purple":
      default:
        // Full Stack Node.js / HTML5 / Database
        return (
          <div className="relative w-full aspect-[1/1.3] rounded-xl overflow-hidden shadow-md bg-gradient-to-br from-[#1E1B4B] via-[#4338CA] to-[#6366F1] p-2.5 sm:p-3 flex flex-col justify-between text-white border border-indigo-400/30">
            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/50 via-black/15 to-transparent pointer-events-none" />
            <div className="flex justify-between items-center z-10">
              <span className="text-[9px] font-bold tracking-widest text-indigo-200 font-mono uppercase">
                {techTag}
              </span>
              <div className="w-5 h-5 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                <Server className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="my-auto text-center z-10 px-1">
              <h4 className="font-black text-xs sm:text-sm leading-tight text-white drop-shadow">
                {cleanTitle}
              </h4>
              <p className="text-[9px] text-indigo-100/80 mt-1 line-clamp-1">
                {shortSubtitle}
              </p>
            </div>
            <div className="text-[8px] font-medium text-indigo-200/70 border-t border-indigo-400/20 pt-1 z-10 flex items-center justify-between">
              <span className="truncate max-w-[80px]">{ebook.ebook_author}</span>
              <span>{ebook.extra?.pages || 512}p</span>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Proportional 3D Book Cover on Top */}
        <div
          onClick={() => onReadPdf(ebook)}
          className="cursor-pointer mb-2.5 sm:mb-3 transform group-hover:scale-[1.02] transition-transform duration-200"
          title={`Click to read ${cleanTitle}`}
        >
          {renderBookCover()}
        </div>

        {/* Badges: [Free] and [Tech Tag] */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200/60">
            Free
          </span>
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[100px]">
            {techTag}
          </span>
        </div>

        {/* Clean Short Title */}
        <h3
          onClick={() => onReadPdf(ebook)}
          className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer leading-snug line-clamp-1 mb-0.5"
          title={ebook.ebook_title}
        >
          {cleanTitle}
        </h3>

        {/* 1-Line Short Subtitle */}
        <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mb-1">
          {shortSubtitle}
        </p>

        {/* Author */}
        <div className="flex items-center gap-1 text-[11px] text-slate-600 mb-2 truncate">
          <User className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="truncate">{ebook.ebook_author}</span>
        </div>
      </div>

      {/* Bottom Row: Meta & Read PDF Button */}
      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>{ebook.extra?.pages ? `${ebook.extra.pages} Pages` : "100+ Pages"}</span>
          <span>{ebook.ebook_edition || "2nd Ed."}</span>
        </div>

        {/* Read PDF Action Button */}
        <button
          type="button"
          onClick={() => onReadPdf(ebook)}
          className="w-full py-1.5 sm:py-2 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Read PDF</span>
        </button>
      </div>
    </div>
  );
}
