"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  BookMarked,
  Search,
  ArrowUpDown,
  Download,
  Star,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import EbookCard from "@/components/ebooks/EbookCard";
import EbookFlipbook from "@/components/EbookFlipbook";
import { EbookRecord, getEbooks } from "@/lib/api";

const ITEMS_PER_PAGE = 8;

export default function UserEbookLibraryPage() {
  const [ebooks, setEbooks] = useState<EbookRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"recent" | "title" | "pages">("recent");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedEbook, setSelectedEbook] = useState<EbookRecord | null>(null);
  const [isFlipbookOpen, setIsFlipbookOpen] = useState<boolean>(false);

  // Fetch REAL ebooks strictly from database
  useEffect(() => {
    let isMounted = true;
    async function loadBooks() {
      try {
        setLoading(true);
        const res = await getEbooks();

        if (isMounted) {
          if (res?.data && Array.isArray(res.data)) {
            setEbooks(res.data);
          } else {
            setEbooks([]);
          }
        }
      } catch (err) {
        console.error("Failed to load real ebooks from database:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBooks();

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute dynamic category filter pills from real database items
  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();
    ebooks.forEach((b) => {
      if (b.category) set.add(b.category);
      if (b.extra?.category) set.add(b.extra.category);
    });
    return ["All", ...Array.from(set)];
  }, [ebooks]);

  // Client-side search, category filter & sort over real database items
  const filteredAndSortedBooks = useMemo(() => {
    let list = [...ebooks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.ebook_title.toLowerCase().includes(q) ||
          b.ebook_subtitle?.toLowerCase().includes(q) ||
          b.ebook_author?.toLowerCase().includes(q) ||
          b.ebook_description?.toLowerCase().includes(q) ||
          b.category?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== "All") {
      list = list.filter(
        (b) =>
          b.category?.toLowerCase() === selectedCategory.toLowerCase() ||
          b.extra?.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Sort
    if (sortBy === "title") {
      list.sort((a, b) => a.ebook_title.localeCompare(b.ebook_title));
    } else if (sortBy === "pages") {
      list.sort((a, b) => (b.total_pages || 0) - (a.total_pages || 0));
    } else {
      // Recent / database id descending
      list.sort((a, b) => (b.ebook_id || 0) - (a.ebook_id || 0));
    }

    return list;
  }, [ebooks, searchQuery, selectedCategory, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedBooks.length / ITEMS_PER_PAGE));
  const paginatedBooks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedBooks.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedBooks, currentPage]);

  const handleOpenReader = (book: EbookRecord) => {
    setSelectedEbook(book);
    setIsFlipbookOpen(true);
  };

  const handleCloseReader = () => {
    setIsFlipbookOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* ── Breadcrumb Bar ── */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">
                Ebook Library
              </h1>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Link href="/user/dashboard" className="hover:text-indigo-600">
                  Dashboard
                </Link>
                <span>/</span>
                <span className="text-indigo-600 font-semibold">Ebook Library</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* ── Hero Banner (Hidden on Mobile, Visible on Desktop/Tablet) ── */}
        <div className="hidden md:block relative rounded-3xl overflow-hidden shadow-xl bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#3B82F6] p-6 sm:p-8 md:p-10 text-white">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Left Content */}
            <div className="max-w-2xl text-left space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide">
                <BookOpen className="w-3.5 h-3.5 text-white" />
                <span>Learn something new</span>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight">
                Explore the Ebook Library
              </h2>

              <p className="text-indigo-100 text-sm sm:text-base font-normal leading-relaxed max-w-xl">
                Discover verified learning resources, programming guides, and career essentials directly from Brainzima.
              </p>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/10 backdrop-blur border border-white/15">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Free Resources</h4>
                    <p className="text-[11px] text-indigo-100">Learn at your own pace</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/10 backdrop-blur border border-white/15">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Quality Content</h4>
                    <p className="text-[11px] text-indigo-100">Curated for your growth</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/10 backdrop-blur border border-white/15">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                    <Star className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Career Focused</h4>
                    <p className="text-[11px] text-indigo-100">Build real-world skills</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Graphic Illustration */}
            <div className="relative flex flex-col items-center justify-center lg:pr-4">
              <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-slate-800 text-xs font-bold shadow-lg shadow-black/10 border border-white/80 animate-bounce-subtle">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Knowledge builds brighter futures</span>
              </div>

              <div className="relative w-64 h-36 flex items-center justify-center">
                <div className="absolute bottom-0 w-52 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 shadow-xl border-l-4 border-amber-600 flex items-center px-4 transform rotate-[-2deg]">
                  <div className="w-full h-1 bg-white/30 rounded" />
                </div>
                <div className="absolute bottom-6 w-48 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 shadow-lg border-l-4 border-blue-800 flex items-center px-4 transform rotate-[1deg]">
                  <div className="w-full h-1 bg-white/30 rounded" />
                </div>
                <div className="absolute bottom-12 w-44 h-9 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 shadow-md border-l-4 border-teal-700 flex items-center px-4 transform rotate-[-1deg]">
                  <div className="w-full h-1 bg-white/40 rounded" />
                </div>
                <Sparkles className="absolute -top-1 -right-2 w-6 h-6 text-amber-300 animate-pulse" />
                <Sparkles className="absolute bottom-2 -left-2 w-5 h-5 text-indigo-200 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Search Bar, Category Filter Pills & Sort Dropdown ── */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search ebooks by title, author, or topic..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white border border-slate-200/90 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dynamic Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {dynamicCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 self-end lg:self-auto flex-shrink-0">
            <div className="relative inline-flex items-center bg-white border border-slate-200/90 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 mr-2" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "recent" | "title" | "pages")}
                className="bg-transparent border-0 text-slate-700 text-xs font-bold focus:outline-none cursor-pointer pr-1"
              >
                <option value="recent">Recently Added</option>
                <option value="title">Title (A-Z)</option>
                <option value="pages">Most Pages</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Resource Counter ── */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-slate-900 tracking-tight">
            {filteredAndSortedBooks.length} resources available
          </p>
          {selectedCategory !== "All" && (
            <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-lg">
              Filtered by: {selectedCategory}
            </span>
          )}
        </div>

        {/* ── Book Cards Grid ── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading Real Ebooks from Database...</p>
          </div>
        ) : paginatedBooks.length === 0 ? (
          <div className="py-20 bg-white rounded-3xl border border-dashed border-slate-300 text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3">
              <BookOpen className="w-7 h-7" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              No Ebooks Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              We couldn&apos;t find any ebooks matching &ldquo;{searchQuery || selectedCategory}&rdquo;. Try another search keyword or clear your filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("All");
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {paginatedBooks.map((book) => (
              <EbookCard
                key={book.ebook_id}
                ebook={book}
                onReadPdf={handleOpenReader}
              />
            ))}
          </div>
        )}

        {/* ── Bottom Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setCurrentPage(num)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                  currentPage === num
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Interactive White Theme Flipbook Modal ── */}
      <EbookFlipbook
        isOpen={isFlipbookOpen}
        onClose={handleCloseReader}
        ebook={selectedEbook}
      />
    </div>
  );
}
