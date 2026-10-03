// app/user/page.tsx
import { redirect } from "next/navigation";

export default function UserRootPage() {
  redirect("/user/dashboard");
}
