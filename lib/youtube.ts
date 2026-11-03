// lib/youtube.ts
// Robust YouTube URL parser & embed URL generator for LMS lesson player.
// Converts any standard, short, mobile, or embed YouTube URL into a valid,
// responsive, iframe-compatible embed URL with standard player controls.

/**
 * Fallback educational video IDs for common computer science / LMS topics
 * when URLs in the database are search queries (/results?search_query=...)
 * rather than direct video watch IDs.
 */
const TOPIC_FALLBACK_MAP: Record<string, string> = {
  computer: "kJnP2jS6-Cg",      // Computer Basics: Introduction to Computers
  fundamental: "fDykyg3mQO8",   // Computer Fundamentals
  operating: "pT5wFwQpL3o",     // Operating System Basics
  windows: "pT5wFwQpL3o",       // Windows OS Basics
  word: "S-nHYzK-BVg",          // Microsoft Word Tutorial for Beginners
  excel: "rwbho0CgEAE",         // Microsoft Excel Tutorial for Beginners
  powerpoint: "XF34-Vu7pqg",    // Microsoft PowerPoint Tutorial
  internet: "Dxcc6ycZ73M",      // What is the Internet? Basics for Beginners
  email: "0nQ67jSjKlo",         // How Email Works Tutorial
  typing: "1KBIJ1b40oA",        // Touch Typing Tutorial
  tally: "K9qK6r3oG8Q",         // Tally Prime Full Course Beginners
  programming: "zOjov-2OZ0E",   // Introduction to Programming
  python: "rfscVS0vtbw",        // Python for Beginners
  web: "UB1O30fR-EE",           // HTML & CSS Full Course
};

const DEFAULT_VIDEO_ID = "kJnP2jS6-Cg"; // Computer Basics: Introduction to Computers

/**
 * Detects if a URL is a direct playable video file (e.g. mp4, webm, mov).
 */
export function isDirectVideoUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".ogg") ||
    clean.endsWith(".mov") ||
    clean.includes(".mp4?") ||
    clean.includes(".webm?")
  );
}

/**
 * Extracts a YouTube 11-character video ID from a URL or text string.
 */
export function extractYouTubeVideoId(inputUrl?: string | null): string | null {
  if (!inputUrl || typeof inputUrl !== "string") return null;

  const trimmed = inputUrl.trim().replace(/^["']|["']$/g, "");

  // If already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 1. watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) return watchMatch[1];

  // 2. youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];

  // 3. youtube.com/embed/VIDEO_ID
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];

  // 4. youtube.com/shorts/VIDEO_ID
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];

  // 5. youtube.com/live/VIDEO_ID
  const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  if (liveMatch && liveMatch[1]) return liveMatch[1];

  // 6. youtube.com/v/VIDEO_ID
  const vMatch = trimmed.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch && vMatch[1]) return vMatch[1];

  // 7. General search for 11-char ID
  const generalMatch = trimmed.match(/(?:embed\/|v\/|vi\/|youtu\.be\/|\/v=|^v=|\/embed\/|\/shorts\/|\/live\/)([a-zA-Z0-9_-]{11})/);
  if (generalMatch && generalMatch[1]) return generalMatch[1];

  return null;
}

/**
 * Converts a stored syllabus_topic_url or lesson topic title into a valid YouTube embed URL.
 * Guaranteed to return an embeddable URL that will not be blocked by X-Frame-Options.
 *
 * @param url Stored syllabus_topic_url
 * @param fallbackContext Topic title or keywords for fallback resolution
 */
export function getYouTubeEmbedUrl(
  url?: string | null,
  fallbackContext?: string
): string {
  const params = "rel=0&modestbranding=1&enablejsapi=1&cc_load_policy=0&iv_load_policy=3&playsinline=1";

  // 1. Try to extract standard YouTube video ID
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?${params}`;
  }

  // 2. If URL is a search query or generic link, match keywords in URL or topic context
  const searchString = `${url || ""} ${fallbackContext || ""}`.toLowerCase();
  for (const [key, fallbackId] of Object.entries(TOPIC_FALLBACK_MAP)) {
    if (searchString.includes(key)) {
      return `https://www.youtube.com/embed/${fallbackId}?${params}`;
    }
  }

  // 3. Fallback to standard introductory computer lesson
  return `https://www.youtube.com/embed/${DEFAULT_VIDEO_ID}?${params}`;
}
