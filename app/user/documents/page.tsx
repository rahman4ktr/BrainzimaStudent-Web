"use client";

import React from "react";
import { FolderOpen, ShieldCheck, FileCheck2, User, CreditCard, GraduationCap, Lock, Upload, Eye } from "lucide-react";
import GetPremiumLockedView from "@/components/user/GetPremiumLockedView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const documentSlots = [
  {
    title: "Student Passport Photograph",
    desc: "Used for official Student ID Card and Certificate Generation",
    icon: User,
    status: "Requires Enrollment",
    required: true,
  },
  {
    title: "Aadhaar Card (Front Side)",
    desc: "Government identity verification with visible name and DOB",
    icon: CreditCard,
    status: "Requires Enrollment",
    required: true,
  },
  {
    title: "Aadhaar Card (Back Side)",
    desc: "Permanent address verification record",
    icon: CreditCard,
    status: "Requires Enrollment",
    required: true,
  },
  {
    title: "Highest Qualification Certificate",
    desc: "Degree certificate, diploma, or marksheet for academic records",
    icon: GraduationCap,
    status: "Requires Enrollment",
    required: false,
  },
];

export default function UserDocumentsPage() {
  return (
    <GetPremiumLockedView
      title="Student Documents"
      badge="Academic Verification"
      description="Upload and manage your official identity proofs, educational certificates, and biometric profile for verification."
      icon={FolderOpen}
      primaryCtaText="Enroll to Submit Documents"
      benefits={[
        {
          title: "Government KYC Verification",
          desc: "Compliant Aadhaar and identity verification adhering to state education department standards.",
          icon: ShieldCheck,
        },
        {
          title: "Official Academic Dossier",
          desc: "Secure cloud archiving of your graduation certificates, diplomas, and marksheets.",
          icon: FileCheck2,
        },
        {
          title: "Instant ID Card Approval",
          desc: "Submitting verified documents expedites physical badge creation and classroom pass.",
          icon: GraduationCap,
        },
        {
          title: "Encrypted & Confidential Storage",
          desc: "All submitted documents are encrypted with banking-grade security and accessible only to verification officers.",
          icon: Lock,
        },
      ]}
      previewContent={
        <div className="space-y-3">
          <div className="p-3 bg-purple-50/70 border border-purple-200/60 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-[#5B21F4]">
              Mandatory Student KYC Verification System
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Status: Pending Admission
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {documentSlots.map((doc, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-[#5B21F4] flex items-center justify-center">
                      <doc.icon className="w-4 h-4" />
                    </div>
                    {doc.required && (
                      <Badge className="bg-red-50 text-red-600 border-red-200 text-[9px] py-0">
                        Required
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#111827]">{doc.title}</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {doc.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs gap-1 border-slate-200 text-slate-400"
                    disabled
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
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
