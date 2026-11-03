import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Direct typo fix for studnets -> students
      {
        source: "/uploads/images/studnets/:path*",
        destination: "/uploads/images/students/:path*",
      },
      // Legacy /users/* rewrite to /uploads/images/users/*
      {
        source: "/users/:path*",
        destination: "/uploads/images/users/:path*",
      },
      // Legacy /students/* rewrite to /uploads/images/students/:path*
      {
        source: "/students/:path*",
        destination: "/uploads/images/students/:path*",
      },
      // Legacy /public/users/*
      {
        source: "/public/users/:path*",
        destination: "/uploads/images/users/:path*",
      },
      // Legacy /public/students/*
      {
        source: "/public/students/:path*",
        destination: "/uploads/images/students/:path*",
      },
      // Legacy paths stored in DB before migration
      {
        source: "/public/uploads/:path*",
        destination: "/uploads/:path*",
      },
      // Direct /auth/* public endpoints rewrite to Next.js API routes (/api/auth/*)
      {
        source: "/auth/:path*",
        destination: "/api/auth/:path*",
      },
      // Rewrite spelling variant /api/onlinecourses/:path* to /api/onlinecoures/:path*
      {
        source: "/api/onlinecourses/:path*",
        destination: "/api/onlinecoures/:path*",
      },
      // Proxy any /uploads/:path* not found in Next.js public/ to the PHP REST API backend
      {
        source: "/uploads/:path*",
        destination: "https://api.brainzima.com/student/uploads/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        // Vercel Blob public CDN
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      {
        // Production site (for absolute URLs stored in DB)
        protocol: "https",
        hostname: "student.brainzima.com",
        pathname: "/**",
      },
      {
        // Backend upload host
        protocol: "https",
        hostname: "api.brainzima.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "try.ajitdev.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
