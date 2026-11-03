import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get("file");

    if (!file) {
      return NextResponse.json(
        { success: false, message: "Missing file parameter" },
        { status: 400 }
      );
    }

    // Resolve URL
    let targetUrl = file;
    if (!file.startsWith("http://") && !file.startsWith("https://")) {
      const cleanPath = file.replace(/^\/+/, "");
      targetUrl = `https://api.brainzima.com/student/${cleanPath}`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "BrainzimaStudentPortal/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: `Failed to fetch remote PDF: ${response.statusText}` },
        { status: response.status }
      );
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error proxying PDF",
      },
      { status: 500 }
    );
  }
}

