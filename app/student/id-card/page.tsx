"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Printer,
  Download,
  Loader2,
  ShieldCheck,
  QrCode,
  Calendar,
  Phone,
  Mail,
  User,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import QRCode from "qrcode";
import { useStudent } from "@/hooks/useStudent";
import { formatRegistrationNumber } from "@/lib/studentUtils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y + w, x, y, r);
  ctx.closePath();
}

export default function StudentIdCardPage() {
  const {
    name,
    registration_number,
    student_id,
    user_id,
    email,
    mobile,
    user_image,
  } = useStudent();

  const printRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [avatarError, setAvatarError] = useState<boolean>(false);
  const { toast } = useToast();

  const bisrId =
    registration_number ||
    formatRegistrationNumber(student_id) ||
    (user_id ? `BISR${String(user_id).padStart(4, "0")}` : "BISR-STUDENT");

  const initials = (name || email || "Student")
    .replace(/@.*/, "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "S";

  const isValidAvatarUrl = Boolean(
    user_image &&
      typeof user_image === "string" &&
      (user_image.startsWith("http://") ||
        user_image.startsWith("https://") ||
        user_image.startsWith("/") ||
        user_image.startsWith("data:"))
  );

  // ── Local QR Code for On-Screen Display ───────────────────────────────────
  useEffect(() => {
    if (!bisrId) return;

    let isMounted = true;
    const generateScreenQr = async () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 600;
        canvas.width = size;
        canvas.height = size;

        await QRCode.toCanvas(canvas, bisrId, {
          width: size,
          margin: 2,
          errorCorrectionLevel: "H",
          color: {
            dark: "#0F172A",
            light: "#FFFFFF",
          },
        });

        const ctx = canvas.getContext("2d");
        if (ctx) {
          const center = size / 2;
          const radius = 48;

          ctx.beginPath();
          ctx.arc(center, center, radius + 4, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#5B21F4";
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(center, center, radius, 0, Math.PI * 2);
          ctx.fillStyle = "#F8FAFC";
          ctx.fill();

          ctx.font = "bold 20px Inter, system-ui, -apple-system, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#5B21F4";
          ctx.fillText("Brainzima", center, center - 6);

          ctx.font = "bold 12px Inter, system-ui, -apple-system, sans-serif";
          ctx.fillStyle = "#10B981";
          ctx.fillText("Verified", center, center + 14);
        }

        const dataUrl = canvas.toDataURL("image/png");
        if (isMounted) setQrCodeDataUrl(dataUrl);
      } catch (err) {
        console.warn("[StudentIdCard] Screen QR error, fallback:", err);
        if (isMounted) {
          QRCode.toDataURL(bisrId, { width: 600, margin: 2, errorCorrectionLevel: "H" })
            .then((url) => {
              if (isMounted) setQrCodeDataUrl(url);
            })
            .catch(() => {});
        }
      }
    };

    generateScreenQr();
    return () => {
      isMounted = false;
    };
  }, [bisrId]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // ── Pure HTML5 Canvas ID Card Generation & Instant Download ───────────────
  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    const cleanId = (bisrId || "student").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${cleanId}_ID_Card.png`;

    try {
      const canvas = document.createElement("canvas");
      const W = 600;
      const H = 980;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not initialize 2D canvas context");
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // ── Outer Card Background with Rounded Corners ──
      ctx.save();
      drawRoundedRect(ctx, 4, 4, W - 8, H - 8, 32);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#E2E8F0";
      ctx.stroke();
      ctx.clip(); // Restrict drawing strictly inside rounded card bounds

      // ── Header Gradient Banner ──
      const headerGrad = ctx.createLinearGradient(0, 0, W, 170);
      headerGrad.addColorStop(0, "#1E1B4B");
      headerGrad.addColorStop(0.5, "#5B21F4");
      headerGrad.addColorStop(1, "#2563EB");
      ctx.fillStyle = headerGrad;
      ctx.fillRect(0, 0, W, 170);

      // Top Lanyard slot
      drawRoundedRect(ctx, (W - 90) / 2, 14, 90, 8, 4);
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fill();

      // Graduation Cap Icon Box (Left)
      drawRoundedRect(ctx, 35, 52, 46, 46, 14);
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.stroke();

      // Graduation Cap Icon
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(58, 64);
      ctx.lineTo(73, 72);
      ctx.lineTo(58, 80);
      ctx.lineTo(43, 72);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(49, 77);
      ctx.lineTo(49, 86);
      ctx.quadraticCurveTo(58, 91, 67, 86);
      ctx.lineTo(67, 77);
      ctx.closePath();
      ctx.fill();

      // Header Brand Text
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 17px Inter, system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("BRAINZIMA INSTITUTE", 92, 72);

      ctx.fillStyle = "#DDD6FE";
      ctx.font = "bold 10px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillText("ACADEMIC STUDENT PASS", 92, 88);

      // Verified Badge (Right)
      drawRoundedRect(ctx, 470, 60, 95, 30, 15);
      ctx.fillStyle = "#10B981";
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 12px Inter, system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓ Verified", 517, 75);

      // ── Centered Avatar ──
      const avSize = 96;
      const avX = (W - avSize) / 2;
      const avY = 120;

      // Outer White Frame
      drawRoundedRect(ctx, avX - 4, avY - 4, avSize + 8, avSize + 8, 24);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      // Avatar Content (Gradient with student initials)
      ctx.save();
      drawRoundedRect(ctx, avX, avY, avSize, avSize, 20);
      ctx.clip();

      const avGrad = ctx.createLinearGradient(avX, avY, avX + avSize, avY + avSize);
      avGrad.addColorStop(0, "#5B21F4");
      avGrad.addColorStop(1, "#2563EB");
      ctx.fillStyle = avGrad;
      ctx.fillRect(avX, avY, avSize, avSize);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 38px Inter, system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials, avX + avSize / 2, avY + avSize / 2);
      ctx.restore();

      // ── Student Name ──
      ctx.fillStyle = "#0F172A";
      ctx.font = "900 22px Inter, system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      let displayName = name || email || "Student Name";
      if (displayName.length > 26) {
        displayName = displayName.slice(0, 24) + "...";
      }
      ctx.fillText(displayName, W / 2, 252);

      // ── Badges: ID + Enrolled Active ──
      ctx.font = "bold 12px monospace";
      const idLabel = `ID: ${bisrId}`;
      const idW = ctx.measureText(idLabel).width + 24;

      ctx.font = "bold 11px Inter, system-ui, -apple-system, sans-serif";
      const actLabel = "Enrolled Active";
      const actW = ctx.measureText(actLabel).width + 20;

      const totalBadgesW = idW + 12 + actW;
      const badgesStartX = (W - totalBadgesW) / 2;

      // ID Badge
      drawRoundedRect(ctx, badgesStartX, 266, idW, 25, 8);
      ctx.fillStyle = "#F1EEFF";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#DDD6FE";
      ctx.stroke();

      ctx.fillStyle = "#5B21F4";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(idLabel, badgesStartX + idW / 2, 278);

      // Enrolled Active Badge
      drawRoundedRect(ctx, badgesStartX + idW + 12, 266, actW, 25, 8);
      ctx.fillStyle = "#ECFDF5";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#A7F3D0";
      ctx.stroke();

      ctx.fillStyle = "#047857";
      ctx.font = "bold 11px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillText(actLabel, badgesStartX + idW + 12 + actW / 2, 278);

      // ── QR Code Section Container ──
      const qrCardY = 306;
      drawRoundedRect(ctx, 35, qrCardY, 530, 394, 24);
      ctx.fillStyle = "#F8FAFC";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#DDD6FE";
      ctx.stroke();

      // "SCAN TO VERIFY IDENTITY" Header
      ctx.fillStyle = "#5B21F4";
      ctx.font = "bold 12px Inter, system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("❖  SCAN TO VERIFY IDENTITY", W / 2, qrCardY + 28);

      // White Inner QR Card
      const qrBoxSize = 270;
      const qrBoxX = (W - qrBoxSize) / 2;
      const qrBoxY = qrCardY + 44;

      drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#DDD6FE";
      ctx.stroke();

      // Render QR code directly to an offscreen canvas
      const qrInnerCanvas = document.createElement("canvas");
      const qrInnerSize = 500;
      qrInnerCanvas.width = qrInnerSize;
      qrInnerCanvas.height = qrInnerSize;
      await QRCode.toCanvas(qrInnerCanvas, bisrId, {
        width: qrInnerSize,
        margin: 2,
        errorCorrectionLevel: "H",
        color: {
          dark: "#0F172A",
          light: "#FFFFFF",
        },
      });

      // Draw center Brainzima Verified badge on the QR code
      const qrCtx = qrInnerCanvas.getContext("2d");
      if (qrCtx) {
        const qrCenter = qrInnerSize / 2;
        const badgeRadius = 46;

        qrCtx.beginPath();
        qrCtx.arc(qrCenter, qrCenter, badgeRadius + 4, 0, Math.PI * 2);
        qrCtx.fillStyle = "#FFFFFF";
        qrCtx.fill();
        qrCtx.lineWidth = 3;
        qrCtx.strokeStyle = "#5B21F4";
        qrCtx.stroke();

        qrCtx.beginPath();
        qrCtx.arc(qrCenter, qrCenter, badgeRadius, 0, Math.PI * 2);
        qrCtx.fillStyle = "#F8FAFC";
        qrCtx.fill();

        qrCtx.font = "bold 18px Inter, system-ui, -apple-system, sans-serif";
        qrCtx.textAlign = "center";
        qrCtx.textBaseline = "middle";
        qrCtx.fillStyle = "#5B21F4";
        qrCtx.fillText("Brainzima", qrCenter, qrCenter - 6);

        qrCtx.font = "bold 11px Inter, system-ui, -apple-system, sans-serif";
        qrCtx.fillStyle = "#10B981";
        qrCtx.fillText("Verified", qrCenter, qrCenter + 14);
      }

      // Draw QR Canvas onto main card
      ctx.drawImage(qrInnerCanvas, qrBoxX + 15, qrBoxY + 15, qrBoxSize - 30, qrBoxSize - 30);

      // QR Code Bottom Label
      ctx.fillStyle = "#64748B";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${bisrId} • Brainzima Official`, W / 2, qrCardY + 348);

      // ── Student Details 2x2 Grid ──
      const detY = 718;
      drawRoundedRect(ctx, 35, detY, 530, 155, 20);
      ctx.fillStyle = "#F8FAFC";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#E2E8F0";
      ctx.stroke();

      // Row 1 (y=745)
      ctx.textAlign = "left";
      ctx.fillStyle = "#94A3B8";
      ctx.font = "bold 10px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillText("👤  STUDENT ID", 60, detY + 30);
      ctx.fillText("📅  SESSION", 320, detY + 30);

      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 14px monospace";
      ctx.fillText(String(student_id || user_id || "27"), 60, detY + 52);
      ctx.font = "bold 14px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillText("2024 - 2026", 320, detY + 52);

      // Row 2 (y=810)
      ctx.fillStyle = "#94A3B8";
      ctx.font = "bold 10px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillText("📞  MOBILE", 60, detY + 95);
      ctx.fillText("✉  EMAIL", 320, detY + 95);

      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 13px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillText(String(mobile || "4346464364"), 60, detY + 117);

      let dispEmail = String(email || "cajoya1929@flakeian.com");
      if (dispEmail.length > 25) {
        dispEmail = dispEmail.slice(0, 23) + "...";
      }
      ctx.fillText(dispEmail, 320, detY + 117);

      // ── Footer Divider & Security Text ──
      ctx.beginPath();
      ctx.moveTo(50, detY + 175);
      ctx.lineTo(W - 50, detY + 175);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#F1F5F9";
      ctx.stroke();

      ctx.fillStyle = "#059669";
      ctx.font = "bold 11px Inter, system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("✓ Authorized Signature Verified", 60, 948);

      ctx.fillStyle = "#94A3B8";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "right";
      ctx.fillText("ISO 9001:2015", W - 60, 948);

      ctx.restore();

      // ── Direct Browser Download ──
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        variant: "success",
        title: "ID Card Downloaded! 🎉",
        description: `Official student ID card saved as "${filename}".`,
      });
    } catch (err: any) {
      console.error("[StudentIdCard] Canvas download error:", err);
      toast({
        variant: "error",
        title: "Download Issue",
        description: "Could not export image. Please use the Print button to Save as PDF.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-xl mx-auto space-y-4 pb-20 print:p-0 print:pb-0">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F1EEFF] text-[#5B21F4] text-[10px] font-bold uppercase tracking-wider mb-1 border border-[#DDD6FE]/60">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B21F4] animate-pulse" />
            <span>Official Academic Pass</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] tracking-tight">
            Digital Student ID Card
          </h1>
          <p className="text-xs text-[#64748B]">
            Verified student identity pass with instant verification QR code.
          </p>
        </div>

        {/* Quick Top Download Button (Desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white font-bold text-xs rounded-xl h-9 px-3.5 gap-1.5 shadow-sm shadow-[#5B21F4]/20 cursor-pointer active:scale-95 transition-all"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Card</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={isDownloading}
            className="border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl h-9 px-3 gap-1 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </Button>
        </div>
      </div>

      {/* ── ID Card Preview Container (Compact Proportional PVC Size) ── */}
      <div className="flex justify-center items-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-[340px] sm:max-w-[350px]"
        >
          {/* ── ONLY THIS CARD IS CAPTURED & DOWNLOADED ── */}
          <div
            ref={printRef}
            id="student-id-card-element"
            className="w-full bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden relative"
          >
            {/* Lanyard Slot / Hole Indicator */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-white/30 z-20 print:hidden" />

            {/* Top Decorative Gradient Banner (Compact) */}
            <div className="pt-4 pb-10 px-4 bg-gradient-to-br from-[#1E1B4B] via-[#5B21F4] to-[#2563EB] flex items-center justify-between relative overflow-hidden text-white">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-2 z-10">
                <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xs shrink-0">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-xs tracking-tight leading-none">
                    BRAINZIMA INSTITUTE
                  </p>
                  <p className="text-[#DDD6FE] text-[9px] font-bold tracking-wider uppercase mt-0.5">
                    Academic Student Pass
                  </p>
                </div>
              </div>

              <Badge className="bg-emerald-500 text-white border-none text-[9px] font-bold gap-1 px-2 py-0.5 shadow-xs shrink-0">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified</span>
              </Badge>
            </div>

            {/* Card Body */}
            <div className="px-4 pb-4 pt-0 relative bg-white">
              {/* Centered Avatar (Gracefully handles broken image URLs) */}
              <div className="flex justify-center -mt-8 mb-2">
                <div className="w-16 h-16 rounded-xl bg-white p-0.5 shadow-lg border-2 border-white shrink-0 overflow-hidden">
                  {isValidAvatarUrl && !avatarError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user_image!}
                      alt={name || "Student"}
                      onError={() => setAvatarError(true)}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div
                      className="w-full h-full rounded-lg flex items-center justify-center text-white font-black text-lg shadow-inner"
                      style={{ background: "linear-gradient(135deg, #5B21F4, #2563EB)" }}
                    >
                      {initials}
                    </div>
                  )}
                </div>
              </div>

              {/* Student Name & Badges */}
              <div className="text-center space-y-1 mb-2.5">
                <h2 className="text-base sm:text-lg font-black text-[#111827] leading-tight tracking-tight">
                  {name || email || "Student Name"}
                </h2>
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[10px] font-black text-[#5B21F4] bg-[#F1EEFF] px-2 py-0.5 rounded-md border border-[#DDD6FE]">
                    ID: {bisrId}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Enrolled Active
                  </span>
                </div>
              </div>

              {/* ── Compact Proportional QR Code Section ── */}
              <div className="my-2.5 p-2.5 rounded-xl bg-gradient-to-b from-[#F8FAFC] to-[#F1EEFF]/30 border border-[#DDD6FE] flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 mb-1.5 text-[#5B21F4]">
                  <QrCode className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Scan to Verify Identity
                  </span>
                </div>

                {/* QR Code Container (Proportional 150px) */}
                <div className="w-[150px] h-[150px] bg-white p-2 rounded-xl shadow-md border-2 border-[#DDD6FE] flex items-center justify-center transition-transform hover:scale-[1.02]">
                  {qrCodeDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrCodeDataUrl}
                      alt={`BISR QR Code for ${bisrId}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5">
                      <QrCode className="w-8 h-8 text-[#5B21F4] animate-pulse" />
                      <span className="text-[9px] font-semibold">Generating QR...</span>
                    </div>
                  )}
                </div>

                <span className="mt-1 text-[10px] font-mono font-bold text-[#64748B]">
                  {bisrId} • Brainzima Official
                </span>
              </div>

              {/* Student Details 2x2 Grid (Compact) */}
              <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[10px]">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-[#94A3B8] uppercase flex items-center gap-1">
                    <User className="w-2.5 h-2.5 text-[#5B21F4]" />
                    Student ID
                  </span>
                  <p className="font-mono font-bold text-[#111827]">{student_id || user_id || "27"}</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-[#94A3B8] uppercase flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-[#5B21F4]" />
                    Session
                  </span>
                  <p className="font-bold text-[#111827]">2024 - 2026</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-[#94A3B8] uppercase flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5 text-[#5B21F4]" />
                    Mobile
                  </span>
                  <p className="font-bold text-[#111827] truncate">{mobile || "4346464364"}</p>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-[#94A3B8] uppercase flex items-center gap-1">
                    <Mail className="w-2.5 h-2.5 text-[#5B21F4]" />
                    Email
                  </span>
                  <p className="font-bold text-[#111827] truncate">{email || "cajoya1929@flakeian.com"}</p>
                </div>
              </div>

              {/* Security Bottom Bar */}
              <div className="mt-2.5 pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[9px] text-[#94A3B8]">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Authorized Signature Verified
                </span>
                <span className="font-mono text-[8px] text-slate-400">
                  ISO 9001:2015
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Main Action Buttons: Download ID Card (Canvas) & Print ── */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1 print:hidden max-w-[340px] sm:max-w-[350px] mx-auto">
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full sm:flex-1 bg-gradient-to-r from-[#5B21F4] to-[#7C3AED] hover:from-[#4C1BD4] hover:to-[#6D28D9] text-white font-bold text-xs rounded-xl h-10 gap-2 shadow-md shadow-[#5B21F4]/20 cursor-pointer transition-all active:scale-[0.98]"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Downloading Card...</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Download ID Card</span>
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handlePrint}
          disabled={isDownloading}
          className="w-full sm:w-auto px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl h-10 gap-1.5 shadow-xs cursor-pointer transition-all active:scale-[0.98]"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Print</span>
        </Button>
      </div>

      {/* Helper notice */}
      <div className="text-center print:hidden">
        <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-[#5B21F4]" />
          High-definition PNG format suitable for mobile gallery, printing &amp; official verification.
        </p>
      </div>
    </div>
  );
}

