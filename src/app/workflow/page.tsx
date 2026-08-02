import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LegacyDashboard } from "./legacy-dashboard";

export const dynamic = "force-dynamic";

export default async function WorkflowPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) redirect("/login");

  return <LegacyDashboard />;
}
