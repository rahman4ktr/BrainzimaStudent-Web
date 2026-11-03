"use client";

import React, { useState, useEffect } from "react";
import { getYouTubeEmbedUrl, isDirectVideoUrl } from "@/lib/youtube";
import { AlertCircle } from "lucide-react";

interface LmsVideoPlayerProps {
  url?: string | null;
  fallbackContext?: string;
  title?: string;
  onProgress?: (watchedSeconds: number, percent: number) => void;
  className?: string;
}

export default function LmsVideoPlayer({
  url,
  fallbackContext,
  title,
  onProgress,
  className = "",
}: LmsVideoPlayerProps) {
  const [hasError, setHasError] = useState(false);

  // Check if link is direct video (.mp4, .webm)
  const isDirect = isDirectVideoUrl(url);

  // Resolve YouTube embed URL
  const embedUrl = !isDirect ? getYouTubeEmbedUrl(url, fallbackContext) : "";

  // Reset error on URL change
  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (hasError) {
    return (
      <div className={`relative w-full aspect-video bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white ${className}`}>
        <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
        <h4 className="text-sm font-bold">Video Player Notice</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Unable to load video stream directly. Please check your internet connection or reload the lesson.
        </p>
      </div>
    );
  }

  // 1. Direct MP4 / WebM video file
  if (isDirect && url) {
    return (
      <div className={`relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden ${className}`}>
        <video
          key={url}
          src={url}
          controls
          playsInline
          controlsList="nodownload"
          className="w-full h-full object-contain"
          onError={() => setHasError(true)}
          onTimeUpdate={(e) => {
            const vid = e.currentTarget;
            if (vid.duration && onProgress) {
              const pct = Math.min(100, Math.round((vid.currentTime / vid.duration) * 100));
              onProgress(Math.round(vid.currentTime), pct);
            }
          }}
        >
          Your browser does not support HTML5 video streaming.
        </video>
      </div>
    );
  }

  // 2. YouTube Embed Video (Ultra-reliable native player with clean embed flags)
  return (
    <div className={`relative w-full aspect-video bg-slate-950 flex items-center justify-center overflow-hidden ${className}`}>
      <iframe
        key={embedUrl}
        src={embedUrl}
        title={title || "Lesson Video"}
        className="w-full h-full border-0 aspect-video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onError={() => setHasError(true)}
      />
    </div>
  );
}
