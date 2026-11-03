// app/online-courses/page.tsx
// Seamless route alias that directs to the User Portal Online Courses page.

import { redirect } from "next/navigation";

export default function OnlineCoursesRedirect() {
  redirect("/user/online-courses");
}
