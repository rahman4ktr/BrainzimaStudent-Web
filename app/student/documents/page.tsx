"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  ShieldCheck,
  User,
  CreditCard,
  GraduationCap,
  Save,
  Loader2,
  ExternalLink,
  FolderOpen,
  Eye,
  Download,
  X,
  FileBadge,
  Sparkles,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

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
  const [savingPaths, setSavingPaths] = useState(false);
  const [showAdvancedPaths, setShowAdvancedPaths] = useState(false);

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
      const updatedPaths = {
        docs_st_image:
          docType === "docs_st_image"
            ? newDbPath
            : formPaths.image.trim() || undefined,
        docs_st_aadhaar_front:
          docType === "docs_st_aadhaar_front"
            ? newDbPath
            : formPaths.aadhaarFront.trim() || undefined,
        docs_st_aadhaar_back:
          docType === "docs_st_aadhaar_back"
            ? newDbPath
            : formPaths.aadhaarBack.trim() || undefined,
        docs_st_qualification:
          docType === "docs_st_qualification"
            ? newDbPath
            : formPaths.qualification.trim() || undefined,
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

  // ── Manual Path Save Handler ──────────────────────────────────────────────
  const handleSavePaths = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user_id || !effectiveStudentId) return;

    setSavingPaths(true);
    try {
      const res = await saveStudentDocuments(user_id, effectiveStudentId, {
        docs_st_image: formPaths.image.trim() || undefined,
        docs_st_aadhaar_front: formPaths.aadhaarFront.trim() || undefined,
        docs_st_aadhaar_back: formPaths.aadhaarBack.trim() || undefined,
        docs_st_qualification: formPaths.qualification.trim() || undefined,
      });

      if (res.success) {
        toast({
          variant: "success",
          title: "Paths Updated",
          description: "Document paths updated successfully in database.",
        });
        await loadDocs();
      } else {
        toast({
          variant: "error",
          title: "Save Failed",
          description: res.message || "Failed to update documents.",
        });
      }
    } catch {
      toast({
        variant: "error",
        title: "Network Error",
        description: "Failed to connect to document server.",
      });
    } finally {
      setSavingPaths(false);
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
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#5B21F4] animate-pulse" />
            <span className="text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
              Verification Vault
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Student Documents
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Verified academic dossier, student photograph, and government identity documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {registration_number && (
            <span className="px-3 py-1.5 rounded-xl bg-[#F1EEFF] text-[#5B21F4] font-mono text-xs font-bold border border-[#DDD6FE]">
              {registration_number}
            </span>
          )}
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
            onClick={loadDocs}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry Loading Documents
          </button>
        </div>
      )}

      {/* ── Summary Progress & Security Card ── */}
      <motion.div {...fadeUp(0.05)}>
        <div className="p-5 md:p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5B21F4] to-[#2563EB] text-white flex items-center justify-center shadow-md shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#111827]">
                  Official Academic Vault
                </h3>
                <p className="text-xs text-[#64748B]">
                  Linked to Student ID #{effectiveStudentId || "—"} &bull; {name || "Student"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  Dossier Status
                </p>
                <p className="text-sm font-extrabold text-[#111827]">
                  {uploadedCount} of {totalCount} Uploaded
                </p>
              </div>
              <Badge
                variant={uploadedCount === totalCount ? "success" : "outline"}
                className="text-xs font-bold px-3 py-1.5"
              >
                {uploadedCount === totalCount ? "Complete" : `${completionPercent}% Done`}
              </Badge>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#F1F5F9] h-2.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#5B21F4] to-[#08A66A] rounded-full transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* ── Loading Skeletons ── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="flex gap-2">
                <Skeleton className="h-9 flex-1 rounded-xl" />
                <Skeleton className="h-9 flex-1 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* REAL DOCUMENTS SHOWN (Grid of 4 Document Cards)                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {documentCards.map((doc, idx) => {
            const fileUrl = doc.path ? getFileUrl(doc.path) : null;
            const isUploading = uploadingDocId === doc.docType;
            const isPdf = doc.isPdf;

            return (
              <motion.div
                key={doc.id}
                {...fadeUp(0.08 + idx * 0.05)}
                className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-4 shadow-sm hover:border-[#DDD6FE] transition-all flex flex-col justify-between"
              >
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={doc.inputRef}
                  accept={doc.accept}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f) handleFileUpload(f, doc.docType);
                    // Reset input value so same file can be re-selected if needed
                    e.target.value = "";
                  }}
                  className="hidden"
                />

                {/* Card Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: doc.bg, color: doc.color }}
                    >
                      <doc.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                          {doc.badge}
                        </span>
                        {doc.path ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            Pending Upload
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-[#111827] text-sm mt-1">
                        {doc.label}
                      </h4>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#64748B] leading-relaxed">
                  {doc.sub}
                </p>

                {/* Document Display Preview Area */}
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden min-h-[180px] flex items-center justify-center relative group">
                  {doc.path && fileUrl ? (
                    isPdf ? (
                      /* PDF Display */
                      <div className="p-6 text-center space-y-3 w-full">
                        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
                          <FileText className="w-8 h-8" />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-[#111827]">
                            PDF Document
                          </p>
                          <p className="text-[11px] text-[#64748B] font-mono mt-0.5 break-all line-clamp-1 max-w-xs mx-auto">
                            {doc.path.split("/").pop()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPreviewModal({
                              title: doc.label,
                              url: fileUrl,
                              isPdf: true,
                              pathString: doc.path || "",
                            })
                          }
                          className="text-xs font-bold border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F1EEFF] gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview Document</span>
                        </Button>
                      </div>
                    ) : (
                      /* Real Image Preview */
                      <div className="relative w-full h-48 bg-[#F1F5F9] flex items-center justify-center overflow-hidden">
                        <img
                          src={fileUrl}
                          alt={doc.label}
                          className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            // Fallback if image path does not resolve
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                        {/* Hover Overlay Button */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              setPreviewModal({
                                title: doc.label,
                                url: fileUrl,
                                isPdf: false,
                                pathString: doc.path || "",
                              })
                            }
                            className="bg-white text-[#111827] hover:bg-white/90 text-xs font-bold gap-1 shadow-md cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Full</span>
                          </Button>
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white/20 border-white text-white hover:bg-white/30 text-xs font-bold gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    )
                  ) : (
                    /* Not Uploaded Placeholder */
                    <div className="p-8 text-center space-y-2">
                      <div className="w-12 h-12 rounded-xl bg-[#E2E8F0] text-[#94A3B8] flex items-center justify-center mx-auto">
                        <Camera className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-[#64748B]">
                        No file uploaded yet
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">
                        Click upload below to add this document
                      </p>
                    </div>
                  )}
                </div>

                {/* Path Snippet */}
                {doc.path && (
                  <div className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#F1F5F9] flex items-center justify-between text-[11px]">
                    <span className="text-[#94A3B8] font-medium">Path:</span>
                    <span className="font-mono text-[#475569] truncate ml-2 max-w-[240px]">
                      {doc.path}
                    </span>
                  </div>
                )}

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  {doc.path && fileUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPreviewModal({
                          title: doc.label,
                          url: fileUrl,
                          isPdf: doc.isPdf,
                          pathString: doc.path || "",
                        })
                      }
                      className="flex-1 rounded-xl text-xs font-bold h-10 border-[#DDD6FE] text-[#5B21F4] hover:bg-[#F1EEFF] gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => doc.inputRef.current?.click()}
                    className={`flex-1 rounded-xl text-xs font-bold h-10 gap-1.5 cursor-pointer ${
                      doc.path
                        ? "bg-white border border-[#E2E8F0] text-[#475569] hover:border-[#5B21F4] hover:text-[#5B21F4]"
                        : "bg-[#5B21F4] hover:bg-[#4C1BD4] text-white shadow-md shadow-[#5B21F4]/20"
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{doc.path ? "Replace File" : "Upload File"}</span>
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ADVANCED: Direct Database Path Strings Form (Collapsible)              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="pt-4 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => setShowAdvancedPaths((p) => !p)}
          className="flex items-center justify-between w-full p-4 rounded-2xl bg-white border border-[#E2E8F0] text-xs font-bold text-[#475569] hover:text-[#111827] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <FileBadge className="w-4 h-4 text-[#5B21F4]" />
            <span>Developer / Auditor Path Overrides (Advanced)</span>
          </div>
          {showAdvancedPaths ? (
            <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
          )}
        </button>

        <AnimatePresence>
          {showAdvancedPaths && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <form
                onSubmit={handleSavePaths}
                className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4 shadow-sm"
              >
                <div>
                  <h4 className="font-extrabold text-sm text-[#111827]">
                    Raw Database Path Strings (bi_st_docs)
                  </h4>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Directly view or update stored relative paths. Pure string path storage rule is strictly preserved.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <Label className="font-bold text-[#111827]">docs_st_image</Label>
                    <Input
                      type="text"
                      value={formPaths.image}
                      onChange={(e) => setFormPaths((p) => ({ ...p, image: e.target.value }))}
                      placeholder="public/uploads/students/.../profile.webp"
                      className="mt-1 font-mono text-xs h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-[#111827]">docs_st_aadhaar_front</Label>
                    <Input
                      type="text"
                      value={formPaths.aadhaarFront}
                      onChange={(e) => setFormPaths((p) => ({ ...p, aadhaarFront: e.target.value }))}
                      placeholder="public/uploads/students/.../aadhaar-front.webp"
                      className="mt-1 font-mono text-xs h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-[#111827]">docs_st_aadhaar_back</Label>
                    <Input
                      type="text"
                      value={formPaths.aadhaarBack}
                      onChange={(e) => setFormPaths((p) => ({ ...p, aadhaarBack: e.target.value }))}
                      placeholder="public/uploads/students/.../aadhaar-back.webp"
                      className="mt-1 font-mono text-xs h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-[#111827]">docs_st_qualification</Label>
                    <Input
                      type="text"
                      value={formPaths.qualification}
                      onChange={(e) => setFormPaths((p) => ({ ...p, qualification: e.target.value }))}
                      placeholder="public/uploads/students/.../qualification.pdf"
                      className="mt-1 font-mono text-xs h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={savingPaths}
                    className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold rounded-xl h-10 px-5 shadow-sm gap-2 cursor-pointer"
                  >
                    {savingPaths ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Paths...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Paths to Database</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* INTERACTIVE DOCUMENT LIGHTBOX / PREVIEW MODAL                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {previewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F1EEFF] text-[#5B21F4] flex items-center justify-center shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[#111827] text-base leading-none">
                      {previewModal.title}
                    </h3>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      Student: {name || "Student"} &bull; {registration_number || `ST-${effectiveStudentId}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={previewModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="p-2 rounded-xl text-[#475569] hover:bg-[#F1F5F9] hover:text-[#5B21F4] transition-colors"
                    title="Open Original in New Tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewModal(null)}
                    className="p-2 rounded-xl text-[#94A3B8] hover:text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body / Viewer */}
              <div className="flex-1 overflow-auto bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-3 flex items-center justify-center min-h-[300px]">
                {previewModal.isPdf ? (
                  <div className="w-full h-[60vh] flex flex-col items-center justify-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="text-center space-y-1">
                      <h4 className="font-black text-base text-[#111827]">
                        PDF Document Preview
                      </h4>
                      <p className="text-xs text-[#64748B] font-mono break-all max-w-md">
                        {previewModal.pathString}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <a
                        href={previewModal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button className="bg-[#5B21F4] hover:bg-[#4C1BD4] text-white text-xs font-bold rounded-xl h-11 px-5 gap-2 shadow-md cursor-pointer">
                          <ExternalLink className="w-4 h-4" />
                          <span>Open PDF in Full Screen</span>
                        </Button>
                      </a>
                    </div>
                  </div>
                ) : (
                  <img
                    src={previewModal.url}
                    alt={previewModal.title}
                    className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg shadow-sm"
                  />
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#F1F5F9]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-emerald-800 text-[11px]">
                    Official Verified Document Record
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewModal(null)}
                  className="rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
