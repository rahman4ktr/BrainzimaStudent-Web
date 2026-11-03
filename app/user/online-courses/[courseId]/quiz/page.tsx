import { redirect } from "next/navigation";

export default async function UserOnlineCourseQuizPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  redirect(`/student/online-courses/${courseId}/quiz`);
}

