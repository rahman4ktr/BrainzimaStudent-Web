import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = parseInt(resolvedParams.id, 10);

    const res = await fetch("https://api.brainzima.com/student/api/ebooks", {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: "Failed to connect to production database" },
        { status: 502 }
      );
    }

    const json = await res.json();
    const books = Array.isArray(json.data) ? json.data : [];
    const found = books.find((b: { ebook_id: number }) => b.ebook_id === id);

    if (!found) {
      return NextResponse.json(
        { success: false, message: `Ebook with id ${id} not found in database` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: found,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
