"use client";

import React, { useState } from "react";
import {
  Code,
  Monitor,
  Terminal,
  Layers,
  BookOpen,
  PlayCircle,
  Sparkles,
  Laptop,
  GraduationCap,
} from "lucide-react";

interface CourseThumbnailProps {
  src?: string | null;
  alt: string;
  courseCode?: string;
  courseName: string;
  isOnline?: boolean;
  theme?: {
    color?: string;
    bg?: string;
    border?: string;
  };
}

export default function CourseThumbnail({
  src,
  alt,
  courseCode = "",
  courseName,
  isOnline = false,
  theme,
}: CourseThumbnailProps) {
  const [imageError, setImageError] = useState(false);

  // If a valid image URL is provided and has not errored, render it
  if (src && !imageError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        onError={() => setImageError(true)}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
    );
  }

  const upperCode = (courseCode || "").toUpperCase();
  const upperName = (courseName || "").toUpperCase();

  // ── 1. Web Development (DWD / WEB / FULL STACK) ──
  if (upperCode.includes("DWD") || upperCode.includes("WEB") || upperName.includes("WEB")) {
    return (
      <div
        className="w-full h-full relative overflow-hidden flex flex-col justify-between p-3 select-none group-hover:scale-105 transition-transform duration-300"
        style={{
          background:
            "linear-gradient(135deg, #0A0F1D 0%, #0F172A 35%, #1E3A8A 75%, #2563EB 100%)",
        }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-blue-500/20 blur-xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-indigo-500/20 blur-xl pointer-events-none" />

        {/* Window controls bar */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 opacity-80">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          </div>
          <span className="text-[9px] font-mono tracking-wider text-blue-200/90 font-bold uppercase">
            HTML &bull; CSS &bull; JS
          </span>
        </div>

        {/* Center Graphic */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto py-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-500/25 border border-blue-400/40 backdrop-blur-md flex items-center justify-center text-blue-300 shadow-lg shadow-blue-950/40 mb-1.5">
            <Code className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-[11px] sm:text-xs font-black text-white text-center tracking-tight line-clamp-1 max-w-[90%]">
            Web Development
          </p>
        </div>

        {/* Bottom Tagline */}
        <div className="relative z-10 flex items-center justify-between text-[9px] text-blue-200/80 font-mono">
          <span>&lt;/&gt; Frontend &amp; Web</span>
          <span className="font-bold text-white/90">Diploma</span>
        </div>
      </div>
    );
  }

  // ── 2. Computer Applications (ADCA / DCA / IT) ──
  if (
    upperCode.includes("ADCA") ||
    upperCode.includes("DCA") ||
    upperName.includes("COMPUTER") ||
    upperName.includes("APPLICATION")
  ) {
    return (
      <div
        className="w-full h-full relative overflow-hidden flex flex-col justify-between p-3 select-none group-hover:scale-105 transition-transform duration-300"
        style={{
          background:
            "linear-gradient(135deg, #022C22 0%, #064E3B 35%, #047857 75%, #059669 100%)",
        }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-emerald-400/20 blur-xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-teal-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 opacity-80">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          </div>
          <span className="text-[9px] font-mono tracking-wider text-emerald-200/90 font-bold uppercase">
            Office &bull; Tally &bull; IT
          </span>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center my-auto py-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/25 border border-emerald-400/40 backdrop-blur-md flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-950/40 mb-1.5">
            <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-[11px] sm:text-xs font-black text-white text-center tracking-tight line-clamp-1 max-w-[90%]">
            Computer Applications
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[9px] text-emerald-200/80 font-mono">
          <span>Adv. Diploma</span>
          <span className="font-bold text-white/90">Certified</span>
        </div>
      </div>
    );
  }

  // ── 3. Full Stack MERN ──
  if (upperCode.includes("MERN") || upperName.includes("FULL STACK")) {
    return (
      <div
        className="w-full h-full relative overflow-hidden flex flex-col justify-between p-3 select-none group-hover:scale-105 transition-transform duration-300"
        style={{
          background:
            "linear-gradient(135deg, #1E1B4B 0%, #2E1065 40%, #5B21F4 75%, #7C3AED 100%)",
        }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-purple-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 opacity-80">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          </div>
          <span className="text-[9px] font-mono tracking-wider text-purple-200 font-bold uppercase">
            React &bull; Node &bull; Mongo
          </span>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center my-auto py-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-purple-500/25 border border-purple-400/40 backdrop-blur-md flex items-center justify-center text-purple-200 shadow-lg mb-1.5">
            <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-[11px] sm:text-xs font-black text-white text-center tracking-tight line-clamp-1 max-w-[90%]">
            Full Stack MERN
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[9px] text-purple-200/80 font-mono">
          <span>Full Stack</span>
          <span className="font-bold text-white/90">Program</span>
        </div>
      </div>
    );
  }

  // ── 4. Python Programming ──
  if (upperCode.includes("PYTHON") || upperName.includes("PYTHON")) {
    return (
      <div
        className="w-full h-full relative overflow-hidden flex flex-col justify-between p-3 select-none group-hover:scale-105 transition-transform duration-300"
        style={{
          background:
            "linear-gradient(135deg, #082F49 0%, #0C4A6E 40%, #0284C7 75%, #38BDF8 100%)",
        }}
      >
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-1.5 opacity-80">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          </div>
          <span className="text-[9px] font-mono tracking-wider text-sky-200 font-bold uppercase">
            Python &bull; Logic &bull; Data
          </span>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center my-auto py-1">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-sky-500/25 border border-sky-400/40 backdrop-blur-md flex items-center justify-center text-sky-200 shadow-lg mb-1.5">
            <Terminal className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <p className="text-[11px] sm:text-xs font-black text-white text-center tracking-tight line-clamp-1 max-w-[90%]">
            Python Programming
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[9px] text-sky-200/80 font-mono">
          <span>Python</span>
          <span className="font-bold text-white/90">Core &amp; Adv.</span>
        </div>
      </div>
    );
  }

  // ── 5. Default Fallback ──
  return (
    <div
      className="w-full h-full relative overflow-hidden flex flex-col justify-between p-3 select-none group-hover:scale-105 transition-transform duration-300"
      style={{
        background: isOnline
          ? "linear-gradient(135deg, #1E1B4B 0%, #311042 50%, #4338CA 100%)"
          : `linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, ${theme?.color || "#2563EB"} 100%)`,
      }}
    >
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-1.5 opacity-80">
          <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
        </div>
        <span className="text-[9px] font-mono tracking-wider text-white/70 font-bold uppercase">
          {courseCode || "BRAINZIMA"}
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center my-auto py-1">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-lg mb-1.5">
          {isOnline ? (
            <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          ) : (
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
          )}
        </div>
        <p className="text-[11px] sm:text-xs font-black text-white text-center tracking-tight line-clamp-1 max-w-[90%]">
          {courseName}
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-between text-[9px] text-white/70 font-mono">
        <span>{isOnline ? "Online LMS" : "Academic"}</span>
        <span className="font-bold text-white/90">Program</span>
      </div>
    </div>
  );
}

