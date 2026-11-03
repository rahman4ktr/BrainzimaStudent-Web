// app/online-courses/[courseId]/page.tsx
// Seamless route alias that redirects to the User Portal Online Course LMS page.

import { redirect } from "next/navigation";

export default async function OnlineCourseDetailRedirect({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  redirect(`/user/online-courses/${courseId}`);
}
