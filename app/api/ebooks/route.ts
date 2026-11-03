import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface EbookDbItem {
  ebook_id: number;
  ebook_pdf_link: string;
  ebook_title: string;
  ebook_description: string;
  ebook_author: string;
  ebook_edition: string;
  ebook_publication: string;
  created_at: string;
  updated_at: string;
  extra?: {
    isbn?: string;
    pages?: number;
    category?: string;
    language?: string;
    rating?: number;
    cover_image?: string;
    [key: string]: unknown;
  };
}

export interface EbookFormattedItem {
  ebook_id: number;
  ebook_title: string;
  ebook_subtitle: string;
  ebook_author: string;
  ebook_description: string;
  ebook_edition: string;
  ebook_publication: string;
  ebook_pdf_link: string;
  raw_pdf_url: string;
  category: string;
  publication_year: number;
  total_pages: number;
  is_free: boolean;
  extra: {
    category: string;
    pages: number;
    year: number;
    rating: number;
    isbn?: string;
    language?: string;
    cover_style: {
      theme: "yellow" | "cyan" | "python" | "aws" | "cyber" | "purple";
      icon_type: string;
    };
  };
  created_at: string;
  updated_at: string;
}

// Fetch REAL ebooks strictly from the user's production DB API
async function fetchRealDbEbooks(): Promise<EbookDbItem[]> {
  const PRODUCTION_API_URL = "https://api.brainzima.com/student/api/ebooks";

  try {
    const res = await fetch(PRODUCTION_API_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "BrainzimaStudentPortal/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Production API returned HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data;
    }
    return [];
  } catch (err) {
    console.error("Failed to fetch real ebooks from https://api.brainzima.com/student/api/ebooks:", err);
    return [];
  }
}

function assignTheme(category: string, title: string): {
  theme: "yellow" | "cyan" | "python" | "aws" | "cyber" | "purple";
  icon_type: string;
} {
  const text = `${category} ${title}`.toLowerCase();
  if (text.includes("python") || text.includes("data science")) {
    return { theme: "python", icon_type: "python" };
  }
  if (text.includes("javascript") || text.includes("js")) {
    return { theme: "yellow", icon_type: "javascript" };
  }
  if (text.includes("react") || text.includes("next") || text.includes("frontend")) {
    return { theme: "cyan", icon_type: "react" };
  }
  if (text.includes("cloud") || text.includes("aws")) {
    return { theme: "aws", icon_type: "aws" };
  }
  if (text.includes("security") || text.includes("cyber")) {
    return { theme: "cyber", icon_type: "cyber" };
  }
  return { theme: "purple", icon_type: "database" };
}

function formatRealEbook(item: EbookDbItem): EbookFormattedItem {
  const rawPdfUrl = item.ebook_pdf_link?.startsWith("http")
    ? item.ebook_pdf_link
    : `https://api.brainzima.com/student/${item.ebook_pdf_link?.replace(/^\/+/, "")}`;

  // Proxy URL ensures zero CORS or X-Frame-Options blocking
  const proxyPdfUrl = `/api/ebooks/proxy-pdf?file=${encodeURIComponent(item.ebook_pdf_link || "")}`;

  const category =
    item.extra?.category ||
    (item.ebook_title.toLowerCase().includes("data") ? "Data Science & AI" : "Programming");

  const year = item.created_at ? new Date(item.created_at).getFullYear() : 2024;
  const pages = item.extra?.pages || 100;
  const rating = Number(item.extra?.rating || 4.8);

  const coverStyle = assignTheme(category, item.ebook_title);

  return {
    ebook_id: item.ebook_id,
    ebook_title: item.ebook_title,
    ebook_subtitle: item.ebook_description?.slice(0, 75) + "..." || item.ebook_edition || "Complete Technical Guide",
    ebook_author: item.ebook_author || "Brainzima Academic Team",
    ebook_description: item.ebook_description || "Comprehensive academic guide and study reference.",
    ebook_edition: item.ebook_edition || "1st Edition",
    ebook_publication: item.ebook_publication || "Brainzima Tech Press",
    ebook_pdf_link: proxyPdfUrl,
    raw_pdf_url: rawPdfUrl,
    category,
    publication_year: year,
    total_pages: pages,
    is_free: true,
    extra: {
      category,
      pages,
      year,
      rating,
      isbn: item.extra?.isbn,
      language: item.extra?.language || "English",
      cover_style: coverStyle,
    },
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category");
    const searchParam = searchParams.get("search");
    const sortParam = searchParams.get("sort");

    // Strictly fetch real data from production DB API
    const realItems = await fetchRealDbEbooks();
    let formatted = realItems.map(formatRealEbook);

    // Apply category filter
    if (categoryParam && categoryParam !== "All") {
      const catLower = categoryParam.toLowerCase();
      formatted = formatted.filter((book) =>
        book.category.toLowerCase().includes(catLower)
      );
    }

    // Apply search filter
    if (searchParam && searchParam.trim()) {
      const q = searchParam.toLowerCase().trim();
      formatted = formatted.filter(
        (b) =>
          b.ebook_title.toLowerCase().includes(q) ||
          b.ebook_author.toLowerCase().includes(q) ||
          b.ebook_description.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q)
      );
    }

    // Apply sorting
    if (sortParam === "title") {
      formatted.sort((a, b) => a.ebook_title.localeCompare(b.ebook_title));
    } else if (sortParam === "pages") {
      formatted.sort((a, b) => b.total_pages - a.total_pages);
    } else {
      // Default: order by ID descending (newest first)
      formatted.sort((a, b) => b.ebook_id - a.ebook_id);
    }

    return NextResponse.json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to retrieve real ebooks",
        data: [],
      },
      { status: 500 }
    );
  }
}
