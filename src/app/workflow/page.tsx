import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LegacyDashboard } from "./legacy-dashboard";
import { ProjectHub, type ProjectHubContext } from "./project-hub";

export const dynamic = "force-dynamic";

const QUICKSTART_EMAIL = "quickstart@volkerkusch.de";

export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; view?: string; project?: string }>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) redirect("/login");

  const currentEmail = String(data.claims.email || "").toLowerCase();
  if (currentEmail === QUICKSTART_EMAIL) {
    // The shared pilot account is onboarding-only. It must never become a common
    // project switcher for unrelated pilot users.
    redirect("/quickstart?mode=company&fresh=1");
  }

  const requested = await searchParams;
  const { data: hubData, error: hubError } = await supabase.rpc("project_hub_context");
  if (hubError) throw new Error(`Projektübersicht konnte nicht geladen werden: ${hubError.message}`);
  const hub=(hubData||{companies:[]}) as ProjectHubContext;

  if (!requested.project) return <ProjectHub context={hub} userEmail={currentEmail}/>;

  const accessibleProjectIds=new Set((hub.companies||[]).flatMap(c=>(c.projects||[]).map(p=>p.id)));
  if (!accessibleProjectIds.has(requested.project)) redirect("/workflow");

  const legacyParams = new URLSearchParams();
  if (requested.task) legacyParams.set("task", requested.task);
  if (requested.view) legacyParams.set("view", requested.view);
  legacyParams.set("project", requested.project);

  return <LegacyDashboard query={legacyParams.toString()} hubContext={hub} activeProjectId={requested.project}/>;
}
