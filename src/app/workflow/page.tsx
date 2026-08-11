import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LegacyDashboard } from "./legacy-dashboard";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; view?: string; project?: string }>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) redirect("/login");

  const requested = await searchParams;
  const legacyParams = new URLSearchParams();
  if (requested.task) legacyParams.set("task", requested.task);
  if (requested.view) legacyParams.set("view", requested.view);
  if (requested.project) legacyParams.set("project", requested.project);

  return <LegacyDashboard query={legacyParams.toString()} />;
}
