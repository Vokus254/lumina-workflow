import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SPECIAL_TOOL_STEP_CODES, SPECIAL_TOOL_SUBITEMS, resolveStepLookupPlan, resolveToolTitle } from "@/app/workflow/special-tools";
import { sortMeinTagTasks, weekEndIsoFrom } from "@/lib/mein-tag-priority";
import { nextOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding-status";
import { deriveStructuralDependencies } from "@/lib/task-dependency";
import { requireLuminaAdmin } from "@/lib/lumina-admin";

// V12: strukturierte 0-LLM-Datenschicht fuer den KAI/KIRA-Workspace. Nutzt exakt denselben
// RLS-gebundenen Supabase-Server-Client wie day-sparring/route.ts - keine Service-Role, keine
// neue Policy. Jede Aktion laedt bewusst nur die fuer diese Teilansicht noetigen Spalten/Zeilen
// statt "alles laden und clientseitig filtern" (V12-Praezisierung 2).

// "start" liefert nur die Chip-Definitionen; ein Chip-Klick ruft dieselbe Action erneut mit der
// konkreten Teilmenge auf (myOpenTasks/myOverdueTasks/dueToday/reviewIssues/missingEvidence) -
// fachlich weiterhin "start"-Familie, technisch eigene Actions fuer schlankes, gezieltes Laden.
type Action = "start" | "myOpenTasks" | "myOverdueTasks" | "dueToday" | "reviewIssues" | "missingEvidence" | "awaitingReview" | "processTree" | "measure" | "documents" | "communication" | "search" | "colleagues" | "onboardingAdvance" | "bearbeiterOverview" | "myAllTasks" | "auditTrail" | "myRoleContext" | "reviewInbox" | "reviewerOverview" | "adminOverview";

function roleTierFromSecurityRole(role?: string | null): "steuerung" | "review" | "bearbeiter" {
  if (role === "owner" || role === "manager") return "steuerung";
  if (role === "reviewer") return "review";
  return "bearbeiter";
}

const SECURITY_ROLE_LABELS: Record<string, string> = { owner: "Projektinhaber", manager: "Projektleitung", reviewer: "Review", contributor: "Mitwirkende:r", viewer: "Beobachter:in" };

// V13: liest die kollegiale Verantwortungsuebersicht ("Wer arbeitet mit dir?") ausschliesslich aus
// responsibility_roles - derselben Tabelle, die "measure" schon projektweit fuer "Zustaendig: ..."
// nutzt (RLS: private.can_access_project). Keine neue Tabelle/RPC, keine role_user_assignments-Zeilen
// anderer Nutzer (die bleiben laut bestehender RLS self-only).
async function loadColleagues(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, ownRoleIds: Set<string>) {
  const { data } = await supabase.from("responsibility_roles").select("id,display_name,role_key,first_name,last_name").eq("project_id", projectId).order("display_name", { ascending: true }).limit(30);
  return (data || [])
    .filter((row: any) => !ownRoleIds.has(String(row.id)))
    .map((row: any) => ({ role: row.display_name || row.role_key, person: [row.first_name, row.last_name].filter(Boolean).join(" ") || null }))
    .slice(0, 8);
}


export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  const userId = String(claims.sub);

  let body: { projectId?: string; action?: Action; params?: Record<string, any> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 }); }
  const projectId = String(body.projectId || "").trim();
  const action = body.action;
  const params = body.params || {};
  if (!projectId || !action) return NextResponse.json({ error: "Projekt oder Aktion fehlt." }, { status: 400 });

  const { data: project, error: projectError } = await supabase
    .from("projects").select("id,name,company_id").eq("id", projectId).maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt." }, { status: 403 });

  const [roleAssignmentResult, projectMemberResult] = await Promise.all([
    supabase.from("role_user_assignments").select("role_id").eq("user_id", userId),
    supabase.from("project_members").select("security_role,active").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
  ]);
  const roleIds = new Set((roleAssignmentResult.data || []).map((row: any) => String(row.role_id || "")).filter(Boolean));
  const securityRole = projectMemberResult.data?.active === false ? null : projectMemberResult.data?.security_role || null;
  const roleTier = roleTierFromSecurityRole(securityRole);

  const userMetadata = (claims.user_metadata || {}) as Record<string, unknown>;
  const displayName = String(userMetadata.display_name || "").trim()
    || [userMetadata.first_name, userMetadata.last_name].map((v) => String(v || "").trim()).filter(Boolean).join(" ")
    || String(claims.email || "").split("@")[0]
    || "LUMINA Nutzer";
  const firstName = displayName.split(" ")[0] || displayName;

  try {
    if (action === "start") {
      // V12: der KAI/KIRA-Start ist vollstaendig 0-Token - keine day-sparring-/LLM-Anfrage.
      // "Als Naechstes offen" liest dieselbe RLS-gebundene, PERSOENLICH zugewiesene Aufgabenmenge
      // wie "Mein Tag" (responsibility_role_id in roleIds) und sortiert sie ueber genau dieselbe
      // Prioritaetslogik (sortMeinTagTasks, siehe src/lib/mein-tag-priority.ts) - keine eigene,
      // abweichende Reihenfolge, keine KI-Interpretation/Risikoeinschaetzung, keine erfundene
      // Priorisierung.
      const today = new Date().toISOString().slice(0, 10);
      const weekEndIso = weekEndIsoFrom(today);
      const { data: taskRows } = roleIds.size
        ? await supabase.from("tasks").select("id,source_number,title,process_step_id,work_status,review_status,due_date,due_date_override,required_documents_text").eq("project_id", projectId).in("responsibility_role_id", Array.from(roleIds))
        : { data: [] as any[] };
      const rows = taskRows || [];
      const open = rows.filter((row: any) => row.work_status !== "completed");
      const overdue = open.filter((row: any) => (row.due_date_override || row.due_date) && (row.due_date_override || row.due_date) < today);
      const dueToday = open.filter((row: any) => (row.due_date_override || row.due_date) === today);
      const reviewIssues = open.filter((row: any) => row.review_status === "question" || row.review_status === "changes_required");
      const missingEvidence = open.filter((row: any) => String(row.required_documents_text || "").trim());

      const stepIds = Array.from(new Set(open.map((row: any) => row.process_step_id).filter(Boolean)));
      const { data: stepRows } = stepIds.length ? await supabase.from("process_steps").select("id,code").in("id", stepIds) : { data: [] as any[] };
      const stepById = new Map((stepRows || []).map((step: any) => [String(step.id), step]));
      const openForSort = open.map((row: any) => ({
        id: row.id,
        number: row.source_number || "",
        title: row.title || "",
        processStepCode: row.process_step_id ? stepById.get(String(row.process_step_id))?.code || null : null,
        dueDate: row.due_date_override || row.due_date || null,
        workStatus: row.work_status,
        reviewStatus: row.review_status,
        sourceNumber: row.source_number || "",
      }));
      const nextOpenTasks = sortMeinTagTasks(openForSort, today, weekEndIso).slice(0, 5).map((row) => ({
        id: row.id, number: row.number, title: row.title, processStepCode: row.processStepCode, dueDate: row.dueDate, workStatus: row.workStatus, reviewStatus: row.reviewStatus,
      }));

      // V13: First-Login-Onboarding. Der Status wird NUR gelesen, nie durch dieses Rendern
      // geschrieben (siehe user_project_onboarding-Migration/RLS) - das Fortschreiben passiert
      // ausschliesslich ueber die explizite Aktion "onboardingAdvance" (Nutzerklick im Client).
      const { data: onboardingRow } = await supabase.from("user_project_onboarding").select("status").eq("user_id", userId).eq("project_id", projectId).maybeSingle();
      if (!onboardingRow || onboardingRow.status !== "active") {
        const upcoming = open.filter((row: any) => {
          const due = row.due_date_override || row.due_date;
          return due && due > today && due <= weekEndIso;
        });
        const [roleRowsResult, milestoneResult, colleagues] = await Promise.all([
          roleIds.size ? supabase.from("responsibility_roles").select("display_name,role_key").in("id", Array.from(roleIds)).limit(3) : Promise.resolve({ data: [] as any[] }),
          supabase.from("project_milestones").select("label,milestone_date").eq("project_id", projectId).gte("milestone_date", today).order("milestone_date", { ascending: true }).limit(1).maybeSingle(),
          loadColleagues(supabase, projectId, roleIds),
        ]);
        const roleLabel = (roleRowsResult.data || [])[0]?.display_name || (roleRowsResult.data || [])[0]?.role_key || (securityRole ? SECURITY_ROLE_LABELS[securityRole] || null : null);
        const milestone = milestoneResult.data;
        return NextResponse.json({
          card: {
            type: "onboarding",
            greeting: `Hallo ${firstName}, schön dich hier das erste Mal zu sehen.`,
            role: roleLabel,
            tasks: { open: open.length, overdue: overdue.length, dueToday: dueToday.length, upcoming: upcoming.length },
            nextTask: nextOpenTasks[0] || null,
            nextMilestone: milestone ? { label: milestone.label, date: milestone.milestone_date } : null,
            colleagues,
          },
        });
      }

      const chips: { label: string; action: string; count?: number }[] = [
        { label: "Meine offenen Aufgaben", action: "myOpenTasks", count: open.length },
        { label: "Was ist heute fällig?", action: "dueToday", count: dueToday.length },
        { label: "Abschlussprozess", action: "processTree" },
        { label: "Nächste Termine", action: "schedule" },
        { label: "Rückfragen", action: "reviewIssues", count: reviewIssues.length },
        { label: "KIRA-Prüfung", action: "switchKira" },
      ];
      if (roleTier === "steuerung") chips.splice(1, 0, { label: "Meine überfälligen Aufgaben", action: "myOverdueTasks", count: overdue.length });
      if (roleTier === "bearbeiter") chips.push({ label: "Aufgaben ohne Nachweis", action: "missingEvidence", count: missingEvidence.length });

      return NextResponse.json({ card: { type: "start", greeting: `Hallo ${firstName}, was machen wir heute?`, nextOpenTasks, chips } });
    }

    if (action === "myOpenTasks" || action === "myOverdueTasks" || action === "dueToday" || action === "reviewIssues" || action === "missingEvidence" || action === "awaitingReview") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: taskRows, error } = roleIds.size
        ? await supabase.from("tasks").select("id,source_number,title,process_step_id,due_date,due_date_override,work_status,review_status,required_documents_text").eq("project_id", projectId).in("responsibility_role_id", Array.from(roleIds))
        : { data: [] as any[], error: null };
      if (error) return NextResponse.json({ error: "Aufgaben konnten nicht geladen werden." }, { status: 500 });
      const stepIds = Array.from(new Set((taskRows || []).map((row: any) => row.process_step_id).filter(Boolean)));
      const { data: stepRows } = stepIds.length ? await supabase.from("process_steps").select("id,code,name").in("id", stepIds) : { data: [] as any[] };
      const stepById = new Map((stepRows || []).map((step: any) => [String(step.id), step]));
      // "awaitingReview" lässt bewusst bereits eingereichte (nicht "completed") Aufgaben zu, die
      // anderen Filter blenden work_status="completed" grundsätzlich aus - genau wie bisher.
      let rows = action === "awaitingReview" ? (taskRows || []) : (taskRows || []).filter((row: any) => row.work_status !== "completed");
      if (action === "myOverdueTasks") rows = rows.filter((row: any) => (row.due_date_override || row.due_date) && (row.due_date_override || row.due_date) < today);
      if (action === "dueToday") rows = rows.filter((row: any) => (row.due_date_override || row.due_date) === today);
      // Fachlich korrekt getrennt: "reviewIssues" = Rueckfrage/Nachbesserung (review_status),
      // "awaitingReview" = eingereicht und noch nicht akzeptiert (work_status="submitted" UND
      // review_status <> "accepted") - zwei unterschiedliche, nicht austauschbare Filter.
      if (action === "reviewIssues") rows = rows.filter((row: any) => row.review_status === "question" || row.review_status === "changes_required");
      if (action === "awaitingReview") rows = rows.filter((row: any) => row.work_status === "submitted" && row.review_status !== "accepted");
      if (action === "missingEvidence") rows = rows.filter((row: any) => String(row.required_documents_text || "").trim());
      const titleByAction: Record<string, string> = { myOpenTasks: "Meine offenen Aufgaben", myOverdueTasks: "Meine überfälligen Aufgaben", dueToday: "Heute fällig", reviewIssues: "Rückfrage / Nachbesserung", missingEvidence: "Aufgaben ohne Nachweis", awaitingReview: "Eingereicht / wartet auf Review" };
      const tasks = rows.slice(0, 60).map((row: any) => {
        const step: any = row.process_step_id ? stepById.get(String(row.process_step_id)) : null;
        return { id: row.id, number: row.source_number || "", title: row.title || "", processStepCode: step?.code || null, dueDate: row.due_date_override || row.due_date || null, workStatus: row.work_status, reviewStatus: row.review_status };
      }).sort((a: any, b: any) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")));
      return NextResponse.json({ card: { type: "taskList", title: titleByAction[action] || "Aufgaben", tasks } });
    }

    if (action === "processTree") {
      const parentCode = params.parentCode ? String(params.parentCode) : null;
      const { data: stepRows, error } = await supabase.from("process_steps").select("id,code,name,parent_id,sort_order").eq("project_id", projectId).order("sort_order", { ascending: true });
      if (error) return NextResponse.json({ error: "Prozessschritte konnten nicht geladen werden." }, { status: 500 });
      const steps = stepRows || [];
      const stepById = new Map(steps.map((step: any) => [String(step.id), step]));
      const { data: taskRows } = await supabase.from("tasks").select("id,process_step_id,responsibility_role_id").eq("project_id", projectId);
      const relevantStepIds = new Set<string>();
      for (const task of taskRows || []) {
        if (!task.responsibility_role_id || !roleIds.has(String(task.responsibility_role_id))) continue;
        let current: any = task.process_step_id ? stepById.get(String(task.process_step_id)) : null;
        const seen = new Set<string>();
        while (current && !seen.has(String(current.id))) {
          seen.add(String(current.id));
          relevantStepIds.add(String(current.id));
          current = current.parent_id ? stepById.get(String(current.parent_id)) : null;
        }
      }
      const parentStep = parentCode ? steps.find((step: any) => step.code === parentCode) : null;
      const children = steps.filter((step: any) => (parentCode ? step.parent_id === parentStep?.id : !step.parent_id));
      const items = children.map((step: any) => ({
        code: step.code,
        name: step.name,
        relevant: relevantStepIds.has(String(step.id)),
        isTool: SPECIAL_TOOL_STEP_CODES.has(step.code),
      })).sort((a: any, b: any) => a.code.localeCompare(b.code, "de", { numeric: true }));
      return NextResponse.json({ card: { type: "processSteps", parentCode, parentName: parentStep?.name || null, steps: items } });
    }

    if (action === "measure") {
      // "ref" ist ein generischer, vom Nutzer getippter Bezug (z. B. aus "gehe zu Kachel 1.7"
      // oder "zeige Aufgabe 29") und wird - anders als die schon bekannten taskNumber/stepCode aus
      // Kachel-/Listenklicks - versuchsweise gegen BEIDE Interpretationen geprüft, statt zu raten.
      const ref = params.ref ? String(params.ref).trim() : null;
      const taskNumber = params.taskNumber ? String(params.taskNumber) : ref;
      const stepCodeCandidate = params.stepCode ? String(params.stepCode) : ref;
      let task: any = null;
      if (taskNumber) {
        const { data } = await supabase.from("tasks").select("id,source_number,title,process_step_id,due_date,due_date_override,work_status,review_status,required_documents_text,expected_format,responsibility_role_id").eq("project_id", projectId).eq("source_number", taskNumber).maybeSingle();
        task = data;
      }
      // Exakter Code hat IMMER Vorrang; resolveStepLookupPlan() (special-tools.ts, unit-getestet)
      // liefert den Elterncode nur, wenn der angefragte Code selbst ein bekannter
      // Unterwerkzeug-Schlüssel ist (z. B. "3.17.1" -> "3.17"). Das ist der V12-Regressionsfix für
      // "1.7"/"3.17", jetzt als eigenständige, testbare Funktion statt Inline-Logik.
      let step: any = null;
      if (task?.process_step_id) {
        const { data } = await supabase.from("process_steps").select("id,code,name,parent_id").eq("id", task.process_step_id).maybeSingle();
        step = data;
      } else if (stepCodeCandidate) {
        const lookupPlan = resolveStepLookupPlan(stepCodeCandidate);
        const { data: exact } = await supabase.from("process_steps").select("id,code,name,parent_id").eq("project_id", projectId).eq("code", lookupPlan.exactCode).maybeSingle();
        if (exact) {
          step = exact;
        } else if (lookupPlan.parentFallbackCode) {
          const { data: parent } = await supabase.from("process_steps").select("id,code,name,parent_id").eq("project_id", projectId).eq("code", lookupPlan.parentFallbackCode).maybeSingle();
          step = parent;
        }
      }
      const stepCode = step?.code || stepCodeCandidate;

      if (!task && !step) {
        // V12-Nachschärfung: nicht existierende Kachel/Aufgabe wird deterministisch beantwortet,
        // inkl. naheliegender Treffer - kein LLM, keine lange Erklärung.
        const lookupRef = ref || taskNumber || stepCodeCandidate || "";
        const phasePrefix = lookupRef.includes(".") ? lookupRef.split(".")[0] : null;
        const [siblingResult, taskGuessResult] = await Promise.all([
          phasePrefix ? supabase.from("process_steps").select("code,name").eq("project_id", projectId).ilike("code", `${phasePrefix}.%`).order("code", { ascending: true }).limit(8) : Promise.resolve({ data: [] as any[] }),
          lookupRef ? supabase.from("tasks").select("source_number,title").eq("project_id", projectId).or(`source_number.ilike.%${lookupRef}%,title.ilike.%${lookupRef}%`).limit(5) : Promise.resolve({ data: [] as any[] }),
        ]);
        const suggestions = [
          ...((siblingResult.data || []).map((row: any) => ({ kind: "step" as const, ref: row.code, label: `${row.code} · ${row.name}`, status: null, dueDate: null }))),
          ...((taskGuessResult.data || []).map((row: any) => ({ kind: "task" as const, ref: row.source_number, label: `${row.source_number} · ${row.title}`, status: null, dueDate: null }))),
        ].slice(0, 10);
        return NextResponse.json({ card: { type: "notFound", message: `„${lookupRef}“ gibt es in diesem Abschlussprozess nicht.`, suggestions } });
      }

      const [guidanceResult, roleResult] = await Promise.all([
        step?.id ? supabase.from("process_step_guidance").select("ziel,was_ist_zu_tun,benoetigte_unterlagen,liefergegenstand,typische_fehler,erledigt_wenn,arbeitshilfe_name").eq("process_step_id", step.id).maybeSingle() : Promise.resolve({ data: null }),
        task?.responsibility_role_id ? supabase.from("responsibility_roles").select("display_name,role_key,first_name,last_name,email").eq("id", task.responsibility_role_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const role: any = roleResult.data;
      // Der ursprünglich angefragte Code hat Vorrang vor dem (evtl. nur zur Guidance-Auflösung
      // verwendeten) Elternschritt - "3.17.1" muss als 3.17.1 zurückgegeben werden, nicht als 3.17.
      const toolCode = SPECIAL_TOOL_SUBITEMS[stepCodeCandidate || ""] ? stepCodeCandidate : (step?.code && SPECIAL_TOOL_STEP_CODES.has(step.code) ? step.code : null);
      const toolTitle = resolveToolTitle(toolCode, step?.name);

      return NextResponse.json({
        card: {
          type: "measure",
          task: task ? { id: task.id, number: task.source_number, title: task.title, dueDate: task.due_date_override || task.due_date || null, workStatus: task.work_status, reviewStatus: task.review_status, requiredDocuments: task.required_documents_text, expectedFormat: task.expected_format } : null,
          step: step ? { id: step.id, code: step.code, name: step.name } : null,
          responsibility: role ? { role: role.display_name || role.role_key, person: [role.first_name, role.last_name].filter(Boolean).join(" ") || null, email: role.email || null } : null,
          guidance: guidanceResult.data || null,
          tool: toolCode ? { code: toolCode, title: toolTitle } : null,
        },
      });
    }

    if (action === "documents") {
      const taskId = String(params.taskId || "");
      if (!taskId) return NextResponse.json({ error: "Aufgabe fehlt." }, { status: 400 });
      const { data, error } = await supabase.from("documents").select("id,display_name,document_status,created_at").eq("task_id", taskId).is("archived_at", null).order("created_at", { ascending: false }).limit(50);
      if (error) return NextResponse.json({ card: { type: "denied", reason: "Dokumente für diese Aufgabe sind für dich nicht verfügbar." } });
      return NextResponse.json({ card: { type: "documents", taskId, documents: (data || []).map((row: any) => ({ id: row.id, displayName: row.display_name, status: row.document_status, createdAt: row.created_at })) } });
    }

    if (action === "communication") {
      const taskId = String(params.taskId || "");
      if (!taskId) return NextResponse.json({ error: "Aufgabe fehlt." }, { status: 400 });
      const { data, error } = await supabase.from("task_messages").select("id,subject,body_text,status,message_type,created_at").eq("task_id", taskId).order("created_at", { ascending: false }).limit(30);
      if (error) return NextResponse.json({ card: { type: "denied", reason: "Kommunikation für diese Aufgabe ist für dich nicht verfügbar." } });
      return NextResponse.json({ card: { type: "communication", taskId, messages: (data || []).map((row: any) => ({ id: row.id, subject: row.subject, body: String(row.body_text || "").slice(0, 600), status: row.status, type: row.message_type, createdAt: row.created_at })) } });
    }

    if (action === "search") {
      const query = String(params.query || "").trim();
      if (query.length < 2) return NextResponse.json({ card: { type: "search", query, results: [] } });
      const like = `%${query}%`;
      const [taskMatches, stepMatches] = await Promise.all([
        supabase.from("tasks").select("id,source_number,title,work_status,due_date,due_date_override").eq("project_id", projectId).or(`source_number.ilike.${like},title.ilike.${like}`).limit(15),
        supabase.from("process_steps").select("id,code,name").eq("project_id", projectId).or(`code.ilike.${like},name.ilike.${like}`).limit(10),
      ]);
      const toolMatches = Object.entries(SPECIAL_TOOL_SUBITEMS).filter(([code, title]) => code.includes(query) || title.toLocaleLowerCase("de-DE").includes(query.toLocaleLowerCase("de-DE"))).slice(0, 6);
      const results = [
        ...((taskMatches.data || []).map((row: any) => ({ kind: "task", ref: row.source_number, label: `${row.source_number} · ${row.title}`, status: row.work_status, dueDate: row.due_date_override || row.due_date || null }))),
        ...((stepMatches.data || []).map((row: any) => ({ kind: "step", ref: row.code, label: `${row.code} · ${row.name}`, status: null, dueDate: null }))),
        ...(toolMatches.map(([code, title]) => ({ kind: "tool", ref: code, label: `${code} · ${title}`, status: null, dueDate: null }))),
      ].slice(0, 25);
      return NextResponse.json({ card: { type: "search", query, results } });
    }

    if (action === "bearbeiterOverview" || action === "myAllTasks") {
      // Abschluss-Chat V1 (Briefing "Shell-Umstellung"): gemeinsame Datenquelle fuer Sidebar
      // (bearbeiterOverview, kompakt) und "Alle Aufgaben anzeigen" (myAllTasks, vollstaendig) -
      // dieselbe Abfrage/Ableitung, nur unterschiedlich weit geschnitten, keine zweite Logik.
      // Ausschliesslich echte, RLS-gebundene Daten - keine Mockup-Zahlen, keine erfundenen
      // Personen. Abhaengigkeits-Chips sind bewusst strukturell/vorlaeufig (siehe
      // src/lib/task-dependency.ts) statt der im Mockup gezeigten semantischen Cross-Task-Verweise,
      // fuer die es noch keine echte Datenquelle gibt (V15-Architekturentscheidung).
      const today = new Date().toISOString().slice(0, 10);
      const { data: taskRows } = roleIds.size
        ? await supabase.from("tasks").select("id,source_number,title,process_step_id,work_status,review_status,due_date,due_date_override").eq("project_id", projectId).in("responsibility_role_id", Array.from(roleIds))
        : { data: [] as any[] };
      const rows = taskRows || [];
      const stepIds = Array.from(new Set(rows.map((row: any) => row.process_step_id).filter(Boolean)));
      const { data: stepRows } = stepIds.length ? await supabase.from("process_steps").select("id,code,name,parent_id").in("id", stepIds) : { data: [] as any[] };
      const stepById = new Map((stepRows || []).map((step: any) => [String(step.id), step]));

      const depInput = rows.map((row: any) => {
        const step: any = row.process_step_id ? stepById.get(String(row.process_step_id)) : null;
        return { id: row.id, parentStepId: step?.parent_id ? String(step.parent_id) : row.process_step_id ? String(row.process_step_id) : null, sortKey: row.source_number || row.id, workStatus: row.work_status, reviewStatus: row.review_status };
      });
      const dependencies = deriveStructuralDependencies(depInput);
      const defaultDependency = { kind: "free" as const, label: "keine weitere Aufgabe in diesem Prozessschritt" };

      const annotatedOpen = sortMeinTagTasks(
        rows.filter((row: any) => row.work_status !== "completed").map((row: any) => {
          const step: any = row.process_step_id ? stepById.get(String(row.process_step_id)) : null;
          return { id: row.id, number: row.source_number || "", title: row.title || "", processStepCode: step?.code || null, dueDate: row.due_date_override || row.due_date || null, workStatus: row.work_status, reviewStatus: row.review_status, sourceNumber: row.source_number || "" };
        }),
        today,
        weekEndIsoFrom(today),
      ).map((row: any) => ({ id: row.id, number: row.number, title: row.title, processStepCode: row.processStepCode, dueDate: row.dueDate, workStatus: row.workStatus, reviewStatus: row.reviewStatus, dependency: dependencies.get(row.id) || defaultDependency }));

      if (action === "myAllTasks") {
        return NextResponse.json({ card: { type: "taskList", title: `Alle meine Aufgaben (${rows.length})`, tasks: annotatedOpen } });
      }

      const phaseTotals = new Map<string, { code: string; count: number }>();
      for (const row of rows) {
        const step: any = row.process_step_id ? stepById.get(String(row.process_step_id)) : null;
        const phaseCode = (step?.code || "").split(".")[0] || "?";
        const entry = phaseTotals.get(phaseCode) || { code: phaseCode, count: 0 };
        entry.count += 1;
        phaseTotals.set(phaseCode, entry);
      }
      const phases = Array.from(phaseTotals.values()).sort((a, b) => a.code.localeCompare(b.code, "de", { numeric: true }));

      const done = rows.filter((row: any) => row.work_status === "completed");
      const open = rows.filter((row: any) => row.work_status !== "completed");
      const overdue = open.filter((row: any) => (row.due_date_override || row.due_date) && (row.due_date_override || row.due_date) < today);
      const blocking = Array.from(dependencies.values()).filter((dep) => dep.kind === "blocks").length;
      const waiting = Array.from(dependencies.values()).filter((dep) => dep.kind === "waits").length;

      const roleRow = roleIds.size ? await supabase.from("responsibility_roles").select("display_name,role_key").in("id", Array.from(roleIds)).limit(1).maybeSingle() : { data: null };
      const roleLabel = roleRow.data?.display_name || roleRow.data?.role_key || (securityRole ? SECURITY_ROLE_LABELS[securityRole] || null : null);

      return NextResponse.json({
        card: {
          type: "bearbeiterOverview",
          person: { name: displayName, role: roleLabel, email: claims.email || null },
          phases,
          kpis: { done: done.length, total: rows.length, overdue: overdue.length, blocking, waiting },
          currentTasks: annotatedOpen.slice(0, 8),
        },
      });
    }

    if (action === "auditTrail") {
      // Zeigt ausschliesslich echte task_activity_events (RLS: events_access_select nutzt bereits
      // can_access_task) - keine erfundenen Audit-Zeilen, keine neue Event-Struktur.
      const taskId = String(params.taskId || "");
      if (!taskId) return NextResponse.json({ error: "Aufgabe fehlt." }, { status: 400 });
      const { data, error } = await supabase.from("task_activity_events").select("id,event_type,event_data,created_at").eq("task_id", taskId).order("created_at", { ascending: false }).limit(30);
      if (error) return NextResponse.json({ card: { type: "denied", reason: "Audit-Trail für diese Aufgabe ist für dich nicht verfügbar." } });
      return NextResponse.json({ card: { type: "auditTrail", taskId, events: (data || []).map((row: any) => ({ id: String(row.id), eventType: row.event_type, eventData: row.event_data || {}, createdAt: row.created_at })) } });
    }

    if (action === "myRoleContext") {
      // V2: reine Routing-Hilfe (welche Rollen-Chat-Shell wird angedockt) - KEINE
      // Sicherheitsentscheidung. Datenzugriff bleibt in jeder View ausschliesslich ueber
      // bestehende RLS/RPCs gesteuert, unabhaengig davon, welche Shell gerendert wird.
      const roleRows = roleIds.size ? await supabase.from("responsibility_roles").select("role_key").in("id", Array.from(roleIds)) : { data: [] as any[] };
      return NextResponse.json({ card: { type: "roleContext", securityRole, roleKeys: (roleRows.data || []).map((row: any) => row.role_key) } });
    }

    if (action === "reviewerOverview" || action === "reviewInbox") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: ownRows } = roleIds.size
        ? await supabase.from("tasks").select("id,due_date,due_date_override,work_status").eq("project_id", projectId).in("responsibility_role_id", Array.from(roleIds))
        : { data: [] as any[] };
      const ownOpen = (ownRows || []).filter((row: any) => row.work_status !== "completed");
      const ownOverdue = ownOpen.filter((row: any) => (row.due_date_override || row.due_date) && (row.due_date_override || row.due_date) < today);

      // Review-Eingang: projektweite eingereichte Aufgaben. Nur lesbar, weil
      // project_members.security_role='reviewer' bereits ueber die bestehende can_access_task-
      // Bedingung is_project_member(p.id) vollen Task-Lesezugriff gewaehrt - keine neue Query-
      // Logik jenseits von RLS, keine Client-seitige Umgehung.
      const { data: submittedRows, error: submittedError } = await supabase.from("tasks").select("id,source_number,title,work_status,review_status,due_date,due_date_override,responsibility_role_id").eq("project_id", projectId).eq("work_status", "submitted");
      if (submittedError) return NextResponse.json({ error: "Review-Eingang konnte nicht geladen werden." }, { status: 500 });
      const roleIdsForSubmitted = Array.from(new Set((submittedRows || []).map((row: any) => row.responsibility_role_id).filter(Boolean)));
      const { data: roleRows } = roleIdsForSubmitted.length ? await supabase.from("responsibility_roles").select("id,display_name,role_key").in("id", roleIdsForSubmitted) : { data: [] as any[] };
      const roleById = new Map((roleRows || []).map((row: any) => [String(row.id), row]));
      const inbox = (submittedRows || []).map((row: any) => ({
        id: row.id, number: row.source_number || "", title: row.title || "", workStatus: row.work_status, reviewStatus: row.review_status,
        dueDate: row.due_date_override || row.due_date || null,
        submitterRole: roleById.get(String(row.responsibility_role_id))?.display_name || roleById.get(String(row.responsibility_role_id))?.role_key || null,
      })).sort((a: any, b: any) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")));
      const changesRequired = inbox.filter((row: any) => row.reviewStatus === "changes_required" || row.reviewStatus === "question");

      if (action === "reviewInbox") return NextResponse.json({ card: { type: "taskList", title: "Review-Eingang", tasks: inbox } });
      return NextResponse.json({ card: { type: "reviewerOverview", kpis: { openReviews: inbox.length, changesRequired: changesRequired.length, ownOpen: ownOpen.length, ownOverdue: ownOverdue.length }, inbox: inbox.slice(0, 10) } });
    }

    if (action === "adminOverview") {
      // Admin-Cockpit: nutzt dieselbe bestehende Autorisierung wie /api/admin
      // (requireLuminaAdmin - lumina_admins, service-role NUR fuer die Autorisierungspruefung
      // selbst, nicht fuer die eigentlichen Daten). Die Datenabfragen laufen ueber den normalen,
      // RLS-gebundenen Client dieser Route - private.is_lumina_admin() ist bereits ein
      // bestehender Zweig in can_access_task() und gewaehrt vollen, projektgebundenen Lesezugriff.
      const adminCheck = await requireLuminaAdmin();
      if (!adminCheck.ok) return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });

      const today = new Date().toISOString().slice(0, 10);
      const [taskRowsResult, roleRowsResult, assignmentRowsResult, auditRowsResult] = await Promise.all([
        supabase.from("tasks").select("id,work_status,review_status,due_date,due_date_override,responsibility_role_id,process_step_id").eq("project_id", projectId),
        supabase.from("responsibility_roles").select("id,display_name,role_key").eq("project_id", projectId),
        supabase.from("role_user_assignments").select("role_id,user_id"),
        supabase.from("task_activity_events").select("id,event_type,event_data,created_at,actor_user_id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(15),
      ]);
      const taskRows = taskRowsResult.data || [];
      const roleRows = roleRowsResult.data || [];
      const assignmentRows = assignmentRowsResult.data || [];
      const stepIds = Array.from(new Set(taskRows.map((row: any) => row.process_step_id).filter(Boolean)));
      const { data: stepRows } = stepIds.length ? await supabase.from("process_steps").select("id,code").in("id", stepIds) : { data: [] as any[] };
      const stepById = new Map((stepRows || []).map((step: any) => [String(step.id), step]));

      const assignedRoleIds = new Set(assignmentRows.map((row: any) => String(row.role_id)));
      const kpis = {
        total: taskRows.length,
        open: taskRows.filter((row: any) => row.work_status !== "completed" && row.work_status !== "submitted").length,
        submitted: taskRows.filter((row: any) => row.work_status === "submitted").length,
        completed: taskRows.filter((row: any) => row.work_status === "completed").length,
        overdue: taskRows.filter((row: any) => (row.due_date_override || row.due_date) && (row.due_date_override || row.due_date) < today && row.work_status !== "completed").length,
        reviewIssues: taskRows.filter((row: any) => row.review_status === "question" || row.review_status === "changes_required").length,
        rolesTotal: roleRows.length,
        rolesAssigned: roleRows.filter((role: any) => assignedRoleIds.has(String(role.id))).length,
      };

      const roles = roleRows.map((role: any) => {
        const roleTasks = taskRows.filter((row: any) => String(row.responsibility_role_id) === String(role.id));
        const roleOverdue = roleTasks.filter((row: any) => (row.due_date_override || row.due_date) && (row.due_date_override || row.due_date) < today && row.work_status !== "completed");
        return { id: role.id, label: role.display_name || role.role_key, taskCount: roleTasks.length, overdue: roleOverdue.length, assigned: assignedRoleIds.has(String(role.id)) };
      }).sort((a: any, b: any) => b.taskCount - a.taskCount);

      const phaseTotals = new Map<string, { code: string; total: number; done: number }>();
      for (const row of taskRows) {
        const step: any = row.process_step_id ? stepById.get(String(row.process_step_id)) : null;
        const phaseCode = (step?.code || "").split(".")[0] || "?";
        const entry = phaseTotals.get(phaseCode) || { code: phaseCode, total: 0, done: 0 };
        entry.total += 1;
        if (row.work_status === "completed") entry.done += 1;
        phaseTotals.set(phaseCode, entry);
      }
      const phases = Array.from(phaseTotals.values()).sort((a, b) => a.code.localeCompare(b.code, "de", { numeric: true }));

      const dueBuckets = new Map<string, number>();
      for (const row of taskRows) {
        const due = row.due_date_override || row.due_date;
        if (!due) continue;
        dueBuckets.set(due, (dueBuckets.get(due) || 0) + 1);
      }
      const upcomingDeadlines = Array.from(dueBuckets.entries()).filter(([due]) => due >= today).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 6).map(([due, count]) => ({ date: due, count }));

      const auditRows = auditRowsResult.data || [];
      const actorIds = Array.from(new Set(auditRows.map((row: any) => row.actor_user_id).filter(Boolean)));
      const actorLookups = await Promise.all(actorIds.map((id: string) => adminCheck.admin.auth.admin.getUserById(id)));
      const actorEmailById = new Map(actorLookups.map((lookup: any, index: number) => [String(actorIds[index]), lookup.data?.user?.email || null]));
      const audit = auditRows.map((row: any) => ({ id: String(row.id), eventType: row.event_type, eventData: row.event_data || {}, createdAt: row.created_at, actorEmail: row.actor_user_id ? actorEmailById.get(String(row.actor_user_id)) || null : null }));

      return NextResponse.json({ card: { type: "adminOverview", kpis, roles, phases, upcomingDeadlines, audit, isSuperAdmin: adminCheck.isSuperAdmin } });
    }

    if (action === "colleagues") {
      const colleagues = await loadColleagues(supabase, projectId, roleIds);
      return NextResponse.json({ card: { type: "colleagues", colleagues } });
    }

    if (action === "onboardingAdvance") {
      // V13: einzige Schreibstelle fuer user_project_onboarding - wird ausschliesslich durch eine
      // explizite Nutzeraktion im Client ausgeloest (Klick auf eine Onboarding-Aktion), nie durch
      // ein automatisches Initial-Rendern.
      const requestedStatus: OnboardingStatus = params.targetStatus === "active" ? "active" : "introduced";
      const nowIso = new Date().toISOString();
      const { data: existing } = await supabase.from("user_project_onboarding").select("status,introduced_at").eq("user_id", userId).eq("project_id", projectId).maybeSingle();
      const currentStatus: OnboardingStatus = (existing?.status as OnboardingStatus) || "not_started";
      // Monoton: not_started -> introduced -> active, nie rueckwaerts (siehe nextOnboardingStatus).
      // "active" bleibt "active", auch wenn hier versehentlich erneut "introduced" ankaeme.
      const nextStatus = nextOnboardingStatus(currentStatus, requestedStatus);
      const patch: Record<string, any> = { user_id: userId, project_id: projectId, status: nextStatus };
      if (nextStatus !== "not_started" && !existing?.introduced_at) patch.introduced_at = nowIso;
      if (nextStatus === "active" && currentStatus !== "active") patch.activated_at = nowIso;
      const { error } = await supabase.from("user_project_onboarding").upsert(patch, { onConflict: "user_id,project_id" });
      if (error) return NextResponse.json({ error: "Onboarding-Status konnte nicht gespeichert werden." }, { status: 500 });
      return NextResponse.json({ ok: true, status: nextStatus });
    }

    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Workspace-Daten konnten nicht geladen werden." }, { status: 502 });
  }
}
