"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  User,
  GraduationCap,
  MapPin,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
  Award,
  ChevronDown,
  Calendar,
  FileText,
  UploadCloud,
  Check,
  Banknote,
  Tag,
} from "lucide-react";
import {
  getCourses,
  getCourseById,
  getMyProfile,
  getFranchisees,
  createEnrollment,
  createRazorpayOrder,
  uploadStudentDocumentFile,
  saveStudentDocuments,
  updateUserProfile,
  getStudentEnrollments,
  type Course,
  type FranchiseeItem,
  type AdmissionFormData,
  type EnrollmentItem,
  validateOfflineCoupon,
  type CouponValidationData,
} from "@/lib/api";
import { CouponOfferCards } from "@/components/CouponOfferCards";
import { fireCouponConfetti } from "@/lib/confetti";
import {
  getSession,
  updateSession,
  saveSession,
  type BrainzimaSession,
  getFileUrl,
  getInitials,
} from "@/lib/session";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay: any;
  }
}

// 4 Steps for First-Time Student Enrollment
const STEPS_FIRST_TIME = [
  { id: 1, title: "Personal Details", shortTitle: "Personal" },
  { id: 2, title: "Study Centre", shortTitle: "Centre" },
  { id: 3, title: "Payment", shortTitle: "Payment" },
  { id: 4, title: "Confirmation", shortTitle: "Done" },
];

// 3 Steps for Subsequent Enrollment (Existing Student)
const STEPS_EXISTING_STUDENT = [
  { id: 1, title: "Course & Centre", shortTitle: "Course" },
  { id: 2, title: "Payment", shortTitle: "Payment" },
  { id: 3, title: "Confirmation", shortTitle: "Done" },
];

export interface CourseBatch {
  batch_id: number | string;
  batch_name: string;
  batch_mode?: string;
  batch_time?: string;
}

export interface CourseWithBatches extends Course {
  batches?: CourseBatch[];
}

export interface CourseEnrollmentViewProps {
  portalType: "user" | "student";
}

export function CourseEnrollmentView({ portalType }: CourseEnrollmentViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const queryCourseId = searchParams.get("course_id") || "";

  // ── Authentication & Student Status State ─────────────────────────────────
  const [currentUser, setCurrentUser] = useState<BrainzimaSession | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState<boolean>(true);
  const [isExistingStudent, setIsExistingStudent] = useState<boolean>(false);
  const [existingStudentId, setExistingStudentId] = useState<number | null>(null);
  const [existingRegNo, setExistingRegNo] = useState<string>("");
  const [userEnrollments, setUserEnrollments] = useState<EnrollmentItem[]>([]);

  // ── Step Navigation State ─────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState<number>(1);

  // ── Course & Centre Data ──────────────────────────────────────────────────
  const [coursesList, setCoursesList] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(queryCourseId);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithBatches | null>(null);
  const [isLoadingCourse, setIsLoadingCourse] = useState<boolean>(false);

  const [centresList, setCentresList] = useState<FranchiseeItem[]>([]);
  const [selectedCentreId, setSelectedCentreId] = useState<number>(1);
  const [isLoadingCentres, setIsLoadingCentres] = useState<boolean>(true);

  // ── First-Time Student Admission Form Fields (bi_student) ─────────────────
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [mobile, setMobile] = useState<string>("");
  const [userImage, setUserImage] = useState<string | null>(null);

  const [fname, setFname] = useState<string>(""); // Father's Name
  const [mname, setMname] = useState<string>(""); // Mother's Name
  const [dob, setDob] = useState<string>(""); // YYYY-MM-DD
  const [gender, setGender] = useState<string>("Male");
  const [parentMobile, setParentMobile] = useState<string>("");
  const [aadhaar, setAadhaar] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [state, setState] = useState<string>("Bihar");
  const [city, setCity] = useState<string>("");
  const [pincode, setPincode] = useState<string>("");
  const [qualification, setQualification] = useState<string>("Graduation");
  const [referredBy, setReferredBy] = useState<string>("Online Website");

  // Document Selection & Deferred Upload (First enrollment only)
  const [selectedDocFiles, setSelectedDocFiles] = useState<{
    profile: File | null;
    aadhaar_front: File | null;
    aadhaar_back: File | null;
    qualification: File | null;
  }>({
    profile: null,
    aadhaar_front: null,
    aadhaar_back: null,
    qualification: null,
  });
  const [previewProfileUrl, setPreviewProfileUrl] = useState<string | null>(null);
  const [docFileNames, setDocFileNames] = useState<{
    profile?: string;
    aadhaar_front?: string;
    aadhaar_back?: string;
    qualification?: string;
  }>({});
  const [docUploadErrors, setDocUploadErrors] = useState<
    { label: string; error: string }[]
  >([]);
  const [docUploadSuccessList, setDocUploadSuccessList] = useState<string[]>([]);

  // ── Course-Specific Data (Selected for any enrollment) ─────────────────────
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "center">("online");
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState<number>(5000);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // ── Online Coupon State ────────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState<string>("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<(CouponValidationData & { course_id?: number }) | null>(null);
  const validatingCourseIdRef = React.useRef<number | null>(null);

  // ── Final Success Details ─────────────────────────────────────────────────
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<any | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);

  // Sync queryCourseId if searchParams change
  useEffect(() => {
    if (queryCourseId) {
      setSelectedCourseId(queryCourseId);
    }
  }, [queryCourseId]);

  // ── 1. Load User Session and Detect Existing Student Status ───────────────
  useEffect(() => {
    let active = true;

    async function loadAuth() {
      setIsLoadingUser(true);
      const session = getSession();

      if (!session || !session.user_id) {
        toast({
          variant: "error",
          title: "Session Required",
          description: "Please log in to proceed with course enrollment.",
        });
        const redirectParam = portalType === "user"
          ? `/user/courses/enroll${queryCourseId ? `?course_id=${queryCourseId}` : ""}`
          : `/student/courses/enroll${queryCourseId ? `?course_id=${queryCourseId}` : ""}`;
        router.push(`/?redirect=${encodeURIComponent(redirectParam)}`);
        return;
      }

      if (active) {
        setCurrentUser(session);
        setName(session.name || "");
        setEmail(session.email || "");
        setMobile(session.mobile || "");
        setUserImage(session.user_image || null);
      }

      // Check if user is already a student by session
      let isStudent = Boolean(
        session.is_student === true &&
        session.student_id &&
        Number(session.student_id) > 0
      );
      let stId = session.student_id ? Number(session.student_id) : null;
      let regNo = session.registration_number || "";

      // Fetch fresh profile & existing enrollments in parallel to guard against stale session
      try {
        const [profileRes, enrollmentsRes] = await Promise.allSettled([
          getMyProfile(session.user_id, session.role === "student" ? "student" : "user"),
          getStudentEnrollments(session.user_id, stId || undefined, session.role === "student" ? "student" : "user"),
        ]);

        if (active && profileRes.status === "fulfilled" && profileRes.value.success && profileRes.value.data) {
          const u = profileRes.value.data;
          setName(u.name || session.name || "");
          setEmail(u.email || session.email || "");
          setMobile(u.mobile || session.mobile || "");
          if (u.user_image) {
            setUserImage(u.user_image);
            updateSession({ user_image: u.user_image });
          }
          if (u.student_id && Number(u.student_id) > 0) {
            isStudent = true;
            stId = Number(u.student_id);
            if ((u as any).registration_number) regNo = String((u as any).registration_number);
          } else if (u.is_student) {
            isStudent = true;
          }
        }

        if (active && enrollmentsRes.status === "fulfilled" && enrollmentsRes.value.success && enrollmentsRes.value.data) {
          let list: EnrollmentItem[] = [];
          if (Array.isArray(enrollmentsRes.value.data)) {
            list = enrollmentsRes.value.data;
          } else if ("enrollments" in enrollmentsRes.value.data && Array.isArray((enrollmentsRes.value.data as any).enrollments)) {
            list = (enrollmentsRes.value.data as any).enrollments;
          }
          setUserEnrollments(list);

          if (list.length > 0) {
            isStudent = true;
            if (!stId) {
              const firstStId = list[0].student_id || (list[0] as any).stc_st_id || (list[0] as any).st_id;
              if (firstStId) stId = Number(firstStId);
            }
            if (!regNo && list[0].registration_number) {
              regNo = list[0].registration_number;
            }
          }
        }
      } catch (err) {
        console.warn("[Enrollment] User profile & enrollment sync notice:", err);
      } finally {
        if (active) {
          setIsExistingStudent(isStudent);
          setExistingStudentId(stId);
          setExistingRegNo(regNo || (stId ? `BISR${String(stId).padStart(4, "0")}` : ""));

          // If backend revealed user is a student but frontend session was incomplete, sync session
          if (isStudent && stId && (!session.is_student || !session.student_id)) {
            updateSession({
              role: "student",
              is_student: true,
              student_id: stId,
              registration_number: regNo || (stId ? `BISR${String(stId).padStart(4, "0")}` : undefined),
            });
          }

          // ── CROSS-ROUTE GUARD ─────────────────────────────────────────────
          // Protects against wrong portal entry:
          // 1. Existing student visited /user/courses/enroll -> Redirect to /student/courses/enroll
          // 2. First-time user visited /student/courses/enroll -> Redirect to /user/courses/enroll
          const targetParam = queryCourseId ? `?course_id=${queryCourseId}` : "";
          if (portalType === "user" && isStudent && stId) {
            router.replace(`/student/courses/enroll${targetParam}`);
            return;
          }
          if (portalType === "student" && (!isStudent || !stId)) {
            router.replace(`/user/courses/enroll${targetParam}`);
            return;
          }

          setIsLoadingUser(false);
        }
      }
    }

    loadAuth();
    return () => {
      active = false;
    };
  }, [router, toast, queryCourseId, portalType]);

  // ── 2. Load Courses & Franchisee Study Centres ─────────────────────────────
  useEffect(() => {
    let active = true;

    // Load Course Catalog
    getCourses()
      .then((res) => {
        if (active && res.success && Array.isArray(res.data)) {
          setCoursesList(res.data);
          if (!selectedCourseId && res.data.length > 0) {
            setSelectedCourseId(String(res.data[0].course_id));
          }
        }
      })
      .catch((err) => console.error("[Enrollment] Error loading courses:", err));

    // Load Study Centres (Franchisees)
    setIsLoadingCentres(true);
    getFranchisees()
      .then((res) => {
        if (active && res.success && res.data && Array.isArray(res.data)) {
          setCentresList(res.data);
          if (res.data.length > 0) {
            setSelectedCentreId(res.data[0].franchisee_id);
          }
        }
      })
      .catch((err) => console.error("[Enrollment] Error loading centres:", err))
      .finally(() => {
        if (active) setIsLoadingCentres(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCourseId]);

  // ── 3. Fetch Selected Course Details ───────────────────────────────────────
  useEffect(() => {
    if (!selectedCourseId) return;

    let active = true;
    setIsLoadingCourse(true);

    getCourseById(Number(selectedCourseId))
      .then((res) => {
        if (active && res.success && res.data) {
          const courseData = res.data as CourseWithBatches;
          setSelectedCourse(courseData);
          if (courseData.batches && courseData.batches.length > 0) {
            setSelectedBatchId(String(courseData.batches[0].batch_id));
          } else {
            setSelectedBatchId("");
          }
        }
      })
      .catch((err) => {
        console.error("[Enrollment] Error loading course details:", err);
      })
      .finally(() => {
        if (active) setIsLoadingCourse(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCourseId]);

  // ── Steps Definition based on User Status ──────────────────────────────────
  const steps = useMemo(() => {
    return isExistingStudent ? STEPS_EXISTING_STUDENT : STEPS_FIRST_TIME;
  }, [isExistingStudent]);

  const maxStep = steps.length;

  // Selected study centre object
  const selectedCentre = useMemo(() => {
    return (
      centresList.find((c) => c.franchisee_id === Number(selectedCentreId)) ||
      null
    );
  }, [centresList, selectedCentreId]);

  // Selected batch object
  const selectedBatch = useMemo(() => {
    if (!selectedCourse?.batches) return null;
    return (
      selectedCourse.batches.find(
        (b: CourseBatch) => String(b.batch_id) === String(selectedBatchId)
      ) || null
    );
  }, [selectedCourse, selectedBatchId]);

  // ── Financial Computations ────────────────────────────────────────────────
  const courseFee = Number(selectedCourse?.course_fee || 0);
  const cleanDiscount = Math.max(0, Math.min(courseFee, Number(discount) || 0));
  const finalFee = Math.max(0, courseFee - cleanDiscount);

  // Partial or full payment computation
  const amountToPay = useMemo(() => {
    if (paymentMethod === "center") {
      return 0;
    }
    if (paymentType === "full") {
      return finalFee;
    }
    const cleanPartial = Math.max(1000, Number(partialAmount) || 1000);
    return Math.min(cleanPartial, finalFee);
  }, [paymentMethod, paymentType, finalFee, partialAmount]);

  const balanceDue = Math.max(0, finalFee - amountToPay);

  // Center Payment deposit amount computation
  const centerAmountToPay = finalFee;
  const centerBalanceDue = 0;

  // ── Revalidate or clear coupon when selected course changes ────────────────
  useEffect(() => {
    if (appliedCoupon && appliedCoupon.course_id !== Number(selectedCourseId)) {
      setAppliedCoupon(null);
      setDiscount(0);
      setCouponSuccess(null);
      setCouponError("Selected course changed. Previously applied coupon was removed.");
    }
  }, [selectedCourseId, appliedCoupon]);

  // ── Coupon Validation & Apply Handlers ─────────────────────────────────────
  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCouponError(null);
    setCouponSuccess(null);

    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Please enter a coupon code.");
      return;
    }

    if (!selectedCourse?.course_id) {
      setCouponError("Please select a course first.");
      return;
    }

    const targetCourseId = Number(selectedCourse.course_id);
    validatingCourseIdRef.current = targetCourseId;
    setIsValidatingCoupon(true);

    try {
      const res = await validateOfflineCoupon(
        {
          coupon_code: code,
          course_id: targetCourseId,
          user_id: currentUser?.user_id,
          email: email || currentUser?.email || undefined,
          mobile: mobile || currentUser?.mobile || undefined,
        },
        currentUser?.user_id,
        currentUser?.role === "student" ? "student" : "user"
      );

      // Prevent race conditions: check if course changed while request was in-flight
      if (validatingCourseIdRef.current !== Number(selectedCourse?.course_id)) {
        return;
      }

      if (!res.success || !res.data || !res.data.is_valid) {
        setAppliedCoupon(null);
        setDiscount(0);
        const errMsg =
          res.message ||
          (res.errors && Object.values(res.errors)[0]) ||
          "Invalid or inapplicable coupon code.";
        setCouponError(errMsg);
        return;
      }

      const validatedData = res.data;
      const verifiedDiscount = Number(validatedData.discount_amount) || 0;

      if (verifiedDiscount <= 0) {
        setAppliedCoupon(null);
        setDiscount(0);
        setCouponError("This coupon does not provide any discount for this course.");
        return;
      }

      setAppliedCoupon({
        ...validatedData,
        course_id: targetCourseId,
      });
      setDiscount(verifiedDiscount);
      setCouponSuccess(
        `Coupon "${validatedData.coupon_code}" applied! You saved ₹${verifiedDiscount.toLocaleString("en-IN")}.`
      );
      fireCouponConfetti();
    } catch (err: any) {
      setAppliedCoupon(null);
      setDiscount(0);
      setCouponError(err?.message || "Failed to validate coupon code.");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponInput("");
    setCouponError(null);
    setCouponSuccess(null);
  };

  // ── File Selection Handlers for Documents ─────────────────────────────────
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: "profile" | "aadhaar_front" | "aadhaar_back" | "qualification"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "error",
        title: "File Too Large",
        description: `${file.name} is larger than 5MB. Please choose a smaller file.`,
      });
      return;
    }

    setSelectedDocFiles((prev) => ({ ...prev, [key]: file }));
    setDocFileNames((prev) => ({ ...prev, [key]: file.name }));

    if (key === "profile") {
      const previewUrl = URL.createObjectURL(file);
      setPreviewProfileUrl(previewUrl);
    }
  };

  // ── Validation Helpers for Steps ──────────────────────────────────────────
  const validateStep1 = (): boolean => {
    if (isExistingStudent) {
      // Step 1 for existing student is Course & Centre
      if (!selectedCourseId) {
        toast({
          variant: "error",
          title: "Select Course",
          description: "Please choose a course to continue.",
        });
        return false;
      }
      if (!selectedCentreId) {
        toast({
          variant: "error",
          title: "Select Study Centre",
          description: "Please select an authorized study centre.",
        });
        return false;
      }
      return true;
    }

    // First time student: Validate personal details
    if (!name.trim()) {
      toast({
        variant: "error",
        title: "Name Required",
        description: "Please enter your full legal name.",
      });
      return false;
    }
    if (!fname.trim()) {
      toast({
        variant: "error",
        title: "Father's Name Required",
        description: "Please provide your father's name for university records.",
      });
      return false;
    }
    if (!mname.trim()) {
      toast({
        variant: "error",
        title: "Mother's Name Required",
        description: "Please provide your mother's name.",
      });
      return false;
    }
    if (!dob) {
      toast({
        variant: "error",
        title: "Date of Birth Required",
        description: "Please enter your date of birth.",
      });
      return false;
    }
    if (!mobile.trim() || mobile.trim().length < 10) {
      toast({
        variant: "error",
        title: "Valid Mobile Required",
        description: "Please provide a valid 10-digit mobile number.",
      });
      return false;
    }
    if (!email.trim() || !email.includes("@")) {
      toast({
        variant: "error",
        title: "Valid Email Required",
        description: "Please enter a valid email address.",
      });
      return false;
    }
    if (!address.trim()) {
      toast({
        variant: "error",
        title: "Address Required",
        description: "Please provide your complete residential address.",
      });
      return false;
    }
    if (!city.trim()) {
      toast({
        variant: "error",
        title: "City Required",
        description: "Please provide your city.",
      });
      return false;
    }
    if (!pincode.trim() || pincode.trim().length < 6) {
      toast({
        variant: "error",
        title: "Valid Pincode Required",
        description: "Please enter a valid 6-digit postal code.",
      });
      return false;
    }

    return true;
  };

  const validateStep2 = (): boolean => {
    if (isExistingStudent) {
      // Existing student only has 3 steps, so step 2 is Payment
      return true;
    }

    // Step 2 for first-time: Study Centre & Course Selection
    if (!selectedCourseId) {
      toast({
        variant: "error",
        title: "Select Course",
        description: "Please select a course to enroll.",
      });
      return false;
    }
    if (!selectedCentreId) {
      toast({
        variant: "error",
        title: "Select Study Centre",
        description: "Please select an authorized study centre.",
      });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 2) {
      if (!validateStep2()) return;
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (currentStep === 3 && !isExistingStudent) {
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ── Razorpay Script Loader ─────────────────────────────────────────────────
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // ── Handle Payment & Admission Submission ──────────────────────────────────
  const handleInitiatePayment = async () => {
    if (!selectedCourse) {
      toast({
        variant: "error",
        title: "Course Missing",
        description: "Please select a valid course first.",
      });
      return;
    }

    if (amountToPay <= 0) {
      toast({
        variant: "error",
        title: "Invalid Amount",
        description: "Payable amount must be greater than zero.",
      });
      return;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        throw new Error(
          "Could not load Razorpay payment gateway. Please check your internet connection."
        );
      }

      // Create Razorpay Order on Backend
      const orderRes = await createRazorpayOrder(
        currentUser!.user_id,
        Number(selectedCourse.course_id),
        amountToPay,
        cleanDiscount
      );

      if (!orderRes.success || !orderRes.data) {
        throw new Error(
          orderRes.message || "Failed to generate payment order. Please try again."
        );
      }

      const orderData = orderRes.data;

      // Launch Razorpay Checkout Modal
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Brainzima Institute of Science & Technology",
        description: `${isExistingStudent ? "New Course" : "Admission & Course"}: ${selectedCourse.course_name}`,
        image: "https://student.brainzima.com/public/uploads/logo/brainzima-logo.png",
        order_id: orderData.order_id,
        prefill: {
          name: name || currentUser?.name || "",
          email: email || currentUser?.email || "",
          contact: mobile || currentUser?.mobile || "",
        },
        theme: {
          color: "#5B21F4",
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          await finalizeEnrollmentOnBackend(response);
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setIsProcessingPayment(false);
        const errMsg =
          resp.error?.description ||
          resp.error?.reason ||
          "Payment was not completed. Please try again.";
        setPaymentError(errMsg);
        toast({
          variant: "error",
          title: "Payment Failed",
          description: errMsg,
        });
      });

      rzp.open();
    } catch (err: any) {
      console.error("[Razorpay Initiate Error]:", err);
      setIsProcessingPayment(false);
      setPaymentError(err.message || "Failed to start payment gateway.");
      toast({
        variant: "error",
        title: "Payment Initialization Error",
        description: err.message || "Could not reach Razorpay.",
      });
    }
  };

  // ── Finalize Enrollment on Backend ────────────────────────────────────────
  const finalizeEnrollmentOnBackend = async (rzpResponse: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setIsProcessingPayment(true);
    setPaymentError(null);

    // Build admission details payload only for FIRST enrollment
    const cleanReferredBy = (referredBy || "Online Website").trim();
    const admissionPayload: AdmissionFormData = isExistingStudent
      ? {}
      : {
          st_fname: fname.trim(),
          st_mname: mname.trim(),
          st_dob: dob,
          st_gender: gender,
          st_mobile_parent: parentMobile.trim(),
          st_aadhaar: aadhaar.trim(),
          st_address: address.trim(),
          st_state: state.trim(),
          st_city: city.trim(),
          st_pincode: pincode.trim(),
          st_qualification: qualification.trim(),
          st_referredby: cleanReferredBy,
          referred_by: cleanReferredBy,
          referredby: cleanReferredBy,
        };

    try {
      // 1. Submit verified enrollment to POST /api/enrollment
      const res = await createEnrollment(
        currentUser!.user_id,
        {
          course_id: Number(selectedCourse!.course_id),
          centre_id: Number(selectedCentreId),
          batch_id: selectedBatchId ? Number(selectedBatchId) : null,
          discount: cleanDiscount,
          coupon_code: appliedCoupon?.coupon_code,
          payment_method: "razorpay",
          payment_mode: "online",
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_order_id: rzpResponse.razorpay_order_id,
          razorpay_signature: rzpResponse.razorpay_signature,
          student_id: isExistingStudent ? existingStudentId : undefined,
          admission: admissionPayload,
          name: name.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          st_referredby: cleanReferredBy,
          referred_by: cleanReferredBy,
          referredby: cleanReferredBy,
        },
        isExistingStudent ? "student" : "user"
      );

      if (!res.success || !res.data) {
        if (
          res.message?.toLowerCase().includes("already enrolled") ||
          res.errors?.enrollment?.toLowerCase().includes("already enrolled")
        ) {
          toast({
            variant: "info",
            title: "Already Enrolled",
            description: "You are already enrolled in this course. Redirecting to your courses...",
          });
          setTimeout(() => router.push("/student/courses"), 1500);
          return;
        }

        throw new Error(
          res.message || "Payment verification failed. Please contact support."
        );
      }

      const enrolledData = res.data;
      const returnedStudentId = Number(enrolledData.student_id || existingStudentId);
      const returnedRegNo = String(enrolledData.registration_number || existingRegNo);

      // 2. Upload Selected Documents ONLY on First-Time Enrollment
      const uploadSuccesses: string[] = [];
      const uploadFailures: { label: string; error: string }[] = [];

      if (!isExistingStudent) {
        const docUploadConfigs: {
          key: "profile" | "aadhaar_front" | "aadhaar_back" | "qualification";
          docType: "docs_st_image" | "docs_st_aadhaar_front" | "docs_st_aadhaar_back" | "docs_st_qualification";
          label: string;
        }[] = [
          { key: "profile", docType: "docs_st_image", label: "Student Photo" },
          { key: "aadhaar_front", docType: "docs_st_aadhaar_front", label: "Aadhaar (Front)" },
          { key: "aadhaar_back", docType: "docs_st_aadhaar_back", label: "Aadhaar (Back)" },
          { key: "qualification", docType: "docs_st_qualification", label: "Qualification Proof" },
        ];

        const uploadedDocPaths: {
          docs_st_image?: string;
          docs_st_aadhaar_front?: string;
          docs_st_aadhaar_back?: string;
          docs_st_qualification?: string;
        } = {};

        for (const config of docUploadConfigs) {
          const fileToUpload = selectedDocFiles[config.key];
          if (!fileToUpload) continue;

          try {
            const uploadRes = await uploadStudentDocumentFile(
              fileToUpload,
              config.docType,
              returnedStudentId,
              returnedRegNo,
              currentUser!.user_id
            );

            const returnedPath = uploadRes.path || uploadRes.db_path;
            if (uploadRes.success && returnedPath) {
              uploadedDocPaths[config.docType] = returnedPath;
              uploadSuccesses.push(config.label);
            } else {
              uploadFailures.push({
                label: config.label,
                error: uploadRes.message || "Document upload failed.",
              });
            }
          } catch (uploadErr: any) {
            uploadFailures.push({
              label: config.label,
              error: uploadErr?.message || "Document upload network failure.",
            });
          }
        }

        if (Object.keys(uploadedDocPaths).length > 0) {
          try {
            await saveStudentDocuments(
              currentUser!.user_id,
              returnedStudentId,
              uploadedDocPaths
            );
          } catch (saveErr) {
            console.warn("[Enrollment] Notice saving student document paths:", saveErr);
          }
        }

        let finalUserImage = userImage;
        if (uploadedDocPaths.docs_st_image) {
          finalUserImage = uploadedDocPaths.docs_st_image;
          try {
            await updateUserProfile(currentUser!.user_id, "student", {
              user_image: finalUserImage,
            });
          } catch (syncErr) {
            console.warn("[Enrollment] Notice syncing user_image on profile:", syncErr);
          }
        }

        // Update session for NEW student
        updateSession({
          role: "student",
          is_student: true,
          student_id: returnedStudentId,
          registration_number: returnedRegNo,
          centre_id: selectedCentreId,
          user_image: finalUserImage,
        });
      } else {
        // Subsequent Enrollment: DO NOT overwrite student_id or registration_number!
        updateSession({
          centre_id: selectedCentreId,
        });
      }

      setEnrollmentSuccess({
        ...enrolledData,
        course_name: selectedCourse!.course_name,
        course_code: selectedCourse!.course_code,
        franchisee_name: selectedCentre?.franchisee_name || "Brainzima Study Centre",
        franchisee_adrs: selectedCentre?.franchisee_adrs || "India",
        amount_paid: enrolledData.amount_paid || amountToPay,
        payment_mode: "online",
        payment_reference: rzpResponse.razorpay_payment_id,
        registration_number: returnedRegNo,
        student_id: returnedStudentId,
      });

      setDocUploadSuccessList(uploadSuccesses);
      setDocUploadErrors(uploadFailures);

      // Advance to Confirmation Step
      setCurrentStep(maxStep);

      toast({
        variant: "success",
        title: isExistingStudent ? "New Course Enrolled! 🎉" : "Admission & Enrollment Confirmed! 🎉",
        description: enrolledData.email_sent && enrolledData.email_recipient
          ? `Payment successful. Your payment confirmation has been sent to ${enrolledData.email_recipient}.`
          : enrolledData.email_sent === false
          ? `Enrolled in ${selectedCourse?.course_name}. Payment successful. We could not send the confirmation email right now.`
          : `Enrolled in ${selectedCourse?.course_name}. Reg No: ${returnedRegNo}`,
        duration: 6000,
      });
    } catch (err: any) {
      console.error("[Enrollment Finalization Error]:", err);
      setPaymentError(
        err.message || "Payment verification failed. Please contact support."
      );
      toast({
        variant: "error",
        title: "Enrollment Failed",
        description: err.message || "Could not complete admission.",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ── Handle Center Payment Enrollment (No Razorpay / Pay at Desk) ───────────
  const handleCenterPaymentEnrollment = async () => {
    setIsProcessingPayment(true);
    setPaymentError(null);

    const cleanReferredBy = (referredBy || "Online Website").trim();
    const admissionPayload: AdmissionFormData = isExistingStudent
      ? {}
      : {
          st_fname: fname.trim(),
          st_mname: mname.trim(),
          st_dob: dob,
          st_gender: gender,
          st_mobile_parent: parentMobile.trim(),
          st_aadhaar: aadhaar.trim(),
          st_address: address.trim(),
          st_state: state.trim(),
          st_city: city.trim(),
          st_pincode: pincode.trim(),
          st_qualification: qualification.trim(),
          st_referredby: cleanReferredBy,
          referred_by: cleanReferredBy,
          referredby: cleanReferredBy,
        };

    try {
      const res = await createEnrollment(
        currentUser!.user_id,
        {
          course_id: Number(selectedCourse!.course_id),
          centre_id: Number(selectedCentreId),
          batch_id: selectedBatchId ? Number(selectedBatchId) : null,
          discount: cleanDiscount,
          coupon_code: appliedCoupon?.coupon_code,
          payment_method: "center",
          payment_mode: "center",
          center_deposit_amount: centerAmountToPay,
          student_id: isExistingStudent ? existingStudentId : undefined,
          admission: admissionPayload,
          name: name.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          st_referredby: cleanReferredBy,
          referred_by: cleanReferredBy,
          referredby: cleanReferredBy,
        },
        isExistingStudent ? "student" : "user"
      );

      if (!res.success || !res.data) {
        if (
          res.message?.toLowerCase().includes("already enrolled") ||
          res.errors?.enrollment?.toLowerCase().includes("already enrolled")
        ) {
          toast({
            variant: "info",
            title: "Already Enrolled",
            description: "You are already enrolled in this course. Redirecting to your courses...",
          });
          setTimeout(() => router.push("/student/courses"), 1500);
          return;
        }

        throw new Error(
          res.message || "Failed to register center admission. Please contact support."
        );
      }

      const enrolledData = res.data;
      const returnedStudentId = Number(enrolledData.student_id || existingStudentId);
      // For center payment, registration number is NOT assigned yet (null)
      const returnedRegNo = enrolledData.registration_number || null;

      // Upload Selected Documents ONLY on First-Time Enrollment
      const uploadSuccesses: string[] = [];
      const uploadFailures: { label: string; error: string }[] = [];

      if (!isExistingStudent) {
        const docUploadConfigs: {
          key: "profile" | "aadhaar_front" | "aadhaar_back" | "qualification";
          docType: "docs_st_image" | "docs_st_aadhaar_front" | "docs_st_aadhaar_back" | "docs_st_qualification";
          label: string;
        }[] = [
          { key: "profile", docType: "docs_st_image", label: "Student Photo" },
          { key: "aadhaar_front", docType: "docs_st_aadhaar_front", label: "Aadhaar (Front)" },
          { key: "aadhaar_back", docType: "docs_st_aadhaar_back", label: "Aadhaar (Back)" },
          { key: "qualification", docType: "docs_st_qualification", label: "Qualification Proof" },
        ];

        const uploadedDocPaths: {
          docs_st_image?: string;
          docs_st_aadhaar_front?: string;
          docs_st_aadhaar_back?: string;
          docs_st_qualification?: string;
        } = {};

        for (const config of docUploadConfigs) {
          const fileToUpload = selectedDocFiles[config.key];
          if (!fileToUpload) continue;

          try {
            const uploadRes = await uploadStudentDocumentFile(
              fileToUpload,
              config.docType,
              returnedStudentId,
              returnedRegNo || "",
              currentUser!.user_id
            );

            const returnedPath = uploadRes.path || uploadRes.db_path;
            if (uploadRes.success && returnedPath) {
              uploadedDocPaths[config.docType] = returnedPath;
              uploadSuccesses.push(config.label);
            } else {
              uploadFailures.push({
                label: config.label,
                error: uploadRes.message || "Document upload failed.",
              });
            }
          } catch (uploadErr: any) {
            uploadFailures.push({
              label: config.label,
              error: uploadErr?.message || "Document upload network failure.",
            });
          }
        }

        if (Object.keys(uploadedDocPaths).length > 0) {
          try {
            await saveStudentDocuments(
              currentUser!.user_id,
              returnedStudentId,
              uploadedDocPaths
            );
          } catch (saveErr) {
            console.warn("[Enrollment] Notice saving student document paths:", saveErr);
          }
        }

        let finalUserImage = userImage;
        if (uploadedDocPaths.docs_st_image) {
          finalUserImage = uploadedDocPaths.docs_st_image;
          try {
            await updateUserProfile(currentUser!.user_id, "student", {
              user_image: finalUserImage,
            });
          } catch (syncErr) {
            console.warn("[Enrollment] Notice syncing user_image on profile:", syncErr);
          }
        }

        // Update session for NEW student - registration_number remains null!
        updateSession({
          role: "student",
          is_student: true,
          student_id: returnedStudentId,
          registration_number: returnedRegNo,
          centre_id: selectedCentreId,
          user_image: finalUserImage,
        });
      } else {
        updateSession({
          centre_id: selectedCentreId,
        });
      }

      setEnrollmentSuccess({
        ...enrolledData,
        course_name: selectedCourse!.course_name,
        course_code: selectedCourse!.course_code,
        franchisee_name: selectedCentre?.franchisee_name || "Brainzima Study Centre",
        franchisee_adrs: selectedCentre?.franchisee_adrs || "India",
        amount_paid: 0,
        center_deposit_amount: centerAmountToPay,
        center_balance_due: centerBalanceDue,
        payment_mode: "center",
        payment_reference: "PAY_AT_CENTRE",
        registration_number: returnedRegNo,
        student_id: returnedStudentId,
      });

      setDocUploadSuccessList(uploadSuccesses);
      setDocUploadErrors(uploadFailures);

      // Advance to Confirmation Step
      setCurrentStep(maxStep);

      toast({
        variant: "success",
        title: "Admission Registered! (Pay at Study Centre)",
        description: `Student ID #${returnedStudentId} generated! Visit ${selectedCentre?.franchisee_name || "your study centre"} to complete fee deposit and activate your official Registration ID.`,
        duration: 8000,
      });
    } catch (err: any) {
      console.error("[Center Enrollment Error]:", err);
      setPaymentError(
        err.message || "Failed to register center admission. Please contact support."
      );
      toast({
        variant: "error",
        title: "Registration Failed",
        description: err.message || "Could not register admission.",
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ── Auto Countdown Redirect to /student/courses on Confirmation ───────────
  useEffect(() => {
    if (currentStep !== maxStep || !enrollmentSuccess) return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/student/courses");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, maxStep, enrollmentSuccess, router]);

  // ── Loading Screen ────────────────────────────────────────────────────────
  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <Loader2 className="w-9 h-9 text-[#5B21F4] animate-spin mx-auto mb-3" />
          <h2 className="text-sm font-bold text-[#0F172A]">
            Securing Course Enrollment Session...
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Verifying admission credentials and eligibility
          </p>
        </div>
      </div>
    );
  }

  const backLinkHref = portalType === "user" ? "/user/courses" : "/student/courses";
  const backLinkTitle = portalType === "user" ? "Back to Courses" : "Back to Student Courses";

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* ── Top Bar / Header ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E2E8F0] sticky top-0 z-10 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={backLinkHref}
              className="p-2 rounded-xl text-[#64748B] hover:text-[#111827] hover:bg-[#F1F5F9] transition-colors"
              title={backLinkTitle}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#5B21F4] bg-[#F1EEFF] px-2.5 py-0.5 rounded-full">
                  {isExistingStudent ? "New Course Enrollment" : "Student Admission"}
                </span>
                {selectedCourse && (
                  <span className="text-xs font-mono font-bold text-[#64748B]">
                    {selectedCourse.course_code}
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-black text-[#0F172A] tracking-tight">
                {isExistingStudent
                  ? `Enroll in New Course — ${selectedCourse ? selectedCourse.course_name : ""}`
                  : (selectedCourse ? selectedCourse.course_name : "Student Admission")}
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            <ShieldCheck className="w-4 h-4 text-[#08A66A]" />
            <span>Secure Razorpay Admission</span>
          </div>
        </div>

        {/* ── Dynamic Stepper Progress Indicator ───────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 border-t border-[#F1F5F9]">
          <div className={`grid gap-2 ${isExistingStudent ? "grid-cols-3" : "grid-cols-4"}`}>
            {steps.map((s) => {
              const isDone = currentStep > s.id;
              const isCurrent = currentStep === s.id;

              return (
                <div key={s.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isDone
                          ? "bg-[#08A66A] text-white"
                          : isCurrent
                          ? "bg-[#5B21F4] text-white shadow-md shadow-[#5B21F4]/25 ring-2 ring-[#5B21F4]/20"
                          : "bg-[#E2E8F0] text-[#64748B]"
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : s.id}
                    </div>
                    <span
                      className={`text-xs font-bold truncate transition-colors ${
                        isCurrent
                          ? "text-[#5B21F4]"
                          : isDone
                          ? "text-[#08A66A]"
                          : "text-[#94A3B8]"
                      }`}
                    >
                      <span className="hidden sm:inline">{s.title}</span>
                      <span className="sm:hidden">{s.shortTitle}</span>
                    </span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-1 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isDone
                          ? "bg-[#08A66A] w-full"
                          : isCurrent
                          ? "bg-[#5B21F4] w-2/3"
                          : "w-0"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Container ────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Existing Student Banner */}
        {isExistingStudent && currentStep < maxStep && (
          <div className="mb-6 bg-gradient-to-r from-[#EFF6FF] via-[#F0FDF4] to-[#EFF6FF] border border-[#BFDBFE] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-blue-900">
                    Existing Registered Student
                  </span>
                  <Badge variant="outline" className="bg-white text-blue-700 font-mono text-[11px] font-bold border-blue-200">
                    {existingRegNo || `Student #${existingStudentId}`}
                  </Badge>
                </div>
                <p className="text-xs text-[#475569] mt-0.5">
                  Welcome back, <strong className="text-[#0F172A]">{name || currentUser?.name}</strong>. Your personal and document records are already verified on file.
                </p>
              </div>
            </div>
            <div className="text-right text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-3 py-1.5 rounded-lg shrink-0">
              ✓ Fast 3-Step Course Enrollment
            </div>
          </div>
        )}

        {/* ── 3-Column Layout: Form Body (8 cols) + Sticky Order Summary (4 cols) ─ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Step Body */}
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              {/* ============================================================= */}
              {/* STEP 1: PERSONAL DETAILS (FIRST TIME) OR COURSE & CENTRE (EXISTING) */}
              {/* ============================================================= */}
              {currentStep === 1 && !isExistingStudent && (
                <motion.div
                  key="step1-first-time"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
                >
                  <div className="border-b border-[#F1F5F9] pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
                          Step 1 of 4
                        </span>
                        <h2 className="text-lg font-black text-[#0F172A] mt-0.5">
                          Student Personal &amp; Admission Information
                        </h2>
                      </div>
                      <span className="text-xs text-[#94A3B8] font-medium hidden sm:inline">
                        Required for bi_student record
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1">
                      As a first-time student, your official admission profile and registration number will be generated from these details.
                    </p>
                  </div>

                  {/* Primary Info Pre-filled from Account */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                    <div>
                      <label className="text-[11px] font-bold text-[#475569] uppercase">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Legal Student Name"
                        className="w-full mt-1 px-3 py-2 text-xs font-semibold bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#5B21F4]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#475569] uppercase">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="student@example.com"
                        className="w-full mt-1 px-3 py-2 text-xs font-semibold bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#5B21F4]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#475569] uppercase">
                        Mobile Number *
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full mt-1 px-3 py-2 text-xs font-semibold bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#5B21F4]"
                      />
                    </div>
                  </div>

                  {/* Parents Details & DOB */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Father&apos;s Name *
                      </label>
                      <input
                        type="text"
                        value={fname}
                        onChange={(e) => setFname(e.target.value)}
                        placeholder="Father's full name"
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Mother&apos;s Name *
                      </label>
                      <input
                        type="text"
                        value={mname}
                        onChange={(e) => setMname(e.target.value)}
                        placeholder="Mother's full name"
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Parent / Guardian Contact
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={parentMobile}
                        onChange={(e) => setParentMobile(e.target.value)}
                        placeholder="Guardian mobile (optional)"
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      />
                    </div>
                  </div>

                  {/* DOB, Gender & Aadhaar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Date of Birth *
                      </label>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Gender *
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Aadhaar Number
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        value={aadhaar}
                        onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
                        placeholder="12-digit Aadhaar"
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      />
                    </div>
                  </div>

                  {/* Residential Address */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Residential Address *
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="House / Street / Locality"
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-bold text-[#1E293B]">
                          City / District *
                        </label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. Patna, Muzaffarpur"
                          className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#1E293B]">
                          State *
                        </label>
                        <input
                          type="text"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="Bihar"
                          className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#1E293B]">
                          Pincode *
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                          placeholder="6-digit PIN"
                          className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Academic Qualification & Referral */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Highest Qualification
                      </label>
                      <select
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      >
                        <option value="10th Matric">10th (Matriculation)</option>
                        <option value="12th Intermediate">12th (Intermediate / +2)</option>
                        <option value="Diploma">Diploma / Polytechnic</option>
                        <option value="Graduation">Graduation (BA, BSc, BCom, BTech, BCA)</option>
                        <option value="Post Graduation">Post Graduation (MA, MSc, MBA, MCA)</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        How did you hear about Brainzima?
                      </label>
                      <select
                        value={referredBy}
                        onChange={(e) => setReferredBy(e.target.value)}
                        className="w-full mt-1 px-3 py-2.5 text-xs font-medium bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                      >
                        <option value="Online Website">Online Website</option>
                        <option value="Social Media">Instagram / Facebook / YouTube</option>
                        <option value="Friend/Student">Referred by Friend or Current Student</option>
                        <option value="Study Centre">Local Study Centre Visit</option>
                        <option value="Banner/Pamphlet">Banner / Advertisement</option>
                      </select>
                    </div>
                  </div>

                  {/* Document Uploads Preview (All 4 Admission Documents) */}
                  <div className="border-t border-[#F1F5F9] pt-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                        <UploadCloud className="w-4 h-4 text-[#5B21F4]" />
                        <span>Admission Verification Documents (Optional at Admission)</span>
                      </h3>
                      <span className="text-[10px] font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        4 Documents
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mb-3">
                      Attach your documents now for instant verification or upload them anytime later from your Student Portal.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. Passport Photo */}
                      <div className={`border rounded-xl p-3 transition-all ${
                        docFileNames.profile
                          ? "border-emerald-300 bg-emerald-50/40"
                          : "border-dashed border-[#CBD5E1] hover:border-[#5B21F4] bg-[#F8FAFC]"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {previewProfileUrl ? (
                              <img
                                src={previewProfileUrl}
                                alt="Profile preview"
                                className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-emerald-500/30"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#64748B] shrink-0">
                                <User className="w-4 h-4 text-[#5B21F4]" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-[#1E293B] truncate">
                                  Passport Photo
                                </p>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-[#5B21F4]">
                                  Photo
                                </span>
                              </div>
                              <p className="text-[10px] text-[#64748B] truncate mt-0.5">
                                {docFileNames.profile ? (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    {docFileNames.profile}
                                  </span>
                                ) : (
                                  "JPG, PNG (max 5MB)"
                                )}
                              </p>
                            </div>
                          </div>
                          <label className="text-[11px] font-bold text-[#5B21F4] hover:text-[#4314B7] bg-white border border-[#CBD5E1] hover:border-[#5B21F4] px-2.5 py-1 rounded-lg cursor-pointer shrink-0 transition-colors shadow-2xs">
                            {docFileNames.profile ? "Change" : "Browse"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleFileSelect(e, "profile")}
                            />
                          </label>
                        </div>
                      </div>

                      {/* 2. Aadhaar Card (Front) */}
                      <div className={`border rounded-xl p-3 transition-all ${
                        docFileNames.aadhaar_front
                          ? "border-emerald-300 bg-emerald-50/40"
                          : "border-dashed border-[#CBD5E1] hover:border-[#5B21F4] bg-[#F8FAFC]"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#E2E8F0] flex items-center justify-center text-[#64748B] shrink-0">
                              <CreditCard className="w-4 h-4 text-[#08A66A]" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-[#1E293B] truncate">
                                  Aadhaar Card (Front)
                                </p>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  Identity
                                </span>
                              </div>
                              <p className="text-[10px] text-[#64748B] truncate mt-0.5">
                                {docFileNames.aadhaar_front ? (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    {docFileNames.aadhaar_front}
                                  </span>
                                ) : (
                                  "PDF, JPG, PNG"
                                )}
                              </p>
                            </div>
                          </div>
                          <label className="text-[11px] font-bold text-[#5B21F4] hover:text-[#4314B7] bg-white border border-[#CBD5E1] hover:border-[#5B21F4] px-2.5 py-1 rounded-lg cursor-pointer shrink-0 transition-colors shadow-2xs">
                            {docFileNames.aadhaar_front ? "Change" : "Browse"}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => handleFileSelect(e, "aadhaar_front")}
                            />
                          </label>
                        </div>
                      </div>

                      {/* 3. Aadhaar Card (Back) */}
                      <div className={`border rounded-xl p-3 transition-all ${
                        docFileNames.aadhaar_back
                          ? "border-emerald-300 bg-emerald-50/40"
                          : "border-dashed border-[#CBD5E1] hover:border-[#5B21F4] bg-[#F8FAFC]"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#E2E8F0] flex items-center justify-center text-[#64748B] shrink-0">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-[#1E293B] truncate">
                                  Aadhaar Card (Back)
                                </p>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                                  Address
                                </span>
                              </div>
                              <p className="text-[10px] text-[#64748B] truncate mt-0.5">
                                {docFileNames.aadhaar_back ? (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    {docFileNames.aadhaar_back}
                                  </span>
                                ) : (
                                  "Address & QR (PDF, JPG, PNG)"
                                )}
                              </p>
                            </div>
                          </div>
                          <label className="text-[11px] font-bold text-[#5B21F4] hover:text-[#4314B7] bg-white border border-[#CBD5E1] hover:border-[#5B21F4] px-2.5 py-1 rounded-lg cursor-pointer shrink-0 transition-colors shadow-2xs">
                            {docFileNames.aadhaar_back ? "Change" : "Browse"}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => handleFileSelect(e, "aadhaar_back")}
                            />
                          </label>
                        </div>
                      </div>

                      {/* 4. Academic Qualification Proof */}
                      <div className={`border rounded-xl p-3 transition-all ${
                        docFileNames.qualification
                          ? "border-emerald-300 bg-emerald-50/40"
                          : "border-dashed border-[#CBD5E1] hover:border-[#5B21F4] bg-[#F8FAFC]"
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#E2E8F0] flex items-center justify-center text-[#64748B] shrink-0">
                              <GraduationCap className="w-4 h-4 text-orange-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-[#1E293B] truncate">
                                  Academic Qualification
                                </p>
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                                  Record
                                </span>
                              </div>
                              <p className="text-[10px] text-[#64748B] truncate mt-0.5">
                                {docFileNames.qualification ? (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    {docFileNames.qualification}
                                  </span>
                                ) : (
                                  "Marksheet / Certificate"
                                )}
                              </p>
                            </div>
                          </div>
                          <label className="text-[11px] font-bold text-[#5B21F4] hover:text-[#4314B7] bg-white border border-[#CBD5E1] hover:border-[#5B21F4] px-2.5 py-1 rounded-lg cursor-pointer shrink-0 transition-colors shadow-2xs">
                            {docFileNames.qualification ? "Change" : "Browse"}
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => handleFileSelect(e, "qualification")}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 1 Actions */}
                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={handleNextStep}
                      className="bg-[#5B21F4] hover:bg-[#4a17cc] text-white px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <span>Continue to Study Centre</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ============================================================= */}
              {/* STEP 1 FOR EXISTING STUDENT: COURSE, BATCH & STUDY CENTRE      */}
              {/* ============================================================= */}
              {currentStep === 1 && isExistingStudent && (
                <motion.div
                  key="step1-existing-student"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
                >
                  <div className="border-b border-[#F1F5F9] pb-4">
                    <span className="text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
                      Step 1 of 3
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A] mt-0.5">
                      Select Course &amp; Study Centre
                    </h2>
                    <p className="text-xs text-[#64748B] mt-1">
                      Choose the new course you wish to enroll in. Your existing student ID (<strong className="text-blue-900 font-mono">#{existingStudentId}</strong>) will be linked automatically.
                    </p>
                  </div>

                  {/* Course Dropdown */}
                  <div>
                    <label className="text-xs font-bold text-[#1E293B]">
                      Course *
                    </label>
                    <select
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2.5 text-xs font-semibold bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                    >
                      {coursesList.map((c) => (
                        <option key={c.course_id} value={String(c.course_id)}>
                          {c.course_name} ({c.course_code}) — ₹{Number(c.course_fee).toLocaleString("en-IN")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Batch Selection */}
                  {selectedCourse?.batches && selectedCourse.batches.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Select Batch
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                        {selectedCourse.batches.map((b: CourseBatch) => {
                          const isSel = String(b.batch_id) === String(selectedBatchId);
                          return (
                            <button
                              key={b.batch_id}
                              type="button"
                              onClick={() => setSelectedBatchId(String(b.batch_id))}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSel
                                  ? "border-[#5B21F4] bg-[#F1EEFF] text-[#0F172A] shadow-xs"
                                  : "border-[#E2E8F0] hover:border-[#CBD5E1] text-[#475569] bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">
                                  {b.batch_name}
                                </span>
                                {isSel && (
                                  <Check className="w-3.5 h-3.5 text-[#5B21F4]" />
                                )}
                              </div>
                              <p className="text-[11px] text-[#64748B] mt-0.5">
                                Mode: {b.batch_mode || "Classroom & Lab"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Study Centre Selector */}
                  <div>
                    <label className="text-xs font-bold text-[#1E293B]">
                      Authorized Study Centre *
                    </label>
                    <select
                      value={selectedCentreId}
                      onChange={(e) => setSelectedCentreId(Number(e.target.value))}
                      className="w-full mt-1.5 px-3 py-2.5 text-xs font-semibold bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                    >
                      {centresList.map((c) => (
                        <option key={c.franchisee_id} value={c.franchisee_id}>
                          {c.franchisee_name} — {c.franchisee_city || c.franchisee_state || "India"} ({c.franchisee_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step Actions */}
                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={handleNextStep}
                      className="bg-[#5B21F4] hover:bg-[#4a17cc] text-white px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <span>Continue to Fee &amp; Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ============================================================= */}
              {/* STEP 2 FOR FIRST-TIME STUDENT: STUDY CENTRE & BATCH           */}
              {/* ============================================================= */}
              {currentStep === 2 && !isExistingStudent && (
                <motion.div
                  key="step2-first-time"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
                >
                  <div className="border-b border-[#F1F5F9] pb-4">
                    <span className="text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
                      Step 2 of 4
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A] mt-0.5">
                      Select Study Centre &amp; Batch
                    </h2>
                    <p className="text-xs text-[#64748B] mt-1">
                      Choose your preferred Brainzima franchise study centre for classroom sessions, practical labs, and certification exams.
                    </p>
                  </div>

                  {/* Course Pre-selected Display */}
                  <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#5B21F4] bg-[#F1EEFF] px-2 py-0.5 rounded-md">
                        Enrolling Course
                      </span>
                      <h4 className="text-sm font-bold text-[#0F172A] mt-1">
                        {selectedCourse?.course_name}
                      </h4>
                      <p className="text-xs text-[#64748B] font-mono">
                        Code: {selectedCourse?.course_code} • Duration: {selectedCourse?.course_duration || "12 Months"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-[#64748B]">Total Fee</span>
                      <p className="text-base font-black text-[#0F172A]">
                        ₹{Number(selectedCourse?.course_fee || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  {/* Franchise Study Centre Selection */}
                  <div>
                    <label className="text-xs font-bold text-[#1E293B]">
                      Authorized Franchise Study Centre *
                    </label>
                    <select
                      value={selectedCentreId}
                      onChange={(e) => setSelectedCentreId(Number(e.target.value))}
                      className="w-full mt-1.5 px-3 py-2.5 text-xs font-semibold bg-white border border-[#CBD5E1] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B21F4]/20 focus:border-[#5B21F4]"
                    >
                      {centresList.map((c) => (
                        <option key={c.franchisee_id} value={c.franchisee_id}>
                          {c.franchisee_name} — {c.franchisee_city || c.franchisee_state || "India"} ({c.franchisee_code})
                        </option>
                      ))}
                    </select>

                    {selectedCentre && (
                      <div className="mt-3 p-3 bg-[#F1F5F9] rounded-xl text-xs text-[#475569] space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                          <Building2 className="w-3.5 h-3.5 text-[#5B21F4]" />
                          <span>{selectedCentre.franchisee_name}</span>
                        </div>
                        <p className="text-[11px] text-[#64748B]">
                          {selectedCentre.franchisee_adrs}, {selectedCentre.franchisee_city}, {selectedCentre.franchisee_state}
                        </p>
                        {selectedCentre.franchisee_mobile && (
                          <p className="text-[11px] text-[#64748B] flex items-center gap-1">
                            <Phone className="w-3 h-3 text-[#5B21F4]" />
                            <span>{selectedCentre.franchisee_mobile}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Batch Selection */}
                  {selectedCourse?.batches && selectedCourse.batches.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-[#1E293B]">
                        Select Batch Timing
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
                        {selectedCourse.batches.map((b: CourseBatch) => {
                          const isSel = String(b.batch_id) === String(selectedBatchId);
                          return (
                            <button
                              key={b.batch_id}
                              type="button"
                              onClick={() => setSelectedBatchId(String(b.batch_id))}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSel
                                  ? "border-[#5B21F4] bg-[#F1EEFF] text-[#0F172A] shadow-xs"
                                  : "border-[#E2E8F0] hover:border-[#CBD5E1] text-[#475569] bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold">{b.batch_name}</span>
                                {isSel && <Check className="w-3.5 h-3.5 text-[#5B21F4]" />}
                              </div>
                              <p className="text-[11px] text-[#64748B] mt-0.5">
                                Mode: {b.batch_mode || "Classroom & Lab"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Step Actions */}
                  <div className="pt-2 flex items-center justify-between">
                    <Button
                      variant="outline"
                      onClick={handlePrevStep}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" />
                      Back
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      className="bg-[#5B21F4] hover:bg-[#4a17cc] text-white px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <span>Continue to Fee &amp; Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* ============================================================= */}
              {/* PAYMENT STEP (STEP 3 FOR FIRST-TIME, STEP 2 FOR EXISTING)     */}
              {/* ============================================================= */}
              {((!isExistingStudent && currentStep === 3) ||
                (isExistingStudent && currentStep === 2)) && (
                <motion.div
                  key="step-payment"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
                >
                  <div className="border-b border-[#F1F5F9] pb-4">
                    <span className="text-xs font-bold text-[#5B21F4] uppercase tracking-wider">
                      {isExistingStudent ? "Step 2 of 3" : "Step 3 of 4"}
                    </span>
                    <h2 className="text-lg font-black text-[#0F172A] mt-0.5">
                      Fee Payment &amp; Confirmation
                    </h2>
                    <p className="text-xs text-[#64748B] mt-1">
                      Choose to pay online securely via Razorpay or pay directly at your study centre desk.
                    </p>
                  </div>

                  {/* Payment Mode Selector: Online vs Centre */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[#1E293B]">
                      Select Payment Mode *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("online")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          paymentMethod === "online"
                            ? "border-[#5B21F4] bg-[#F1EEFF] text-[#0F172A] ring-2 ring-[#5B21F4]/15"
                            : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white text-[#475569]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <CreditCard className="w-4 h-4 text-[#5B21F4]" />
                            Online Payment (Razorpay)
                          </span>
                          {paymentMethod === "online" && (
                            <CheckCircle2 className="w-4 h-4 text-[#5B21F4]" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-1.5">
                          Instant clearance with UPI, Debit/Credit Card, or NetBanking. Official Registration ID generated instantly.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("center")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          paymentMethod === "center"
                            ? "border-[#5B21F4] bg-[#F1EEFF] text-[#0F172A] ring-2 ring-[#5B21F4]/15"
                            : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white text-[#475569]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-[#5B21F4]" />
                            Pay at Study Centre
                          </span>
                          {paymentMethod === "center" && (
                            <CheckCircle2 className="w-4 h-4 text-[#5B21F4]" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-1.5">
                          Reserve your seat now (₹0 online). Pay fee directly at your study centre desk. Registration ID activated upon payment.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Online Payment Options */}
                  {paymentMethod === "online" && (
                    <div className="space-y-4">
                      {/* Payment Type Selection */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-[#1E293B]">
                          Choose Payment Option
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPaymentType("full")}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              paymentType === "full"
                                ? "border-[#5B21F4] bg-[#F1EEFF] text-[#0F172A] ring-2 ring-[#5B21F4]/15"
                                : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white text-[#475569]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">
                                Full One-Time Fee
                              </span>
                              {paymentType === "full" && (
                                <CheckCircle2 className="w-4 h-4 text-[#5B21F4]" />
                              )}
                            </div>
                            <p className="text-base font-black text-[#0F172A] mt-1">
                              ₹{finalFee.toLocaleString("en-IN")}
                            </p>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              Zero dues remaining. Instant full admission clearance.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPaymentType("partial")}
                            className={`p-4 rounded-xl border text-left transition-all ${
                              paymentType === "partial"
                                ? "border-[#5B21F4] bg-[#F1EEFF] text-[#0F172A] ring-2 ring-[#5B21F4]/15"
                                : "border-[#E2E8F0] hover:border-[#CBD5E1] bg-white text-[#475569]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">
                                Admission Initial Deposit
                              </span>
                              {paymentType === "partial" && (
                                <CheckCircle2 className="w-4 h-4 text-[#5B21F4]" />
                              )}
                            </div>
                            <p className="text-base font-black text-[#0F172A] mt-1">
                              ₹{amountToPay.toLocaleString("en-IN")}
                            </p>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              Remaining ₹{balanceDue.toLocaleString("en-IN")} payable in monthly installments.
                            </p>
                          </button>
                        </div>
                      </div>

                      {/* Partial Amount Input if partial is chosen */}
                      {paymentType === "partial" && (
                        <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-2">
                          <label className="text-xs font-bold text-[#1E293B]">
                            Custom Initial Payment (Minimum ₹1,000)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-[#64748B]">
                              ₹
                            </span>
                            <input
                              type="number"
                              min={1000}
                              max={finalFee}
                              step={500}
                              value={partialAmount}
                              onChange={(e) => setPartialAmount(Number(e.target.value))}
                              className="w-full pl-8 pr-3 py-2 text-xs font-bold bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#5B21F4]"
                            />
                          </div>
                          <p className="text-[11px] text-[#64748B]">
                            Balance due of ₹{balanceDue.toLocaleString("en-IN")} will be scheduled under your Student Portal fee ledger.
                          </p>
                        </div>
                      )}

                      {/* Payment Gateway Callout */}
                      <div className="p-4 bg-[#F1EEFF] rounded-xl border border-[#DDD6FE] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-6 h-6 text-[#5B21F4]" />
                          <div>
                            <p className="text-xs font-bold text-[#0F172A]">
                              Razorpay Payment Gateway
                            </p>
                            <p className="text-[11px] text-[#64748B]">
                              Supports UPI (GPay, PhonePe, Paytm), NetBanking, Credit/Debit Cards.
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-[#5B21F4]">
                            Amount to Pay
                          </span>
                          <p className="text-lg font-black text-[#5B21F4]">
                            ₹{amountToPay.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Centre Payment Notice & Desk Info */}
                  {paymentMethod === "center" && (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Pay at Study Centre Notice</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Your admission profile and <strong>Student ID</strong> will be generated immediately upon completing this step. However, your official <strong>Registration Number (BISR ID)</strong> will NOT be generated now. It will only be activated once you deposit your course fee at your study centre desk.
                        </p>
                      </div>

                      {/* Study Centre Desk Address Card */}
                      {selectedCentre && (
                        <div className="p-4 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-[#5B21F4]" />
                              Deposit Centre: {selectedCentre.franchisee_name}
                            </span>
                            <span className="font-mono text-[10px] text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                              {selectedCentre.franchisee_code}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B]">
                            {selectedCentre.franchisee_adrs}, {selectedCentre.franchisee_city}, {selectedCentre.franchisee_state}
                          </p>
                          {selectedCentre.franchisee_mobile && (
                            <p className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-[#5B21F4]" />
                              <span>Centre Contact: {selectedCentre.franchisee_mobile}</span>
                            </p>
                          )}
                          <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#475569]">
                              Fee Payable at Centre:
                            </span>
                            <span className="font-black text-[#5B21F4] text-sm">
                              ₹{finalFee.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error Notification */}
                  {paymentError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                      <div>
                        <strong>Payment Error:</strong> {paymentError}
                      </div>
                    </div>
                  )}

                  {/* Step Actions */}
                  <div className="pt-2 flex items-center justify-between">
                    <Button
                      variant="outline"
                      disabled={isProcessingPayment}
                      onClick={handlePrevStep}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1.5" />
                      Back
                    </Button>
                    {paymentMethod === "online" ? (
                      <Button
                        disabled={isProcessingPayment}
                        onClick={handleInitiatePayment}
                        className="bg-[#5B21F4] hover:bg-[#4a17cc] text-white px-8 py-3 rounded-xl text-xs font-black shadow-md shadow-[#5B21F4]/20 flex items-center gap-2 cursor-pointer"
                      >
                        {isProcessingPayment ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing Admission...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-emerald-300" />
                            <span>Pay ₹{amountToPay.toLocaleString("en-IN")} &amp; Confirm</span>
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        disabled={isProcessingPayment}
                        onClick={handleCenterPaymentEnrollment}
                        className="bg-[#5B21F4] hover:bg-[#4a17cc] text-white px-8 py-3 rounded-xl text-xs font-black shadow-md shadow-[#5B21F4]/20 flex items-center gap-2 cursor-pointer"
                      >
                        {isProcessingPayment ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Registering Admission...</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4 text-amber-300" />
                            <span>Confirm &amp; Pay at Centre</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ============================================================= */}
              {/* FINAL STEP: ADMISSION CONFIRMATION & RECEIPT                   */}
              {/* ============================================================= */}
              {currentStep === maxStep && enrollmentSuccess && (
                <motion.div
                  key="step-confirmation"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-center"
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner ${
                    enrollmentSuccess.payment_mode === "center"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}>
                    {enrollmentSuccess.payment_mode === "center" ? (
                      <Building2 className="w-8 h-8" />
                    ) : (
                      <CheckCircle2 className="w-8 h-8" />
                    )}
                  </div>

                  <div>
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                      enrollmentSuccess.payment_mode === "center"
                        ? "text-amber-800 bg-amber-50 border border-amber-200"
                        : "text-emerald-700 bg-emerald-50"
                    }`}>
                      {enrollmentSuccess.payment_mode === "center"
                        ? "Admission Registered • Centre Payment"
                        : isExistingStudent
                        ? "Course Enrolled"
                        : "Admission Confirmed"}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] mt-2">
                      Congratulations, {name || currentUser?.name}!
                    </h2>
                    <p className="text-xs text-[#64748B] mt-1 max-w-md mx-auto">
                      {enrollmentSuccess.payment_mode === "center" ? (
                        <>
                          Your admission in <strong className="text-[#0F172A]">{enrollmentSuccess.course_name}</strong> has been registered. Please visit your study centre to complete fee payment and activate your official Registration ID.
                        </>
                      ) : (
                        <>
                          Your enrollment in <strong className="text-[#0F172A]">{enrollmentSuccess.course_name}</strong> is verified and officially recorded.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Registration Badge & Details */}
                  <div className="max-w-md mx-auto bg-[#F8FAFC] border border-[#CBD5E1] p-4 rounded-xl text-left space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-semibold">Registration Number:</span>
                      {enrollmentSuccess.registration_number ? (
                        <span className="font-mono font-black text-blue-900 text-sm">
                          {enrollmentSuccess.registration_number}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded text-[11px]">
                          Pending (Pay at Study Centre)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-semibold">Student ID:</span>
                      <span className="font-bold text-[#0F172A]">
                        #{enrollmentSuccess.student_id || existingStudentId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-semibold">Amount Paid:</span>
                      <span className={`font-bold ${enrollmentSuccess.payment_mode === "center" ? "text-amber-700" : "text-emerald-700"}`}>
                        {enrollmentSuccess.payment_mode === "center"
                          ? "₹0 (Pending at Centre)"
                          : `₹${Number(enrollmentSuccess.amount_paid).toLocaleString("en-IN")}`}
                      </span>
                    </div>
                    {enrollmentSuccess.payment_mode === "center" && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#64748B] font-semibold">Fee Payable at Desk:</span>
                        <span className="font-black text-[#5B21F4]">
                          ₹{(enrollmentSuccess.center_deposit_amount || finalFee).toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-semibold">Study Centre:</span>
                      <span className="font-medium text-[#0F172A] text-right truncate max-w-[200px]">
                        {enrollmentSuccess.franchisee_name}
                      </span>
                    </div>
                    {enrollmentSuccess.franchisee_adrs && (
                      <div className="text-[11px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                        <span className="font-semibold text-[#475569]">Centre Address: </span>
                        <span>{enrollmentSuccess.franchisee_adrs}</span>
                      </div>
                    )}
                    {enrollmentSuccess.payment_reference && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#E2E8F0]">
                        <span className="text-[#94A3B8]">Payment Ref:</span>
                        <span className="font-mono text-[#64748B]">
                          {enrollmentSuccess.payment_reference}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Document Upload Result Callout */}
                  {docUploadSuccessList.length > 0 && (
                    <div className="max-w-md mx-auto p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 text-left">
                      <strong>Documents Saved:</strong> {docUploadSuccessList.join(", ")}
                    </div>
                  )}

                  {/* Auto-redirect Banner */}
                  <div className="pt-2">
                    <p className="text-xs text-[#64748B] mb-3">
                      Redirecting to your student dashboard in <strong className="text-[#5B21F4]">{redirectCountdown}</strong> seconds...
                    </p>
                    <Button
                      onClick={() => router.push("/student/courses")}
                      className="bg-[#5B21F4] hover:bg-[#4a17cc] text-white px-6 py-2.5 rounded-xl text-xs font-bold"
                    >
                      <span>Go to My Student Courses</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ================================================================= */}
          {/* RIGHT COLUMN: STICKY ORDER & FEE SUMMARY                          */}
          {/* ================================================================= */}
          <div className="lg:col-span-4 sticky top-28 space-y-4">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center justify-between">
                <span>Admission Summary</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </h3>

              {/* Course Overview Card */}
              {selectedCourse ? (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-[#5B21F4] bg-[#F1EEFF] px-2 py-0.5 rounded">
                        {selectedCourse.course_code}
                      </span>
                      <h4 className="text-xs font-bold text-[#0F172A] mt-1 leading-snug">
                        {selectedCourse.course_name}
                      </h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#64748B] pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#94A3B8]" />
                      {selectedCourse.course_duration || "12 Months"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#94A3B8]" />
                      Classroom &amp; Lab
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-20 bg-[#F1F5F9] rounded-xl animate-pulse" />
              )}

              {/* Selected Centre */}
              {selectedCentre && (
                <div className="text-[11px] text-[#64748B] space-y-1 border-t border-[#F1F5F9] pt-3">
                  <span className="text-[10px] font-bold uppercase text-[#94A3B8]">
                    Selected Study Centre
                  </span>
                  <p className="font-bold text-[#0F172A] truncate">
                    {selectedCentre.franchisee_name}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] truncate">
                    {selectedCentre.franchisee_city}, {selectedCentre.franchisee_state}
                  </p>
                </div>
              )}

              {/* ── Offline Course Coupon Offers & Apply Section ────────── */}
              <div className="border-t border-[#F1F5F9] pt-3">
                <CouponOfferCards
                  courseType="offline"
                  courseId={selectedCourse ? Number(selectedCourse.course_id) : undefined}
                  courseFee={courseFee}
                  currentUser={
                    currentUser
                      ? {
                          user_id: currentUser.user_id,
                          email: email || currentUser.email,
                          mobile: mobile || currentUser.mobile,
                          role: currentUser.role,
                        }
                      : null
                  }
                  appliedCoupon={appliedCoupon}
                  onApplySuccess={(verified) => {
                    setAppliedCoupon({
                      ...verified,
                      course_id: selectedCourse ? Number(selectedCourse.course_id) : undefined,
                    });
                    setDiscount(Number(verified.discount_amount) || 0);
                    setCouponSuccess(
                      `Coupon "${verified.coupon_code}" applied! You saved ₹${Number(
                        verified.discount_amount
                      ).toLocaleString("en-IN")}.`
                    );
                    setCouponError(null);
                    fireCouponConfetti();
                  }}
                  onRemoveCoupon={() => {
                    handleRemoveCoupon();
                  }}
                />
              </div>

              {/* Fee Breakdown */}
              <div className="border-t border-[#F1F5F9] pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>Official Course Fee:</span>
                  <span className="font-semibold text-[#0F172A]">
                    ₹{courseFee.toLocaleString("en-IN")}
                  </span>
                </div>

                {appliedCoupon && cleanDiscount > 0 ? (
                  <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/80 border border-emerald-200/80 px-2.5 py-1.5 rounded-xl font-semibold">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Coupon ({appliedCoupon.coupon_code}):</span>
                    </span>
                    <span className="font-black text-emerald-800 text-xs">
                      -₹{cleanDiscount.toLocaleString("en-IN")}
                    </span>
                  </div>
                ) : cleanDiscount > 0 ? (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Approved Scholarship:</span>
                    <span>-₹{cleanDiscount.toLocaleString("en-IN")}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-[#0F172A] font-bold pt-1 border-t border-[#F1F5F9]">
                  <span>Total Net Payable:</span>
                  <span className="text-sm font-black text-[#5B21F4]">
                    ₹{finalFee.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-1 mt-2">
                  <div className="flex justify-between text-xs font-bold text-[#0F172A]">
                    <span>Paying Today:</span>
                    <span className={paymentMethod === "center" ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                      {paymentMethod === "center" ? "₹0 (Pay at Centre)" : `₹${amountToPay.toLocaleString("en-IN")}`}
                    </span>
                  </div>
                  {paymentMethod === "center" ? (
                    <div className="flex justify-between text-[11px] text-[#0F172A] font-semibold pt-1 border-t border-[#E2E8F0]">
                      <span>Fee Payable at Centre:</span>
                      <span className="text-[#5B21F4] font-bold">₹{finalFee.toLocaleString("en-IN")}</span>
                    </div>
                  ) : (
                    balanceDue > 0 && (
                      <div className="flex justify-between text-[11px] text-[#64748B]">
                        <span>Remaining Balance:</span>
                        <span>₹{balanceDue.toLocaleString("en-IN")}</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Trust Badge */}
              <div className="pt-2 text-center text-[10px] text-[#94A3B8] leading-tight space-y-1">
                <p className="font-semibold text-[#64748B]">
                  🛡️ 100% Secure &amp; Verified Admission
                </p>
                <p>
                  Official receipt and student ID card generated upon payment completion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
