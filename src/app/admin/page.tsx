import { redirect } from "next/navigation";
import { requireLuminaAdmin } from "@/lib/lumina-admin";
import AdminHub from "./admin-hub";

export default async function AdminPage() {
  const access = await requireLuminaAdmin();
  if (!access.ok) {
    if (access.status === 401) redirect("/login?next=/admin");
    redirect("/workflow");
  }
  return <AdminHub />;
}
