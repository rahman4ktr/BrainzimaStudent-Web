"use client";

import confetti from "canvas-confetti";

/**
 * Fires a festive celebration confetti animation when a coupon is successfully applied.
 */
export function fireCouponConfetti() {
  if (typeof window === "undefined") return;

  // Primary burst from center
  confetti({
    particleCount: 70,
    spread: 60,
    origin: { y: 0.62 },
    colors: ["#5B21F4", "#10B981", "#F59E0B", "#38BDF8", "#EC4899", "#8B5CF6"],
    ticks: 220,
    gravity: 1.1,
    scalar: 1.05,
    shapes: ["circle", "square"],
    disableForReducedMotion: true,
  });

  // Left & right celebratory side cannons with slight delays
  setTimeout(() => {
    confetti({
      particleCount: 45,
      angle: 60,
      spread: 50,
      origin: { x: 0.15, y: 0.68 },
      colors: ["#10B981", "#5B21F4", "#F59E0B", "#14B8A6"],
      ticks: 200,
      gravity: 1.1,
      scalar: 0.95,
      disableForReducedMotion: true,
    });
  }, 120);

  setTimeout(() => {
    confetti({
      particleCount: 45,
      angle: 120,
      spread: 50,
      origin: { x: 0.85, y: 0.68 },
      colors: ["#5B21F4", "#F59E0B", "#EC4899", "#10B981"],
      ticks: 200,
      gravity: 1.1,
      scalar: 0.95,
      disableForReducedMotion: true,
    });
  }, 220);
}
