"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Upload,
  AlertCircle,
  FileCheck2,
  ShieldCheck,
  User,
  CreditCard,
  GraduationCap,
  Loader2,
  ExternalLink,
  Eye,
  Download,
  X,
  Camera,
  Check,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useStudent } from "@/hooks/useStudent";
import {
  getStudentDocuments,
  saveStudentDocuments,
  uploadStudentDocumentFile,
  updateUserProfile,
  StudentDocumentsPaths,
} from "@/lib/api";
import { getFileUrl, updateSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

interface PreviewDocModalState {
  title: string;
  url: string;
  isPdf: boolean;
  pathString: string;
}

export default function StudentDocumentsPage() {
  const { toast } = useToast();
  const {
    user_id,
    student_id,
    registration_number,
    name,
    studentProfile,
    user_image,
    isLoading: isStudentLoading,
  } = useStudent();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // Document state from GET /api/document/student/{student_id}
  const [docs, setDocs] = useState<StudentDocumentsPaths | null>(null);

  // Form paths state (for fallback direct edit / save)
  const [formPaths, setFormPaths] = useState({
    image: "",
    aadhaarFront: "",
    aadhaarBack: "",
    qualification: "",
  });

  // Lightbox preview modal state
  const [previewModal, setPreviewModal] = useState<PreviewDocModalState | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // File input refs for uploading
  const photoInputRef = useRef<HTMLInputElement>(null);
  const aadhFrontInputRef = useRef<HTMLInputElement>(null);
  const aadhBackInputRef = useRef<HTMLInputElement>(null);
  const qualifInputRef = useRef<HTMLInputElement>(null);

  const effectiveStudentId = student_id || studentProfile?.st_id;

  // ── Fetch Student Documents from GET /api/document/student/{student_id} ───
  const loadDocs = useCallback(async () => {
    if (!user_id || !effectiveStudentId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await getStudentDocuments(user_id, effectiveStudentId);
      if (res.success && res.data) {
        setDocs(res.data);
        setFormPaths({
          image: res.data.docs_st_image || "",
          aadhaarFront: res.data.docs_st_aadhaar_front || "",
          aadhaarBack: res.data.docs_st_aadhaar_back || "",
          qualification: res.data.docs_st_qualification || "",
        });
      } else {
        // Document row not yet created for this student in bi_st_docs
        setDocs(null);
        setFormPaths({
          image: user_image || studentProfile?.user_image || "",
          aadhaarFront: "",
          aadhaarBack: "",
          qualification: "",
        });
      }
    } catch {
      setError("Network error while connecting to student documents repository.");
    } finally {
      setLoading(false);
    }
  }, [user_id, effectiveStudentId, user_image, studentProfile?.user_image]);

  useEffect(() => {
    if (!isStudentLoading && user_id && effectiveStudentId) {
      loadDocs();
    } else if (!isStudentLoading && (!user_id || !effectiveStudentId)) {
      setLoading(false);
    }
  }, [user_id, effectiveStudentId, isStudentLoading, loadDocs]);

  // Close preview on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Handle Document File Upload & Auto-Sync to Database ───────────────────
  const handleFileUpload = async (
    file: File | null,
    docType: "docs_st_image" | "docs_st_aadhaar_front" | "docs_st_aadhaar_back" | "docs_st_qualification"
  ) => {
    if (!file || !user_id || !effectiveStudentId) return;

    setUploadingDocId(docType);

    try {
      // 1. Upload file to server storage via /api/upload
      const uploadRes = await uploadStudentDocumentFile(
        file,
        docType,
        effectiveStudentId,
        registration_number,
        user_id
      );

      // Requirement 8: check response.success === true and response.path exists
      const returnedPath = uploadRes.path || uploadRes.db_path;
      if (!uploadRes.success || !returnedPath) {
        throw new Error(uploadRes.message || "Failed to upload document file.");
      }

      const newDbPath = returnedPath;

      // 2. Prepare payload to save in bi_st_docs via POST /api/document/student/{id}
      const currentImage = docs?.docs_st_image || formPaths.image || user_image || studentProfile?.user_image || "";
      const currentAadhFront = docs?.docs_st_aadhaar_front || formPaths.aadhaarFront || "";
      const currentAadhBack = docs?.docs_st_aadhaar_back || formPaths.aadhaarBack || "";
      const currentQualif = docs?.docs_st_qualification || formPaths.qualification || "";

      const updatedPaths = {
        docs_st_image:
          docType === "docs_st_image"
            ? newDbPath
            : currentImage.trim() || undefined,
        docs_st_aadhaar_front:
          docType === "docs_st_aadhaar_front"
            ? newDbPath
            : currentAadhFront.trim() || undefined,
        docs_st_aadhaar_back:
          docType === "docs_st_aadhaar_back"
            ? newDbPath
            : currentAadhBack.trim() || undefined,
        docs_st_qualification:
          docType === "docs_st_qualification"
            ? newDbPath
            : currentQualif.trim() || undefined,
      };

      const saveRes = await saveStudentDocuments(
        user_id,
        effectiveStudentId,
        updatedPaths
      );

      // Requirement 12: Profile Image Sync
      if (docType === "docs_st_image") {
        updateSession({ user_image: newDbPath });
        try {
          await updateUserProfile(user_id, "student", {
            user_image: newDbPath,
          });
        } catch {
          // ignore profile sync notice
        }
      }

      if (saveRes.success) {
        toast({
          variant: "success",
          title: "Document Uploaded",
          description: "Document saved and officially verified in student vault.",
        });
        // Re-fetch fresh documents from API
        await loadDocs();
      } else {
        toast({
          variant: "warning",
          title: "File Saved Locally",
          description: saveRes.message || "File uploaded. Please confirm save.",
        });
        // Update local form state
        if (docType === "docs_st_image") setFormPaths((p) => ({ ...p, image: newDbPath }));
        if (docType === "docs_st_aadhaar_front") setFormPaths((p) => ({ ...p, aadhaarFront: newDbPath }));
        if (docType === "docs_st_aadhaar_back") setFormPaths((p) => ({ ...p, aadhaarBack: newDbPath }));
        if (docType === "docs_st_qualification") setFormPaths((p) => ({ ...p, qualification: newDbPath }));
      }
    } catch (err: any) {
      toast({
        variant: "error",
        title: "Upload Failed",
        description: err?.message || "Could not upload document.",
      });
    } finally {
      setUploadingDocId(null);
    }
  };

  // ── Document Definitions ──────────────────────────────────────────────────
  const effectivePhotoPath =
    docs?.docs_st_image || formPaths.image || user_image || studentProfile?.user_image || null;
  const effectiveAadhFront = docs?.docs_st_aadhaar_front || formPaths.aadhaarFront || null;
  const effectiveAadhBack = docs?.docs_st_aadhaar_back || formPaths.aadhaarBack || null;
  const effectiveQualif = docs?.docs_st_qualification || formPaths.qualification || null;

  const documentCards = [
    {
      id: "docs_st_image",
      docType: "docs_st_image" as const,
      label: "Student Photograph",
      sub: "Official passport portrait for student ID card, hall ticket & certificates",
      icon: User,
      color: "#5B21F4",
      bg: "#F1EEFF",
      path: effectivePhotoPath,
      inputRef: photoInputRef,
      accept: "image/jpeg,image/png,image/webp",
      badge: "Identity Photo",
      isPdf: false,
    },
    {
      id: "docs_st_aadhaar_front",
      docType: "docs_st_aadhaar_front" as const,
      label: "Aadhaar Card (Front)",
      sub: "Government issued identity verification proof showing name & photo",
      icon: CreditCard,
      color: "#08A66A",
      bg: "#ECFDF5",
      path: effectiveAadhFront,
      inputRef: aadhFrontInputRef,
      accept: "image/jpeg,image/png,image/webp",
      badge: "Identity Proof",
      isPdf: false,
    },
    {
      id: "docs_st_aadhaar_back",
      docType: "docs_st_aadhaar_back" as const,
      label: "Aadhaar Card (Back)",
      sub: "Government issued residential address verification proof with QR code",
      icon: CreditCard,
      color: "#2563EB",
      bg: "#EFF6FF",
      path: effectiveAadhBack,
      inputRef: aadhBackInputRef,
      accept: "image/jpeg,image/png,image/webp",
      badge: "Address Proof",
      isPdf: false,
    },
    {
      id: "docs_st_qualification",
      docType: "docs_st_qualification" as const,
      label: "Academic Qualification",
      sub: "10th / 12th / Graduation Marksheet or Certificate for academic eligibility",
      icon: GraduationCap,
      color: "#EA580C",
      bg: "#FFF7ED",
      path: effectiveQualif,
      inputRef: qualifInputRef,
      accept: "image/jpeg,image/png,image/webp,application/pdf",
      badge: "Academic Record",
      isPdf: Boolean(
        effectiveQualif &&
          (effectiveQualif.toLowerCase().endsWith(".pdf") ||
            effectiveQualif.toLowerCase().includes(".pdf"))
      ),
    },
  ];

  // Calculated metrics
  const uploadedCount = documentCards.filter((d) => Boolean(d.path)).length;
  const totalCount = documentCards.length;
  const completionPercent = Math.round((uploadedCount / totalCount) * 100);

  return (
    <div className="p-3 sm:p-5 md:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#5B21F4] animate-pulse" />
            <span className="text-[11px] sm:text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
              Verification Vault
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#111827] tracking-tight">
            Student Documents
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Verified academic dossier, student photograph, and government identity documents.
          </p>
        </div>

        {registration_number && (
          <div className="self-start sm:self-auto">
            <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-[#F1EEFF] text-[#5B21F4] font-mono text-xs font-bold border border-[#DDD6FE]">
              {registration_number}
            </span>
          </div>
        )}
      </div>

      {/* ── Error Banner ── */}
      {!loading && error && (
        <div className="p-4 sm:p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
          <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-red-800">{error}</p>
          <button
            onClick={loadDocs}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry Loading Documents
          </button>
        </div>
      )}

      {/* ── Summary Progress & Security Card ── */}
      <motion.div {...fadeUp(0.05)}>
        <div className="p-3.5 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#5B21F4] to-[#2563EB] text-white flex items-center justify-center shadow-sm shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#111827] truncate">
                  Official Academic Vault
                </h3>
                <p className="text-[10px] sm:text-xs text-[#64748B] truncate">
                  {name || "Student"} &bull; ID #{effectiveStudentId || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:block text-right">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                  Dossier
                </p>
                <p className="text-xs font-extrabold text-[#111827]">
                  {uploadedCount} / {totalCount} Done
                </p>
              </div>
              <Badge
                variant={uploadedCount === totalCount ? "success" : "outline"}
                className="text-[10px] sm:text-xs font-bold px-2.5 py-1"
              >
                {uploadedCount === totalCount ? "Complete" : `${completionPercent}% Done`}
              </Badge>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#5B21F4] to-[#08A66A] rounded-full transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Loading Skeletons (2 Columns on mobile & desktop) ── */}
      {loading && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5 md:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl sm:rounded-2xl border border-[#E2E8F0] p-1.5 sm:p-3 space-y-1 sm:space-y-2">
              <div className="flex items-center gap-1">
                <Skeleton className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-2 w-12 sm:w-20" />
                </div>
              </div>
              <Skeleton className="h-20 sm:h-32 w-full rounded-lg" />
              <Skeleton className="h-6 sm:h-7.5 w-full rounded-md sm:rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* REAL DOCUMENTS SHOWN (Strictly 2 Columns: 1 row = 2 cols)              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && !error && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5 md:gap-4">
          {documentCards.map((doc, idx) => {
            const fileUrl = doc.path ? getFileUrl(doc.path) : null;
            const isUploading = uploadingDocId === doc.docType;
            const isPdf = doc.isPdf;

            return (
              <motion.div
                key={doc.id}
                {...fadeUp(0.04 + idx * 0.02)}
                className="bg-white rounded-xl sm:rounded-2xl border border-[#E2E8F0] p-1.5 sm:p-3 flex flex-col justify-between shadow-xs hover:border-[#5B21F4]/40 hover:shadow-sm transition-all group"
              >
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={doc.inputRef}
                  accept={doc.accept}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f) handleFileUpload(f, doc.docType);
                    e.target.value = "";
                  }}
                  className="hidden"
                />

                <div className="space-y-1 sm:space-y-1.5">
                  {/* Top Header: Badge & Status */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <div
                        className="w-4.5 h-4.5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: doc.bg, color: doc.color }}
                      >
                        <doc.icon className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                      </div>
                      <span className="text-[7.5px] sm:text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-[#F1F5F9] text-[#475569] truncate">
                        {doc.badge}
                      </span>
                    </div>

                    {doc.path ? (
                      <span className="text-[7px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5 shrink-0">
                        <Check className="w-1.5 h-1.5 sm:w-2 sm:h-2" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="text-[7px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        Pending
                      </span>
                    )}
                  </div>

                  {/* Document Title */}
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-[#111827] text-[10px] sm:text-xs leading-tight truncate">
                      {doc.label}
                    </h4>
                  </div>

                  {/* Document Display Preview Area (Click to preview) */}
                  <div
                    onClick={() => {
                      if (doc.path && fileUrl) {
                        setZoomLevel(1);
                        setPreviewModal({
                          title: doc.label,
                          url: fileUrl,
                          isPdf: doc.isPdf,
                          pathString: doc.path || "",
                        });
                      }
                    }}
                    className={`rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden h-20 sm:h-30 flex items-center justify-center relative cursor-pointer group-hover:border-[#5B21F4]/40 transition-all ${
                      doc.path && fileUrl ? "hover:shadow-xs" : ""
                    }`}
                  >
                    {doc.path && fileUrl ? (
                      isPdf ? (
                        /* PDF Display */
                        <div className="p-1 sm:p-2.5 text-center space-y-0.5 w-full">
                          <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-xs">
                            <FileText className="w-2.5 h-2.5 sm:w-4 sm:h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-[9px] sm:text-[11px] text-[#111827] truncate">
                              PDF Ready
                            </p>
                          </div>
                          <div className="inline-flex items-center gap-0.5 text-[7.5px] sm:text-[9px] font-bold text-[#5B21F4] bg-[#F1EEFF] px-1 py-0.2 rounded">
                            <Eye className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                            <span>View</span>
                          </div>
                        </div>
                      ) : (
                        /* Real Image Preview */
                        <div className="relative w-full h-full bg-[#0F172A]/5 flex items-center justify-center overflow-hidden">
                          <img
                            src={fileUrl}
                            alt={doc.label}
                            className="w-full h-full object-contain p-0.5 transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                          {/* Hover Overlay Button */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                            <div className="bg-white/95 text-[#111827] px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold flex items-center gap-0.5 shadow-xs">
                              <Eye className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#5B21F4]" />
                              <span>View</span>
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      /* Not Uploaded Placeholder */
                      <div className="p-1 text-center space-y-0.5">
                        <div className="w-4 h-4 sm:w-7 sm:h-7 rounded-md bg-[#E2E8F0] text-[#94A3B8] flex items-center justify-center mx-auto">
                          <Camera className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                        </div>
                        <p className="text-[8px] sm:text-[10px] font-bold text-[#64748B]">
                          No file yet
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Button: Only View if uploaded, or Upload if not yet added. NO REPLACE BUTTON! */}
                <div className="pt-1 sm:pt-1.5">
                  {doc.path && fileUrl ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setZoomLevel(1);
                        setPreviewModal({
                          title: doc.label,
                          url: fileUrl,
                          isPdf: doc.isPdf,
                          pathString: doc.path || "",
                        });
                      }}
                      className="w-full rounded-md sm:rounded-lg text-[8.5px] sm:text-[11px] font-bold h-6 sm:h-7.5 bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                    >
                      <Eye className="w-2 h-2 sm:w-3 sm:h-3" />
                      <span>View</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => doc.inputRef.current?.click()}
                      className="w-full rounded-md sm:rounded-lg text-[8.5px] sm:text-[11px] font-bold h-6 sm:h-7.5 bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-2 h-2 sm:w-3 sm:h-3 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-2 h-2 sm:w-3 sm:h-3" />
                          <span>Upload</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* RADIX UI DIALOG: ACCESSIBLE, COMPACT & RESPONSIVE LIGHTBOX MODAL     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={Boolean(previewModal)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewModal(null);
            setZoomLevel(1);
          }
        }}
      >
        <DialogContent
          hideCloseButton
          className="w-[84vw] max-w-[310px] sm:max-w-md p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border border-[#E2E8F0] shadow-2xl flex flex-col max-h-[82vh] space-y-1 sm:space-y-2 overflow-hidden bg-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-1 sm:pb-1.5 gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center shrink-0 border border-[#DDD6FE]">
                <FileCheck2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-[11px] sm:text-sm font-extrabold text-[#111827] leading-tight truncate">
                  {previewModal?.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Preview of student verified document {previewModal?.title}
                </DialogDescription>
                <div className="flex items-center gap-1 text-[7.5px] sm:text-[9px] text-[#64748B] mt-0.5">
                  <span className="font-mono text-[#5B21F4] font-bold truncate max-w-[80px] sm:max-w-none">
                    {registration_number || `ST-${effectiveStudentId}`}
                  </span>
                  <span>&bull;</span>
                  <span className="inline-flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-semibold text-[7px] sm:text-[8px] border border-emerald-200 shrink-0">
                    <Check className="w-1.5 h-1.5 sm:w-2 sm:h-2" /> Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Zoom controls for images */}
              {!previewModal?.isPdf && (
                <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-md sm:rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
                    disabled={zoomLevel <= 1}
                    className="p-0.5 rounded text-[#64748B] hover:text-[#111827] disabled:opacity-30 transition-colors cursor-pointer"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="px-0.5 sm:px-1 text-[8px] sm:text-[9px] font-mono font-bold text-[#475569] hover:text-[#5B21F4]"
                    title="Reset zoom"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(2.5, Math.round((z + 0.25) * 100) / 100))}
                    disabled={zoomLevel >= 2.5}
                    className="p-0.5 rounded text-[#64748B] hover:text-[#111827] disabled:opacity-30 transition-colors cursor-pointer"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </button>
                </div>
              )}

              {/* Download */}
              <a
                href={previewModal?.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="p-0.5 sm:p-1 rounded-md sm:rounded-lg text-[#64748B] hover:text-[#5B21F4] hover:bg-[#F1EEFF] transition-colors cursor-pointer"
                title="Download document"
              >
                <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </a>

             
              {/* Close */}
              <DialogClose className="p-0.5 sm:p-1 rounded-md sm:rounded-lg text-[#94A3B8] hover:text-[#111827] hover:bg-[#F1F5F9] transition-colors cursor-pointer">
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </DialogClose>
            </div>
          </div>

          {/* Modal Body / Viewer */}
          <div className="flex-1 overflow-auto bg-[#0B0F19] rounded-lg sm:rounded-xl border border-[#1E293B] p-1 sm:p-2 flex items-center justify-center min-h-[100px] sm:min-h-[160px] max-h-[26vh] sm:max-h-[38vh] shadow-inner relative">
            {previewModal?.isPdf ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center space-y-1 bg-[#111827] rounded-md sm:rounded-lg">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-[11px] sm:text-xs">
                    PDF Document Ready
                  </h4>
                  <p className="text-[8px] sm:text-[9px] text-white/60 font-mono mt-0.5 truncate max-w-[160px] mx-auto">
                    {previewModal.pathString.split("/").pop()}
                  </p>
                </div>
                <div className="flex items-center gap-1 pt-0.5 flex-wrap justify-center">
                  <a
                    href={previewModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      size="sm"
                      className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-[9px] sm:text-[10px] font-bold rounded-md sm:rounded-lg h-5.5 sm:h-6.5 px-2 gap-1 shadow-xs cursor-pointer"
                    >
                      <ExternalLink className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                      <span>View PDF</span>
                    </Button>
                  </a>
                  <a
                    href={previewModal.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-[9px] sm:text-[10px] font-bold rounded-md sm:rounded-lg h-5.5 sm:h-6.5 px-2 gap-1 cursor-pointer"
                    >
                      <Download className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                      <span>Download</span>
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center overflow-hidden">
                <img
                  src={previewModal?.url}
                  alt={previewModal?.title}
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transition: "transform 0.15s ease-out",
                  }}
                  className="max-h-[24vh] sm:max-h-[36vh] w-auto max-w-full object-contain rounded select-none origin-center"
                />
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-[#F1F5F9]">
            <div className="flex items-center gap-1 text-emerald-700 font-bold text-[8px] sm:text-[9.5px]">
              <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-600 shrink-0" />
              <span className="truncate">Verified Vault Document</span>
            </div>
            <DialogClose asChild>
              <Button
                size="sm"
                className="bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] text-[9px] sm:text-[10.5px] font-bold rounded-md sm:rounded-lg h-5.5 sm:h-6.5 px-2 sm:px-2.5 cursor-pointer transition-colors"
              >
                Close
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
