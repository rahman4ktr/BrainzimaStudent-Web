// app/api/notes/route.ts
// Proxy handler for /api/notes to Brainzima PHP REST API backend
// Endpoints:
// - GET: List study notes for enrolled courses
// - POST: Upload notes PDF to uploads/images/notes/ and persist full public URL

import { NextRequest, NextResponse } from "next/server";
import { toFullPublicUrl } from "@/lib/imageStorage";

const PHP_API =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.brainzima.com/student/api";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/notes`, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);

    // Normalize notes_pdf paths to full public URLs
    if (Array.isArray(data?.data)) {
      data.data = data.data.map((note: any) => ({
        ...note,
        notes_pdf: toFullPublicUrl(note.notes_pdf),
      }));
    } else if (Array.isArray(data?.data?.notes)) {
      data.data.notes = data.data.notes.map((note: any) => ({
        ...note,
        notes_pdf: toFullPublicUrl(note.notes_pdf),
      }));
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Notes API] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to connect to study notes service." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "admin";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const incomingFormData = await req.formData();
      const outgoingFormData = new FormData();

      for (const [key, value] of incomingFormData.entries()) {
        if (value && typeof value === "object" && typeof (value as any).arrayBuffer === "function") {
          const file = value as File;
          const bytes = await file.arrayBuffer();
          const blob = new Blob([bytes], { type: file.type || "application/pdf" });
          outgoingFormData.append(key, blob, file.name);
        } else {
          outgoingFormData.append(key, String(value));
        }
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (userId) headers["X-User-Id"] = userId;
      if (userRole) headers["X-User-Role"] = userRole;

      const res = await fetch(`${PHP_API}/notes`, {
        method: "POST",
        headers,
        body: outgoingFormData,
      });

      const data = await res.json().catch(() => null);

      if (data?.data && typeof data.data === "object") {
        if (data.data.notes_pdf) {
          data.data.notes_pdf = toFullPublicUrl(data.data.notes_pdf);
        }
      }

      return NextResponse.json(data, { status: res.status });
    }

    const body = await req.json().catch(() => ({}));
    if (body.notes_pdf) {
      body.notes_pdf = toFullPublicUrl(body.notes_pdf);
    }

    const res = await fetch(`${PHP_API}/notes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(userId ? { "X-User-Id": userId } : {}),
        ...(userRole ? { "X-User-Role": userRole } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (data?.data && typeof data.data === "object") {
      if (data.data.notes_pdf) {
        data.data.notes_pdf = toFullPublicUrl(data.data.notes_pdf);
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[Notes API] POST error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to upload study notes." },
      { status: 500 }
    );
  }
}
