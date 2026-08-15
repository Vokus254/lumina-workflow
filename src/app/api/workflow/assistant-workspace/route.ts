import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SPECIAL_TOOL_STEP_CODES, SPECIAL_TOOL_SUBITEMS, resolveStepLookupPlan, resolveToolTitle } from "@/app/workflow/special-tools";
import { sortMeinTagTasks, weekEndIsoFrom } from "@/lib/mein-tag-priority";

// V12: strukturierte 0-LLM-Datenschicht fuer den KAI/KIRA-Workspace. Nutzt exakt denselben
// RLS-gebundenen Supabase-Server-Client wie day-sparring/route.ts - keine Service-Role, keine
// neue Policy. Jede Aktion laedt bewusst nur die fuer diese Teilansicht noetigen Spalten/Zeilen
// statt "alles laden und clientseitig filtern" (V12-Praezisierung 2).

// "start" liefert nur die Chip-Definitionen; ein Chip-Klick ruft dieselbe Action erneut mit der
// konkreten Teilmenge auf (myOpenTasks/myOverdueTasks/dueToday/reviewIssues/missingEvidence) -
// fachlich weiterhin "start"-Familie, technisch eigene Actions fuer schlankes, gezieltes Laden.
type Action = "start" | "myOpenTasks" | "myOverdueTasks" | "dueToday" | "reviewIssues" | "missingEvidence" | "processTree" | "measure" | "documents" | "communication" | "search";

function roleTierFromSecurityRole(role?: string | null): "steuerung" | "review" | "bearbeiter" {
  if (role === "owner" || role === "manager") return "steuerung";
  if (role === "reviewer") return "review";
  return "bearbeiter";
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

    if (action === "myOpenTasks" || action === "myOverdueTasks" || action === "dueToday" || action === "reviewIssues" || action === "missingEvidence") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: taskRows, error } = roleIds.size
        ? await supabase.from("tasks").select("id,source_number,title,process_step_id,due_date,due_date_override,work_status,review_status,required_documents_text").eq("project_id", projectId).in("responsibility_role_id", Array.from(roleIds))
        : { data: [] as any[], error: null };
      if (error) return NextResponse.json({ error: "Aufgaben konnten nicht geladen werden." }, { status: 500 });
      const stepIds = Array.from(new Set((taskRows || []).map((row: any) => row.process_step_id).filter(Boolean)));
      const { data: stepRows } = stepIds.length ? await supabase.from("process_steps").select("id,code,name").in("id", stepIds) : { data: [] as any[] };
      const stepById = new Map((stepRows || []).map((step: any) => [String(step.id), step]));
      let rows = (taskRows || []).filter((row: any) => row.work_status !== "completed");
      if (action === "myOverdueTasks") rows = rows.filter((row: any) => (row.due_date_override || row.due_date) && (row.due_date_override || row.due_date) < today);
      if (action === "dueToday") rows = rows.filter((row: any) => (row.due_date_override || row.due_date) === today);
      if (action === "reviewIssues") rows = rows.filter((row: any) => row.review_status === "question" || row.review_status === "changes_required");
      if (action === "missingEvidence") rows = rows.filter((row: any) => String(row.required_documents_text || "").trim());
      const titleByAction: Record<string, string> = { myOpenTasks: "Meine offenen Aufgaben", myOverdueTasks: "Meine überfälligen Aufgaben", dueToday: "Heute fällig", reviewIssues: "Rückfragen", missingEvidence: "Aufgaben ohne Nachweis" };
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

    return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Workspace-Daten konnten nicht geladen werden." }, { status: 502 });
  }
}
