"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  X,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  LayoutGrid,
  MoreHorizontal,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { EbookRecord } from "@/lib/api";

interface EbookFlipbookProps {
  isOpen: boolean;
  onClose: () => void;
  ebook: EbookRecord | null;
}

// Persistent audio context for mobile + desktop compatibility
let persistentAudioCtx: AudioContext | null = null;

// Generate realistic page flip sound using Web Audio API (Active on every flip)
function playPageFlipSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!persistentAudioCtx) {
      persistentAudioCtx = new AudioContextClass();
    }
    if (persistentAudioCtx.state === "suspended") {
      persistentAudioCtx.resume().catch(() => {});
    }

    const ctx = persistentAudioCtx;
    const bufferSize = ctx.sampleRate * 0.12;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.exp(-i / (bufferSize * 0.35));
      const noise = Math.random() * 2 - 1;
      data[i] = noise * decay * 0.22;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 1.3;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.35, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noiseSource.start();
  } catch {
    // browser audio gesture policy fallback
  }
}

export default function EbookFlipbook({
  isOpen,
  onClose,
  ebook,
}: EbookFlipbookProps) {
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isFlipping, setIsFlipping] = useState<"next" | "prev" | null>(null);
  const [isMobileView, setIsMobileView] = useState<boolean>(false);

  // Touch swipe tracking refs
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);

  // Detect Mobile View on mount & resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sound is ALWAYS on
  const triggerSound = useCallback(() => {
    playPageFlipSound();
  }, []);

  // Load PDF.js dynamically and load the document
  useEffect(() => {
    if (!isOpen || !ebook?.ebook_pdf_link) return;

    let isMounted = true;
    setPdfLoading(true);

    const loadPdfJs = async () => {
      if (!(window as any).pdfjsLib) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.async = true;
        document.body.appendChild(script);

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load PDF.js"));
        });
      }

      if (!(window as any).pdfjsLib) {
        throw new Error("PDF.js not available");
      }

      const pdfjs = (window as any).pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      // Load document from proxy URL
      const loadingTask = pdfjs.getDocument({
        url: ebook.ebook_pdf_link,
        cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
        cMapPacked: true,
      });

      const loadedPdf = await loadingTask.promise;
      if (isMounted) {
        setPdfDoc(loadedPdf);
        setTotalPages(loadedPdf.numPages || 1);
        setCurrentPage(1);
        setPdfLoading(false);
      }
    };

    loadPdfJs().catch((err) => {
      console.warn("PDF.js loading failed:", err);
      if (isMounted) {
        setPdfLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, ebook?.ebook_pdf_link]);

  // Render Left and Right Pages onto canvas
  useEffect(() => {
    if (!isOpen || !pdfDoc) return;

    let cancelRender = false;

    const renderPageToCanvas = async (
      pageNum: number,
      canvas: HTMLCanvasElement | null
    ) => {
      if (!canvas || pageNum < 1 || pageNum > totalPages) {
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelRender) return;

        const baseViewport = page.getViewport({ scale: 1.0 });
        const containerWidth = canvas.parentElement?.clientWidth || (isMobileView ? 340 : 500);
        const scale = containerWidth / baseViewport.width;
        const finalScale = Math.max(1.3, scale * 1.5);
        const viewport = page.getViewport({ scale: finalScale });

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    };

    // On mobile: 1 page per screen (currentPage)
    // On desktop: 2 pages spread (currentPage and currentPage + 1)
    const leftPageNum = currentPage;
    const rightPageNum = !isMobileView && currentPage + 1 <= totalPages ? currentPage + 1 : null;

    renderPageToCanvas(leftPageNum, leftCanvasRef.current);
    if (!isMobileView && rightPageNum) {
      renderPageToCanvas(rightPageNum, rightCanvasRef.current);
    } else if (rightCanvasRef.current) {
      const ctx = rightCanvasRef.current.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, rightCanvasRef.current.width, rightCanvasRef.current.height);
    }

    return () => {
      cancelRender = true;
    };
  }, [isOpen, pdfDoc, currentPage, totalPages, isMobileView]);

  // Page Navigation Handlers: 1 Page Step on Mobile, 2 Pages Step on Desktop
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      triggerSound();
      setIsFlipping("next");
      const step = isMobileView ? 1 : 2;
      setTimeout(() => {
        setCurrentPage((prev) => Math.min(prev + step, totalPages));
        setIsFlipping(null);
      }, 200);
    }
  }, [currentPage, totalPages, isMobileView, triggerSound]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      triggerSound();
      setIsFlipping("prev");
      const step = isMobileView ? 1 : 2;
      setTimeout(() => {
        setCurrentPage((prev) => Math.max(prev - step, 1));
        setIsFlipping(null);
      }, 200);
    }
  }, [currentPage, isMobileView, triggerSound]);

  // Touch Swipe Handlers for mobile page flipping
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = touchStartXRef.current - endX;
    const diffY = touchStartYRef.current - endY;

    // Only swipe if horizontal move is significant and greater than vertical move
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) {
        // Swiped Left -> Go Next Page
        handleNextPage();
      } else {
        // Swiped Right -> Go Previous Page
        handlePrevPage();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleNextPage, handlePrevPage, onClose]);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  if (!isOpen || !ebook) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Crisp Light Modal Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* ── Main White Theme Flipbook Modal Frame (Protected: No Right Click, No Download) ── */}
        <DialogPrimitive.Content
          ref={modalContainerRef}
          onContextMenu={(e) => e.preventDefault()}
          className={`fixed inset-0 z-50 flex flex-col w-screen h-screen bg-[#F1F5F9] text-slate-800 overflow-hidden outline-none duration-200 select-none ${
            isFullscreen ? "p-0" : ""
          }`}
        >
          {/* ── Top Bar: Title on Left, ONLY Cross Button [X] on Right (Responsive on Mobile) ── */}
          <div className="absolute top-2.5 sm:top-4 left-2.5 sm:left-4 right-2.5 sm:right-4 z-40 flex items-center justify-between pointer-events-none gap-2">
            {/* Title Badge on top-left: Constrained so it never collides with [X] */}
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl shadow-md border border-slate-200/90 flex items-center gap-2.5 min-w-0 max-w-[calc(100%-54px)]">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1 truncate">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {ebook.ebook_title}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                  {ebook.ebook_author} • {ebook.ebook_edition}
                </p>
              </div>
            </div>

            {/* Top-right Actions: ONLY Cross Button [X] (Always visible on mobile) */}
            <div className="pointer-events-auto shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 sm:w-10 sm:h-10 bg-white/95 hover:bg-red-50 text-slate-700 hover:text-red-600 rounded-2xl shadow-lg border border-slate-200/90 transition-all cursor-pointer flex items-center justify-center active:scale-90"
                title="Close (Esc)"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* ── Center Stage: Dual-Page Book Spread (Desktop) or Single Page (Mobile) ── */}
          <div
            className="relative flex-1 w-full h-full flex items-center justify-center p-2 pt-14 pb-20 sm:p-8 lg:p-12 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="relative flex items-center justify-center w-full max-w-5xl h-[80vh] max-h-[760px] transition-transform duration-200"
              style={{
                transform: `scale(${zoomLevel / 100})`,
              }}
            >
              {/* Floating Side Navigation Arrow: Left (Prominent & Easy to Tap on Mobile & Desktop) */}
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="absolute left-1 md:-left-5 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3.5 rounded-full bg-white/95 hover:bg-white text-slate-800 hover:text-indigo-600 shadow-xl border border-slate-200/90 disabled:opacity-0 disabled:pointer-events-none transition-all group cursor-pointer active:scale-90"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              {/* Floating Side Navigation Arrow: Right (Prominent & Easy to Tap on Mobile & Desktop) */}
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="absolute right-1 md:-right-5 top-1/2 -translate-y-1/2 z-30 p-2 sm:p-3.5 rounded-full bg-white/95 hover:bg-white text-slate-800 hover:text-indigo-600 shadow-xl border border-slate-200/90 disabled:opacity-0 disabled:pointer-events-none transition-all group cursor-pointer active:scale-90"
                aria-label="Next Page"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* Notebook / Book Spread Container */}
              <div
                onContextMenu={(e) => e.preventDefault()}
                className="relative w-full h-full bg-white rounded-2xl sm:rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] border border-slate-200/90 flex overflow-hidden select-none"
              >
                {/* Spiral Rings */}
                <div className="absolute left-1.5 sm:left-2 top-0 bottom-0 w-5 sm:w-6 flex flex-col justify-around py-3 sm:py-4 z-20 pointer-events-none">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-4 sm:w-5 h-2 sm:h-2.5 rounded-full bg-slate-800 shadow-sm border border-slate-950 transform -rotate-12"
                    />
                  ))}
                </div>

                {/* Left Page (On mobile, this is the 1 single active page) */}
                <div
                  className="w-full md:w-1/2 h-full pl-6 sm:pl-8 pr-2.5 sm:pr-4 py-3 sm:py-6 border-r-0 md:border-r border-slate-200 flex flex-col items-center justify-center relative overflow-hidden bg-[#FAFBFD] select-none cursor-pointer"
                  onClick={(e) => {
                    // Tap on left 35% turns prev, tap on right turns next
                    if (isMobileView) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      if (x < rect.width * 0.4) {
                        handlePrevPage();
                      } else {
                        handleNextPage();
                      }
                    }
                  }}
                >
                  {pdfLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
                      <span className="text-xs font-medium">Loading Real PDF...</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col justify-between">
                      <div className="flex-1 flex items-center justify-center overflow-hidden">
                        <canvas
                          ref={leftCanvasRef}
                          onContextMenu={(e) => e.preventDefault()}
                          className="max-h-full max-w-full object-contain rounded-lg shadow-sm pointer-events-none select-none"
                        />
                      </div>
                      <div className="pt-1.5 sm:pt-2 text-center text-[10px] sm:text-[11px] font-mono text-slate-400 select-none">
                        Page {currentPage} of {totalPages}
                      </div>
                    </div>
                  )}
                </div>

                {/* Center Crease Shadow (Desktop only) */}
                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-8 bg-gradient-to-r from-black/5 via-black/15 to-black/5 z-20 pointer-events-none" />

                {/* Right Page (Desktop only: 2nd page of spread) */}
                <div
                  className={`hidden md:flex w-1/2 h-full pl-4 pr-8 py-6 flex-col items-center justify-center relative overflow-hidden bg-[#FAFBFD] select-none transition-transform duration-200 ${
                    isFlipping === "next"
                      ? "origin-left rotate-y-[-15deg] opacity-80"
                      : isFlipping === "prev"
                      ? "origin-right rotate-y-[15deg] opacity-80"
                      : ""
                  }`}
                >
                  {pdfLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                      <span className="text-xs font-medium">Loading Real PDF...</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col justify-between">
                      <div className="flex-1 flex items-center justify-center overflow-hidden">
                        <canvas
                          ref={rightCanvasRef}
                          onContextMenu={(e) => e.preventDefault()}
                          className="max-h-full max-w-full object-contain rounded-lg shadow-sm pointer-events-none select-none"
                        />
                      </div>
                      <div className="pt-2 text-center text-[11px] font-mono text-slate-400 select-none">
                        {currentPage + 1 <= totalPages ? `Page ${currentPage + 1}` : ""}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Floating White Bottom Toolbar (Mobile Optimized with Big Tap Targets) ── */}
          <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw]">
            <div className="flex items-center gap-1 sm:gap-3 bg-white/95 backdrop-blur-xl px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.14)] border border-slate-200/90 text-slate-700">
              {/* Previous Page Arrow (Easy to tap with thumb) */}
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-full hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4 sm:w-4 sm:h-4" />
              </button>

              {/* Page Number Indicator: 7/22 (Steps by 1 on Mobile) */}
              <div className="px-2 py-0.5 text-xs font-mono font-bold text-slate-800 whitespace-nowrap">
                {currentPage}/{totalPages}
              </div>

              {/* Next Page Arrow (Easy to tap with thumb) */}
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-full hover:bg-slate-100 active:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4 sm:w-4 sm:h-4" />
              </button>

              <div className="w-px h-4 bg-slate-200 mx-0.5" />

              {/* Grid / Thumbnails Icon [::] */}
              <button
                type="button"
                onClick={() => setShowThumbnails(!showThumbnails)}
                className={`p-1.5 sm:p-1.5 rounded-full transition-colors ${
                  showThumbnails ? "bg-indigo-50 text-indigo-600" : "hover:bg-slate-100"
                }`}
                title="Thumbnail Overview"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>

              {/* Zoom In [+] */}
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 15, 160))}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {/* Zoom Out [-] */}
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 15, 75))}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              {/* Fullscreen [⛶] */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* More Options [...] */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                  title="More Options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {showMoreMenu && (
                  <div className="absolute bottom-10 right-0 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs font-semibold space-y-1">
                    <button
                      onClick={() => {
                        setZoomLevel(100);
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      Reset Zoom (100%)
                    </button>
                    <button
                      onClick={() => {
                        toggleFullscreen();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-indigo-600"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      Fullscreen
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Thumbnails Drawer (When [::] is clicked) ── */}
          {showThumbnails && (
            <div className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md p-2.5 sm:p-3 rounded-2xl shadow-2xl border border-slate-200 flex items-center gap-2 max-w-[92vw] sm:max-w-xl overflow-x-auto scrollbar-thin">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    triggerSound();
                    setCurrentPage(p);
                    setShowThumbnails(false);
                  }}
                  className={`w-9 h-12 sm:w-10 sm:h-14 rounded-lg border text-[11px] font-mono font-bold flex items-center justify-center flex-shrink-0 transition-all ${
                    currentPage === p
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
