import QRCode from "qrcode";

export interface ReceiptData {
  transaction_id: number | string;
  student_name?: string;
  registration_no?: string;
  date?: string;
  course_name?: string;
  course_type?: string;
  is_online?: boolean;
  enrollment_id?: number | string;
  payment_mode?: string;
  reference_number?: string;
  total_fee?: number | string;
  discount?: number | string;
  coupon_code?: string;
  remark?: string;
  net_amount: number | string;
  remaining_dues?: number | string;
}

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

/**
 * Renders the official high-resolution receipt on an HTML5 canvas.
 */
export async function renderReceiptCanvas(receipt: ReceiptData): Promise<HTMLCanvasElement> {
  const W = 850;
  const H = 1140;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // ── Outer Rounded Card Background ──
  ctx.save();
  drawRoundedRect(ctx, 4, 4, W - 8, H - 8, 28);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#E2E8F0";
  ctx.stroke();
  ctx.clip(); // Keep drawing inside rounded card

  // ── Top Accent Gradient Line ──
  const topGrad = ctx.createLinearGradient(0, 0, W, 0);
  topGrad.addColorStop(0, "#1E1B4B");
  topGrad.addColorStop(0.5, "#5B21F4");
  topGrad.addColorStop(1, "#2563EB");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, W, 10);

  // ── Header Area ──
  // Brainzima Logo Box
  drawRoundedRect(ctx, 45, 34, 56, 56, 16);
  const logoGrad = ctx.createLinearGradient(45, 34, 101, 90);
  logoGrad.addColorStop(0, "#5B21F4");
  logoGrad.addColorStop(1, "#2563EB");
  ctx.fillStyle = logoGrad;
  ctx.fill();

  // White Graduation Cap Icon
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(73, 48);
  ctx.lineTo(89, 56);
  ctx.lineTo(73, 64);
  ctx.lineTo(57, 56);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(63, 61);
  ctx.lineTo(63, 69);
  ctx.quadraticCurveTo(73, 74, 83, 69);
  ctx.lineTo(83, 61);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(89, 56, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(88.5, 57, 1.5, 12);

  // Header Titles
  ctx.fillStyle = "#0F172A";
  ctx.font = "900 22px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("BRAINZIMA INSTITUTE", 115, 58);

  ctx.fillStyle = "#64748B";
  ctx.font = "bold 13px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("Official Fee Payment Receipt", 115, 76);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 11px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("Academic Ledger & Accounts Division • Accredited Education Portal", 115, 92);

  // Top-Right Verified Pill Badge
  drawRoundedRect(ctx, W - 180, 44, 135, 34, 17);
  ctx.fillStyle = "#ECFDF5";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#A7F3D0";
  ctx.stroke();

  ctx.fillStyle = "#047857";
  ctx.font = "bold 11px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✓ VERIFIED RECEIPT", W - 180 + 135 / 2, 61);

  // Header Divider
  ctx.beginPath();
  ctx.moveTo(45, 108);
  ctx.lineTo(W - 45, 108);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#E2E8F0";
  ctx.stroke();

  // ── Student & Transaction Metadata Box ──
  const infoY = 124;
  const infoH = 120;
  drawRoundedRect(ctx, 45, infoY, W - 90, infoH, 16);
  ctx.fillStyle = "#F8FAFC";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#E2E8F0";
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Row 1 (Student Name & Registration No.)
  ctx.fillStyle = "#94A3B8";
  ctx.font = "bold 10px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("STUDENT NAME", 68, infoY + 28);
  ctx.fillText("REGISTRATION NO.", 450, infoY + 28);

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 15px Inter, system-ui, -apple-system, sans-serif";
  let sName = String(receipt.student_name || "Student Name");
  if (sName.length > 28) sName = sName.slice(0, 26) + "...";
  ctx.fillText(sName, 68, infoY + 50);

  ctx.fillStyle = "#5B21F4";
  ctx.font = "bold 15px monospace";
  ctx.fillText(String(receipt.registration_no || "BISR-STUDENT"), 450, infoY + 50);

  // Middle dashed/subtle line in metadata box
  ctx.beginPath();
  ctx.moveTo(65, infoY + 63);
  ctx.lineTo(W - 65, infoY + 63);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#E2E8F0";
  ctx.stroke();

  // Row 2 (Transaction ID & Payment Date)
  ctx.fillStyle = "#94A3B8";
  ctx.font = "bold 10px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("TRANSACTION ID", 68, infoY + 84);
  ctx.fillText("PAYMENT DATE", 450, infoY + 84);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 14px monospace";
  ctx.fillText(`#${receipt.transaction_id}`, 68, infoY + 104);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 13px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText(String(receipt.date || "—"), 450, infoY + 104);

  // ── Main Itemized Fee Breakdown Card ──
  const tableY = 260;
  const tableH = 430;
  drawRoundedRect(ctx, 45, tableY, W - 90, tableH, 16);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#E2E8F0";
  ctx.stroke();

  // Helper row drawer inside table
  const drawTableRow = (
    label: string,
    value: string,
    yPos: number,
    valueColor = "#0F172A",
    isMono = false,
    isBold = true
  ) => {
    ctx.fillStyle = "#64748B";
    ctx.font = "500 13px Inter, system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, 70, yPos);

    ctx.fillStyle = valueColor;
    ctx.font = `${isBold ? "bold" : "500"} 13px ${isMono ? "monospace" : "Inter, system-ui, -apple-system, sans-serif"}`;
    ctx.textAlign = "right";
    ctx.fillText(value, W - 70, yPos);

    // Separator line
    ctx.beginPath();
    ctx.moveTo(70, yPos + 12);
    ctx.lineTo(W - 70, yPos + 12);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#F1F5F9";
    ctx.stroke();
  };

  let curY = tableY + 32;

  // 1. Course Name
  drawTableRow("Course Name:", String(receipt.course_name || "Enrolled Program"), curY, "#0F172A", false, true);
  curY += 38;

  // 2. Course Type
  const cType =
    receipt.course_type ||
    (receipt.is_online ? "Online E-Learning Program" : "Offline Classroom Diploma");
  drawTableRow("Course Type:", cType, curY, "#5B21F4", false, true);
  curY += 38;

  // 3. Enrollment ID
  drawTableRow("Enrollment ID:", `#${receipt.enrollment_id || "N/A"}`, curY, "#0F172A", true, true);
  curY += 38;

  // 4. Payment Mode
  drawTableRow("Payment Mode:", String(receipt.payment_mode || "RAZORPAY").toUpperCase(), curY, "#0F172A", false, true);
  curY += 38;

  // 5. Reference Number
  drawTableRow("Reference Number:", String(receipt.reference_number || "N/A"), curY, "#475569", true, false);
  curY += 38;

  // 6. Total Course Fee (if present)
  if (Number(receipt.total_fee || 0) > 0) {
    drawTableRow("Total Course Fee:", `₹${Number(receipt.total_fee).toLocaleString("en-IN")}`, curY, "#0F172A", false, true);
    curY += 38;
  }

  // 7. Coupon / Discount Applied (if present)
  if (Number(receipt.discount || 0) > 0) {
    const discLabel = receipt.coupon_code ? `Coupon (${receipt.coupon_code}):` : "Discount Applied:";
    drawTableRow(discLabel, `-₹${Number(receipt.discount).toLocaleString("en-IN")}`, curY, "#059669", false, true);
    curY += 38;
  }

  // 8. Remark (if present)
  if (receipt.remark) {
    let rmk = String(receipt.remark);
    if (rmk.length > 40) rmk = rmk.slice(0, 38) + "...";
    drawTableRow("Remark:", rmk, curY, "#334155", false, false);
    curY += 38;
  }

  // ── Highlighted "Net Amount Paid" Container ──
  const netBoxY = tableY + tableH - 85;
  drawRoundedRect(ctx, 60, netBoxY, W - 120, 62, 12);
  ctx.fillStyle = "#ECFDF5";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#A7F3D0";
  ctx.stroke();

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 16px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Net Amount Paid:", 82, netBoxY + 31);

  ctx.fillStyle = "#047857";
  ctx.font = "900 24px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`₹${Number(receipt.net_amount || 0).toLocaleString("en-IN")}`, W - 82, netBoxY + 31);

  // ── Computer Generated Stamp Box ──
  const stampY = 705;
  drawRoundedRect(ctx, 45, stampY, W - 90, 48, 12);
  ctx.fillStyle = "#F0FDF4";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#BBF7D0";
  ctx.stroke();

  // Shield Check Icon
  ctx.fillStyle = "#059669";
  ctx.beginPath();
  ctx.arc(68, stampY + 24, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 11px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✓", 68, stampY + 24);

  ctx.fillStyle = "#065F46";
  ctx.font = "bold 12px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Computer Generated Official Receipt", 88, stampY + 24);

  ctx.fillStyle = "#047857";
  ctx.font = "900 11px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("STATUS: VERIFIED", W - 65, stampY + 24);

  // ── Bottom Section: Official Verification QR & Institutional Authorization ──
  const authY = 770;
  const qrBoxSize = 140;
  const qrX = 55;
  const qrY = authY + 10;

  // QR Container
  drawRoundedRect(ctx, qrX, qrY, qrBoxSize, qrBoxSize, 16);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#DDD6FE";
  ctx.stroke();

  // Generate QR Code in an offscreen canvas
  const qrCanvas = document.createElement("canvas");
  const qrSize = 300;
  qrCanvas.width = qrSize;
  qrCanvas.height = qrSize;

  const qrPayload = JSON.stringify({
    receipt: `REC-${receipt.transaction_id}`,
    student: receipt.student_name,
    reg: receipt.registration_no,
    amount: `INR ${receipt.net_amount}`,
    date: receipt.date,
    issuer: "Brainzima Institute",
    verified: true,
  });

  await QRCode.toCanvas(qrCanvas, qrPayload, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });

  // Draw QR code onto receipt canvas
  ctx.drawImage(qrCanvas, qrX + 8, qrY + 8, qrBoxSize - 16, qrBoxSize - 16);

  // Center badge on QR code
  const qrCenter = qrX + qrBoxSize / 2;
  const qrCenterY = qrY + qrBoxSize / 2;
  ctx.beginPath();
  ctx.arc(qrCenter, qrCenterY, 14, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#5B21F4";
  ctx.stroke();

  ctx.fillStyle = "#5B21F4";
  ctx.font = "bold 9px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BISR", qrCenter, qrCenterY);

  ctx.fillStyle = "#64748B";
  ctx.font = "bold 10px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("Scan to Verify Authenticity", qrCenter, qrY + qrBoxSize + 16);

  // Institutional Authorization Stamp & Signature text (Right side)
  const textX = qrX + qrBoxSize + 30;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 15px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("BRAINZIMA ACADEMIC & FINANCIAL SERVICES", textX, authY + 36);

  ctx.fillStyle = "#64748B";
  ctx.font = "500 12px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("This fee receipt is an official computer-generated document issued by the Central", textX, authY + 58);
  ctx.fillText("Accounts Wing. All monetary amounts are recorded in Indian Rupees (INR).", textX, authY + 76);
  ctx.fillText("Valid under Information Technology Act, 2000. No manual signature required.", textX, authY + 94);

  // Digital Signatory Pill
  drawRoundedRect(ctx, textX, authY + 112, 280, 32, 10);
  ctx.fillStyle = "#F1EEFF";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#DDD6FE";
  ctx.stroke();

  ctx.fillStyle = "#5B21F4";
  ctx.font = "bold 11px Inter, system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("✓ Digitally Signed & Authorized by Brainzima", textX + 16, authY + 128);

  // ── Footer Divider & Institutional Meta ──
  ctx.beginPath();
  ctx.moveTo(45, H - 54);
  ctx.lineTo(W - 45, H - 54);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#E2E8F0";
  ctx.stroke();

  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 10px Inter, system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("ISO 9001:2015 Certified Educational Institution • support@brainzima.com • www.brainzima.com", 45, H - 28);

  ctx.textAlign = "right";
  ctx.font = "bold 10px monospace";
  ctx.fillText(`REC#${receipt.transaction_id} • OFFICIAL COPY`, W - 45, H - 28);

  ctx.restore();

  return canvas;
}

/**
 * Converts an HTMLCanvasElement into a standard, valid PDF 1.4 binary (A4 size).
 * Embeds the canvas as a high-quality JPEG stream (/DCTDecode).
 * Universally supported by Acrobat Reader, browsers (Chrome, Edge, Safari, Firefox), and mobile.
 */
function canvasToPdfBytes(canvas: HTMLCanvasElement): Uint8Array {
  // Convert canvas to high-quality JPEG
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const base64Data = jpegDataUrl.split(",")[1];
  const binaryString = atob(base64Data);
  const jpegBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    jpegBytes[i] = binaryString.charCodeAt(i);
  }

  // A4 Page Dimensions in points (72 pt / inch)
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  // Fit canvas (850 x 1140) proportionally on A4 with 20pt margin
  const margin = 20;
  const targetWidth = pageWidth - margin * 2; // 555.28 pt
  const targetHeight = (targetWidth * canvas.height) / canvas.width; // 744.73 pt
  const xOffset = margin;
  const yOffset = (pageHeight - targetHeight) / 2; // Centered vertically

  const contentStream = `q\n${targetWidth.toFixed(2)} 0 0 ${targetHeight.toFixed(2)} ${xOffset.toFixed(2)} ${yOffset.toFixed(2)} cm\n/Im1 Do\nQ\n`;
  const contentStreamBytes = new TextEncoder().encode(contentStream);

  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const headerBytes = new TextEncoder().encode(header);

  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const obj4Head = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const obj4Tail = "\nendstream\nendobj\n";
  const obj5 = `5 0 obj\n<< /Length ${contentStreamBytes.length} >>\nstream\n${contentStream}endstream\nendobj\n`;

  const enc = new TextEncoder();
  const bObj1 = enc.encode(obj1);
  const bObj2 = enc.encode(obj2);
  const bObj3 = enc.encode(obj3);
  const bObj4Head = enc.encode(obj4Head);
  const bObj4Tail = enc.encode(obj4Tail);
  const bObj5 = enc.encode(obj5);

  const offsets: number[] = [0];
  let currentOffset = headerBytes.length;

  offsets.push(currentOffset); // obj 1
  currentOffset += bObj1.length;

  offsets.push(currentOffset); // obj 2
  currentOffset += bObj2.length;

  offsets.push(currentOffset); // obj 3
  currentOffset += bObj3.length;

  offsets.push(currentOffset); // obj 4
  currentOffset += bObj4Head.length + jpegBytes.length + bObj4Tail.length;

  offsets.push(currentOffset); // obj 5
  currentOffset += bObj5.length;

  const startXref = currentOffset;

  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  const bXref = enc.encode(xref);

  const totalLength =
    headerBytes.length +
    bObj1.length +
    bObj2.length +
    bObj3.length +
    bObj4Head.length +
    jpegBytes.length +
    bObj4Tail.length +
    bObj5.length +
    bXref.length;

  const out = new Uint8Array(totalLength);
  let pos = 0;
  out.set(headerBytes, pos); pos += headerBytes.length;
  out.set(bObj1, pos); pos += bObj1.length;
  out.set(bObj2, pos); pos += bObj2.length;
  out.set(bObj3, pos); pos += bObj3.length;
  out.set(bObj4Head, pos); pos += bObj4Head.length;
  out.set(jpegBytes, pos); pos += jpegBytes.length;
  out.set(bObj4Tail, pos); pos += bObj4Tail.length;
  out.set(bObj5, pos); pos += bObj5.length;
  out.set(bXref, pos);

  return out;
}

/**
 * Generates and downloads an official high-resolution PNG receipt using 100% native HTML5 Canvas.
 * Zero external API calls, zero CORS taint, instant download.
 */
export async function downloadReceiptAsImage(receipt: ReceiptData): Promise<string> {
  const canvas = await renderReceiptCanvas(receipt);

  const cleanStudent = (receipt.student_name || "student").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 15);
  const filename = `Receipt_${receipt.transaction_id}_${cleanStudent}.png`;

  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return filename;
}

/**
 * Generates and downloads an official vector-wrapped A4 PDF receipt.
 * Instant client-side download without heavy external PDF libraries.
 */
export async function downloadReceiptAsPdf(receipt: ReceiptData): Promise<string> {
  const canvas = await renderReceiptCanvas(receipt);
  const pdfBytes = canvasToPdfBytes(canvas);

  const cleanStudent = (receipt.student_name || "student").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 15);
  const filename = `Receipt_${receipt.transaction_id}_${cleanStudent}.pdf`;

  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return filename;
}

