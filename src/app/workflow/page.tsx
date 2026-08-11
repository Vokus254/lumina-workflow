import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LegacyDashboard } from "./legacy-dashboard";
import { ProjectHub, type ProjectHubContext } from "./project-hub";

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
  const { data: hubData, error: hubError } = await supabase.rpc("project_hub_context");
  if (hubError) throw new Error(`Projektübersicht konnte nicht geladen werden: ${hubError.message}`);
  const hub=(hubData||{companies:[]}) as ProjectHubContext;

  // /workflow without an explicit project is deliberately a project hub.
  // Never let the legacy dashboard aggregate multiple projects.
  if (!requested.project) return <ProjectHub context={hub}/>;

  const accessibleProjectIds=new Set((hub.companies||[]).flatMap(c=>(c.projects||[]).map(p=>p.id)));
  if (!accessibleProjectIds.has(requested.project)) redirect("/workflow");

  const legacyParams = new URLSearchParams();
  if (requested.task) legacyParams.set("task", requested.task);
  if (requested.view) legacyParams.set("view", requested.view);
  legacyParams.set("project", requested.project);

  return <LegacyDashboard query={legacyParams.toString()} hubContext={hub} activeProjectId={requested.project}/>;
}
