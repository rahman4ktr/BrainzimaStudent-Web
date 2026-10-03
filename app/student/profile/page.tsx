"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  UserCircle2,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  Edit3,
  Camera,
  CheckCircle2,
  Save,
  ShieldCheck,
  Award,
  Building2,
  Loader2,
  Sparkles,
  Trash2,
  Clock,
  MapPin,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import { useStudent } from "@/hooks/useStudent";
import { getFileUrl, getInitials } from "@/lib/session";
import {
  getCurrentStudent,
  getCurrentUser,
  uploadUserImage,
  updateUserProfile,
  updateStudentProfile,
  saveStudentDocuments,
  StudentProfile,
  UserProfile,
} from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] as const },
});

export default function StudentProfilePage() {
  const { user_id, student_id, refreshStudent, isLoading: isStudentLoading } = useStudent();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Real API profile objects
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Editable Form State
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    parentMobile: "",
    dob: "",
    gender: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    qualification: "",
    centre: "",
  });

  const loadProfileData = useCallback(async () => {
    if (!user_id) return;
    setLoading(true);
    setError(null);

    try {
      const [stRes, uRes] = await Promise.allSettled([
        getCurrentStudent(user_id),
        getCurrentUser(user_id),
      ]);

      let stData: StudentProfile | null = null;
      let uData: UserProfile | null = null;

      if (stRes.status === "fulfilled" && stRes.value.success && stRes.value.data) {
        stData = stRes.value.data;
        setStudent(stData);
      }

      if (uRes.status === "fulfilled" && uRes.value.success && uRes.value.data) {
        uData = uRes.value.data;
        setUser(uData);
      }

      // Populate form strictly from real API response
      setForm({
        name: stData?.st_name || uData?.name || "",
        email: stData?.st_email || uData?.email || "",
        mobile: stData?.st_mobile || uData?.mobile || "",
        parentMobile: (stData as any)?.st_mobile_parent || "",
        dob: stData?.st_dob || "",
        gender: stData?.st_gender || "",
        address: stData?.st_address || "",
        city: stData?.st_city || "",
        state: stData?.st_state || "",
        pincode: stData?.st_pincode || "",
        qualification: stData?.st_qualification || "",
        centre: stData?.centre_name || (stData?.st_centre_id ? `Centre #${stData.st_centre_id}` : ""),
      });
    } catch {
      setError("Failed to fetch student profile from server.");
    } finally {
      setLoading(false);
    }
  }, [user_id]);

  useEffect(() => {
    if (!isStudentLoading && user_id) {
      loadProfileData();
    } else if (!isStudentLoading && !user_id) {
      setLoading(false);
    }
  }, [user_id, isStudentLoading, loadProfileData]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user_id) return;
    setSaving(true);

    try {
      // 1. Update user account basic info (name, mobile)
      await updateUserProfile(user_id, "student", {
        name: form.name.trim(),
        mobile: form.mobile.trim(),
      });

      // 2. Update student academic profile if student_id is available
      if (student_id) {
        await updateStudentProfile(user_id, student_id, {
          st_name: form.name.trim(),
          st_mobile: form.mobile.trim(),
          st_dob: form.dob.trim(),
          st_gender: form.gender.trim(),
          st_address: form.address.trim(),
          st_city: form.city.trim(),
          st_state: form.state.trim(),
          st_pincode: form.pincode.trim(),
          st_qualification: form.qualification.trim(),
          ...({ st_mobile_parent: form.parentMobile.trim() } as any),
        });
      }

      await refreshStudent();
      await loadProfileData();

      setEditing(false);
      toast({
        variant: "success",
        title: "Profile Saved",
        description: "Student profile records updated successfully.",
      });
    } catch {
      toast({
        variant: "error",
        title: "Save Failed",
        description: "Could not save profile changes to database.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user_id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "error",
        title: "Image Too Large",
        description: "Profile photo must be 5 MB or smaller.",
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const res = await uploadUserImage(file, user_id, user?.user_image, "student", true);
      if (res.success && (res.user_image || res.db_path || res.url)) {
        const storedPath = res.user_image || res.db_path || res.url || "";

        await updateUserProfile(user_id, "student", {
          user_image: storedPath,
        });

        if (student_id) {
          try {
            await saveStudentDocuments(user_id, student_id, {
              docs_st_image: storedPath,
            });
          } catch {
            /* ignore */
          }
        }

        await refreshStudent();
        await loadProfileData();

        toast({
          variant: "success",
          title: "Profile Photo Updated",
          description: "Student avatar updated successfully.",
        });
      } else {
        toast({
          variant: "error",
          title: "Upload Failed",
          description: res.message || "Failed to upload photo.",
        });
      }
    } catch {
      toast({
        variant: "error",
        title: "Upload Error",
        description: "Network error while uploading photo.",
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!user_id || !user?.user_image) return;
    setIsUploadingImage(true);
    try {
      await updateUserProfile(user_id, "student", {
        user_image: null,
      });
      await refreshStudent();
      await loadProfileData();
      toast({
        variant: "success",
        title: "Photo Removed",
        description: "Profile photo has been removed.",
      });
    } catch {
      toast({
        variant: "error",
        title: "Action Failed",
        description: "Could not remove profile photo.",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const avatarUrl = getFileUrl(user?.user_image || (student as any)?.user_image);
  const initials = getInitials(form.name || student?.st_name || user?.name);
  const registrationNo = student?.st_regno || user?.registration_number || (student_id ? `BISR${String(student_id).padStart(4, "0")}` : "—");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827]">
            Student Profile
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Academic credentials, student registration ID, and verified personal record
          </p>
        </div>

        
      </div>

      {/* ── Error Notice ── */}
      {!loading && error && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-red-800">{error}</p>
          <button
            onClick={loadProfileData}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry Loading Profile
          </button>
        </div>
      )}

      {/* ── Profile Header Card with Avatar ── */}
      <motion.div {...fadeUp(0.05)}>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
          <div
            className="h-28 relative"
            style={{
              background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
            }}
          >
            <div className="absolute -bottom-10 left-6">
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg overflow-hidden flex items-center justify-center text-white text-xl font-extrabold bg-[#5B21F4]"
                  style={{
                    background: "linear-gradient(135deg, #5B21F4, #2563EB)",
                  }}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={form.name || "Student"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  title="Upload student photo"
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#5B21F4] border-2 border-white flex items-center justify-center cursor-pointer hover:bg-[#4C1BD4] transition-colors shadow-sm"
                >
                  {isUploadingImage ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-white" />
                  )}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageFileChange}
                />
              </div>
            </div>
          </div>

          <div className="pt-12 pb-6 px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-[#111827]">
                    {form.name || "Enrolled Student"}
                  </h2>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#F1EEFF] text-[#5B21F4]">
                    {registrationNo}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Student ID #{student_id || "—"} · User Account #{user_id || "—"}
                </p>
              </div>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isUploadingImage}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer self-start"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Profile Information Grid ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-6 shadow-sm">
          <div className="border-b border-[#F1F5F9] pb-3 flex items-center justify-between">
            <h3 className="font-extrabold text-[#111827] text-sm flex items-center gap-2">
              <UserCircle2 className="w-4 h-4 text-[#5B21F4]" />
              Personal &amp; Contact Records
            </h3>
            <span className="text-xs text-[#64748B]">
              {editing ? "Editable Mode" : "Read-only View"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Student Full Name */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Full Name</label>
              <input
                type="text"
                value={form.name}
                disabled={!editing}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* Registration Number (Read-only) */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Registration Number</label>
              <input
                type="text"
                value={registrationNo}
                disabled
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#5B21F4] font-mono font-bold"
              />
            </div>

            {/* Email (Read-only account identifier) */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Email Address</label>
              <input
                type="email"
                value={form.email}
                disabled
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] font-semibold"
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Mobile Number</label>
              <input
                type="tel"
                value={form.mobile}
                disabled={!editing}
                onChange={(e) => handleChange("mobile", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* Parent Mobile */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Parent / Guardian Mobile</label>
              <input
                type="tel"
                value={form.parentMobile}
                disabled={!editing}
                onChange={(e) => handleChange("parentMobile", e.target.value)}
                placeholder="Not provided"
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* Date of Birth */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Date of Birth</label>
              <input
                type="text"
                value={form.dob}
                disabled={!editing}
                placeholder="YYYY-MM-DD"
                onChange={(e) => handleChange("dob", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Gender</label>
              <input
                type="text"
                value={form.gender}
                disabled={!editing}
                placeholder="Male / Female / Other"
                onChange={(e) => handleChange("gender", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* Qualification */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Qualification</label>
              <input
                type="text"
                value={form.qualification}
                disabled={!editing}
                placeholder="e.g. Higher Secondary, Graduate"
                onChange={(e) => handleChange("qualification", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* Study Centre */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Registered Study Centre</label>
              <input
                type="text"
                value={form.centre || "Brainzima Study Centre"}
                disabled
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] font-semibold"
              />
            </div>

            {/* City */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">City</label>
              <input
                type="text"
                value={form.city}
                disabled={!editing}
                placeholder="Not provided"
                onChange={(e) => handleChange("city", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* State */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">State</label>
              <input
                type="text"
                value={form.state}
                disabled={!editing}
                placeholder="Not provided"
                onChange={(e) => handleChange("state", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* Pincode */}
            <div>
              <label className="font-bold text-[#475569] mb-1.5 block">Pincode</label>
              <input
                type="text"
                value={form.pincode}
                disabled={!editing}
                placeholder="Not provided"
                onChange={(e) => handleChange("pincode", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="font-bold text-[#475569] mb-1.5 block">Residential Address</label>
              <textarea
                value={form.address}
                disabled={!editing}
                rows={2}
                placeholder="Complete street address"
                onChange={(e) => handleChange("address", e.target.value)}
                className="w-full p-3 rounded-xl border border-[#E2E8F0] bg-white text-[#111827] font-semibold disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#5B21F4]"
              />
            </div>
          </div>

          {editing && (
            <div className="flex justify-end pt-3 border-t border-[#F1F5F9]">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-[#08A66A] hover:bg-[#078957] text-white text-xs font-bold rounded-xl shadow-md shadow-[#08A66A]/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Profile Changes</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
