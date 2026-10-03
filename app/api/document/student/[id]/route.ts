// app/api/document/student/[id]/route.ts
// Proxy handler for student document paths to Brainzima PHP REST API backend

import { NextRequest, NextResponse } from "next/server";

const PHP_API =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://try.ajitdev.com/brainzima/student/api";

import { promises as fs } from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const cleanId = id.replace(/^student-/, "").trim();
    if (cleanId && userId) {
      try {
        const studentDir = path.join(process.cwd(), "public", "uploads", "students", cleanId);
        const exts = [".jpg", ".jpeg", ".png", ".webp"];
        let hasStudentPhoto = false;
        for (const ext of exts) {
          try {
            await fs.access(path.join(studentDir, `profile${ext}`));
            hasStudentPhoto = true;
            break;
          } catch {}
        }
        if (!hasStudentPhoto) {
          const userDirs = [
            path.join(process.cwd(), "public", "uploads", "users", `user-${userId}`),
            path.join(process.cwd(), "public", "uploads", "users", String(userId)),
          ];
          for (const uDir of userDirs) {
            for (const ext of exts) {
              const uFile = path.join(uDir, `profile${ext}`);
              try {
                await fs.access(uFile);
                await fs.mkdir(studentDir, { recursive: true });
                await fs.copyFile(uFile, path.join(studentDir, `profile${ext}`));
                const studentNamedDir = path.join(
                  process.cwd(),
                  "public",
                  "uploads",
                  "students",
                  `student-${cleanId}`
                );
                await fs.mkdir(studentNamedDir, { recursive: true });
                await fs.copyFile(uFile, path.join(studentNamedDir, `profile${ext}`));
                hasStudentPhoto = true;
                break;
              } catch {}
            }
            if (hasStudentPhoto) break;
          }
        }
      } catch {
        // ignore sync check error
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    const res = await fetch(`${PHP_API}/document/student/${id}`, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Document API] GET error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch student documents." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const userId = req.headers.get("x-user-id");
    const userRole = req.headers.get("x-user-role") || "student";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (userId) headers["X-User-Id"] = userId;
    if (userRole) headers["X-User-Role"] = userRole;

    // Requirement 10: Sanitize body — omit or send null, never create "undefined" or "null" string
    const cleanBody: Record<string, any> = {};
    const validFields = [
      "docs_st_image",
      "docs_st_aadhaar_front",
      "docs_st_aadhaar_back",
      "docs_st_qualification",
    ];

    for (const key of validFields) {
      if (key in body) {
        const val = body[key];
        if (val === null) {
          cleanBody[key] = null;
        } else if (typeof val === "string") {
          const trimmed = val.trim();
          if (
            !trimmed ||
            trimmed === "null" ||
            trimmed === "undefined" ||
            trimmed === "[object Object]"
          ) {
            cleanBody[key] = null;
          } else {
            cleanBody[key] = trimmed;
          }
        }
      }
    }

    const res = await fetch(`${PHP_API}/document/student/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(cleanBody),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("[Document API] POST error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to save student documents." },
      { status: 500 }
    );
  }
}
