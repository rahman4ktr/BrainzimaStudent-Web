/**
 * lib/studentUtils.ts
 * Single source of truth for Student ID and Registration Number logic.
 *
 * Rules:
 * 1. For verified / paid students, registration number MUST match student_id:
 *    student_id = 23 -> "BISR0023" (padded to 4 digits: BISR0023, never row-counter like BISR0003).
 * 2. If a student chooses Center Payment (Pay at Study Centre), student_id IS generated,
 *    but registration_number (BISR...) is NOT generated until payment is cleared at the centre.
 */

/**
 * Formats official student registration number strictly from student_id.
 * e.g., student_id = 23 -> "BISR0023"
 * e.g., student_id = 5  -> "BISR0005"
 */
export function formatRegistrationNumber(
  studentId: number | string | null | undefined
): string | null {
  if (!studentId) return null;
  const num = Number(studentId);
  if (isNaN(num) || num <= 0) return null;
  return `BISR${String(num).padStart(4, "0")}`;
}

/**
 * Checks whether an enrollment or student has paid any fees.
 */
export function hasStudentPaid(
  initialPayment?: number | string | null,
  totalPaid?: number | string | null,
  paymentMode?: string | null
): boolean {
  const init = Number(initialPayment || 0);
  const paid = Number(totalPaid || 0);
  if (init > 0 || paid > 0) return true;
  if (paymentMode === "razorpay" || paymentMode === "upi" || paymentMode === "card") {
    return true;
  }
  return false;
}

/**
 * Resolves the accurate registration number.
 * Returns null if registration number has not been generated (e.g. pending Center Payment).
 */
export function resolveRegistrationNumber(
  studentId: number | string | null | undefined,
  rawRegNo?: string | null,
  hasPaid: boolean = true
): string | null {
  if (!hasPaid) return null;
  if (studentId && Number(studentId) > 0) {
    return formatRegistrationNumber(studentId);
  }
  return rawRegNo || null;
}
