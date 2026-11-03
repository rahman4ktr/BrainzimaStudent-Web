"use client";

import React from "react";
import { FolderOpen, Download, FileCode, FileArchive, Layers, ExternalLink, Lock, Sparkles } from "lucide-react";
import GetPremiumLockedView from "@/components/user/GetPremiumLockedView";
import { Button } from "@/components/ui/button";

const sampleMaterials = [
  {
    title: "MERN Stack E-Commerce Monorepo Starter Boilerplate",
    tag: "Source Code",
    size: "18.4 MB",
    format: "ZIP Archive",
    downloads: 1420,
  },
  {
    title: "Generative AI Agent & RAG Vector Database Implementation",
    tag: "Project Kit",
    size: "24.2 MB",
    format: "ZIP Archive",
    downloads: 980,
  },
  {
    title: "Next.js Enterprise SaaS Dashboard with Authentication & Stripe",
    tag: "Template",
    size: "12.1 MB",
    format: "ZIP Archive",
    downloads: 2150,
  },
  {
    title: "Docker Compose & Production Kubernetes Helm Manifests",
    tag: "DevOps",
    size: "3.5 MB",
    format: "TAR Archive",
    downloads: 760,
  },
];

export default function UserMaterialsPage() {
  return (
    <GetPremiumLockedView
      title="Study Materials & Code"
      badge="Project Repositories"
      description="Download production-grade starter kits, project source code, lab exercises, and reference software packages."
      icon={FolderOpen}
      primaryCtaText="Enroll to Access Source Code"
      benefits={[
        {
          title: "Full Production Source Code",
          desc: "Complete repositories for all capstone projects, full-stack apps, and machine learning models.",
          icon: FileCode,
        },
        {
          title: "Boilerplates & Starter Kits",
          desc: "Skip initial boilerplate setup and dive straight into coding with pre-configured templates.",
          icon: FileArchive,
        },
        {
          title: "Lab Assignments & Solutions",
          desc: "Comprehensive problem sets with step-by-step benchmark solutions and unit tests.",
          icon: Layers,
        },
        {
          title: "Lifetime Cloud Access",
          desc: "Enjoy ongoing access to code updates, bug fixes, and library upgrades even after course completion.",
          icon: Sparkles,
        },
      ]}
      previewContent={
        <div className="space-y-3">
          <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700">
              18 Production Kits Available for Enrolled Students
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Category: All Repositories
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sampleMaterials.map((mat, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileArchive className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">
                      {mat.tag}
                    </span>
                    <p className="text-xs font-bold text-[#111827] mt-1 line-clamp-1">
                      {mat.title}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {mat.format} • {mat.size} • {mat.downloads} downloads
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Restricted Resource</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-400"
                    disabled
                  >
                    <Lock className="w-3 h-3" />
                    <span>Download</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}
