import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Assistant = "KAI" | "KIRA";
type HistoryItem = { role?: "user" | "assistant"; content?: string; assistant?: Assistant };
type PageContext = { view?: string; taskId?: string | null; tab?: string | null; processStepId?: string | null; processStepCode?: string | null; processStepName?: string | null; toolCode?: string | null; toolName?: string | null };
type MemoryType = "decision" | "commitment" | "open_point" | "preference" | "escalation" | "result";
type MemoryRow = { id: string; task_id?: string | null; memory_type: MemoryType; title: string; content: string; status: string; updated_at?: string | null };
type MemoryAction = { action?: "add" | "resolve"; id?: string; type?: MemoryType; title?: string; content?: string; taskId?: string | null };

const MEMORY_TYPES = new Set<MemoryType>(["decision", "commitment", "open_point", "preference", "escalation", "result"]);
const MEMORY_START = "<LUMINA_MEMORY>";
const MEMORY_END = "</LUMINA_MEMORY>";

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function boundedJson(value: unknown, maxLength = 42000) {
  const json = JSON.stringify(value, null, 2);
  return json.length <= maxLength ? json : `${json.slice(0, maxLength)}\n… [Kontext gekürzt]`;
}

function cleanHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).map((item): HistoryItem => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    assistant: item?.assistant === "KIRA" ? "KIRA" : "KAI",
    content: String(item?.content || "").trim().slice(0, 1400),
  })).filter((item) => Boolean(item.content));
}

function words(value: string) {
  return new Set(value.toLocaleLowerCase("de-DE").replace(/[^a-zäöüß0-9]+/gi, " ").split(/\s+/).filter((word) => word.length >= 4));
}

function selectRelevantMemories(rows: MemoryRow[], prompt: string, taskId?: string | null) {
  const queryWords = words(prompt);
  return rows.map((memory) => {
    let score = 0;
    if (taskId && memory.task_id === taskId) score += 25;
    if (memory.memory_type === "open_point" || memory.memory_type === "escalation") score += 4;
    const haystack = words(`${memory.title} ${memory.content}`);
    for (const word of queryWords) if (haystack.has(word)) score += 2;
    return { memory, score };
  }).sort((a, b) => b.score - a.score || String(b.memory.updated_at || "").localeCompare(String(a.memory.updated_at || "")))
    .slice(0, 12)
    .map(({ memory }) => memory);
}

function splitMemoryEnvelope(raw: string) {
  const start = raw.lastIndexOf(MEMORY_START);
  const end = raw.lastIndexOf(MEMORY_END);
  if (start < 0 || end < start) return { answer: raw.trim(), actions: [] as MemoryAction[] };
  const answer = raw.slice(0, start).trim();
  const jsonText = raw.slice(start + MEMORY_START.length, end).trim();
  try {
    const parsed = JSON.parse(jsonText);
    return { answer: answer || raw.slice(0, start).trim(), actions: Array.isArray(parsed?.items) ? parsed.items.slice(0, 4) as MemoryAction[] : [] };
  } catch {
    return { answer: raw.slice(0, start).trim() || raw.trim(), actions: [] as MemoryAction[] };
  }
}

function normalizeMemory(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function usageAndCost(payload: any) {
  const usage = payload?.usage || {};
  const inputTokens = Number(usage.input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  const totalTokens = Number(usage.total_tokens || inputTokens + outputTokens);
  const cachedInputTokens = Number(usage?.input_tokens_details?.cached_tokens || 0);
  const normalInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const inputUsdPerM = Number(process.env.LUMINA_AI_INPUT_USD_PER_M || 0.25);
  const cachedInputUsdPerM = Number(process.env.LUMINA_AI_CACHED_INPUT_USD_PER_M || 0.025);
  const outputUsdPerM = Number(process.env.LUMINA_AI_OUTPUT_USD_PER_M || 2.0);
  const usdToEur = Number(process.env.LUMINA_USD_TO_EUR || 0.879);
  const estimatedUsd = (normalInputTokens / 1_000_000) * inputUsdPerM + (cachedInputTokens / 1_000_000) * cachedInputUsdPerM + (outputTokens / 1_000_000) * outputUsdPerM;
  return { inputTokens, cachedInputTokens, outputTokens, totalTokens, estimatedUsd, estimatedEur: estimatedUsd * usdToEur, exchangeRate: usdToEur };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });

  const startedAt = Date.now();
  let body: { assistant?: Assistant; projectId?: string; prompt?: string; history?: HistoryItem[]; mode?: string; pageContext?: PageContext };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 }); }

  const assistant: Assistant = body.assistant === "KIRA" ? "KIRA" : "KAI";
  const projectId = String(body.projectId || "").trim();
  const prompt = String(body.prompt || "").trim();
  const mode = body.mode === "assessment" ? "assessment" : "chat";
  const requestedPageContext: PageContext = {
    view: String(body.pageContext?.view || "").slice(0, 40),
    taskId: body.pageContext?.taskId ? String(body.pageContext.taskId).slice(0, 80) : null,
    tab: body.pageContext?.tab ? String(body.pageContext.tab).slice(0, 40) : null,
    processStepId: body.pageContext?.processStepId ? String(body.pageContext.processStepId).slice(0, 80) : null,
    processStepCode: body.pageContext?.processStepCode ? String(body.pageContext.processStepCode).slice(0, 60) : null,
    processStepName: body.pageContext?.processStepName ? String(body.pageContext.processStepName).slice(0, 200) : null,
    toolCode: body.pageContext?.toolCode ? String(body.pageContext.toolCode).slice(0, 60) : null,
    toolName: body.pageContext?.toolName ? String(body.pageContext.toolName).slice(0, 200) : null,
  };
  if (!projectId || !prompt) return NextResponse.json({ error: "Projekt oder Frage fehlt." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "Die Frage ist zu lang. Bitte auf maximal 4.000 Zeichen kürzen." }, { status: 400 });

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,name,company_id,reporting_date,fiscal_year_start,fiscal_year_end,status")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt." }, { status: 403 });

  const userId = String(claims.sub);
  const [roleAssignmentResult, projectMemberResult, companyResult, rolesResult, stepsResult, taskResult, milestoneResult, dueDatesResult, memoryResult, scheduleMatrixResult] = await Promise.all([
    supabase.from("role_user_assignments").select("role_id").eq("user_id", userId),
    supabase.from("project_members").select("security_role,active").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
    supabase.from("companies").select("id,name,legal_form,registered_office,currency_code").eq("id", project.company_id).maybeSingle(),
    supabase.from("responsibility_roles").select("id,role_key,display_name,first_name,last_name,email").eq("project_id", projectId),
    supabase.from("process_steps").select("id,code,name,parent_id,sort_order").eq("project_id", projectId),
    // Keine zusätzliche Client-Rollenfilterung: Postgres/RLS entscheidet, welche Projektaufgaben dieser Nutzer sehen darf.
    supabase.from("tasks").select("id,process_step_id,responsibility_role_id,source_number,title,category,required_documents_text,expected_format,due_rule_label,due_date,due_date_override,work_status,review_status,internal_comment").eq("project_id", projectId),
    supabase.from("project_milestones").select("id,milestone_key,label,milestone_date,status,notes,source_type,is_key_milestone,sort_order").eq("project_id", projectId).order("milestone_date", { ascending: true }),
    supabase.from("process_step_due_dates").select("id,process_step_id,phase_key,due_rule_label,due_date,due_date_override,sort_order").eq("project_id", projectId).order("sort_order", { ascending: true }),
    supabase.from("kai_kira_memories").select("id,task_id,memory_type,title,content,status,updated_at").eq("project_id", projectId).eq("user_id", userId).eq("status", "active").order("updated_at", { ascending: false }).limit(80),
    supabase.rpc("get_project_schedule_responsibility", { p_project_id: projectId }),
  ]);

  if (taskResult.error) return NextResponse.json({ error: "Der autorisierte Aufgabenkontext konnte nicht geladen werden." }, { status: 500 });

  const roleIds = new Set((roleAssignmentResult.data || []).map((row: any) => String(row.role_id || "")).filter(Boolean));
  const visibleRoles = rolesResult.data || [];
  const ownRoles = visibleRoles.filter((role: any) => roleIds.has(String(role.id)));
  const taskRows = taskResult.data || [];
  const stepRows = stepsResult.data || [];
  const stepById = new Map(stepRows.map((step: any) => [String(step.id), step]));
  const taskIds = taskRows.map((task: any) => String(task.id));
  const roleById = new Map(visibleRoles.map((role: any) => [String(role.id), role]));

  const [documentsResult, messagesResult, eventsResult] = await Promise.all([
    taskIds.length ? supabase.from("documents").select("task_id,display_name,document_status,created_at").in("task_id", taskIds).is("archived_at", null).limit(120) : Promise.resolve({ data: [] as any[] }),
    taskIds.length ? supabase.from("task_messages").select("task_id,subject,body_text,status,created_at").in("task_id", taskIds).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] as any[] }),
    requestedPageContext.taskId ? supabase.from("task_activity_events").select("task_id,event_type,event_data,created_at").eq("task_id", requestedPageContext.taskId).order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] as any[] }),
  ]);

  const docsByTask = new Map<string, number>();
  for (const doc of documentsResult.data || []) docsByTask.set(String(doc.task_id), (docsByTask.get(String(doc.task_id)) || 0) + 1);
  const today = new Date().toISOString().slice(0, 10);
  const normalizedTasks = taskRows.map((task: any) => {
    const dueDate = task.due_date_override || task.due_date || null;
    const step: any = task.process_step_id ? stepById.get(String(task.process_step_id)) : null;
    return {
      id: task.id,
      number: task.source_number,
      title: task.title,
      responsibilityRoleId: task.responsibility_role_id,
      responsibility: task.responsibility_role_id ? (() => {
        const role: any = roleById.get(String(task.responsibility_role_id));
        return role ? { role: role.display_name || role.role_key, roleKey: role.role_key, person: [role.first_name, role.last_name].filter(Boolean).join(" ") || null, email: role.email || null } : null;
      })() : null,
      assignedToCurrentUser: Boolean(task.responsibility_role_id && roleIds.has(String(task.responsibility_role_id))),
      processStep: step ? `${step.code} · ${step.name}` : null,
      processStepCode: step?.code || null,
      dueRule: task.due_rule_label,
      dueDate,
      overdue: Boolean(dueDate && dueDate < today && task.work_status !== "completed"),
      workStatus: task.work_status,
      reviewStatus: task.review_status,
      requiredDocuments: task.required_documents_text,
      expectedFormat: task.expected_format,
      documentCount: docsByTask.get(String(task.id)) || 0,
      internalComment: task.internal_comment,
    };
  }).sort((a: any, b: any) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")));

  const currentTask = requestedPageContext.taskId ? normalizedTasks.find((task: any) => String(task.id) === String(requestedPageContext.taskId)) || null : null;
  const personalTasks = normalizedTasks.filter((task: any) => task.assignedToCurrentUser);
  const openPersonalTasks = personalTasks.filter((task: any) => task.workStatus !== "completed");
  const openAccessibleTasks = normalizedTasks.filter((task: any) => task.workStatus !== "completed");
  const reviewIssues = openPersonalTasks.filter((task: any) => task.reviewStatus === "question" || task.reviewStatus === "changes_required");
  const overdue = openPersonalTasks.filter((task: any) => task.overdue);
  const missingEvidence = openPersonalTasks.filter((task: any) => String(task.requiredDocuments || "").trim() && task.documentCount === 0);
  const tabLabels: Record<string, string> = { details: "Anleitung", previous: "Vorjahr", room: "Arbeitsbereich", notes: "Notizen", email: "E-Mail", communication: "Kommunikation", review: "Prüfung" };
  const currentTaskMessages = currentTask ? (messagesResult.data || []).filter((message: any) => String(message.task_id) === String(currentTask.id)).slice(0, 8) : [];
  const currentTaskDocuments = currentTask ? (documentsResult.data || []).filter((document: any) => String(document.task_id) === String(currentTask.id)).slice(0, 12) : [];

  const explicitMilestones = milestoneResult.error ? [] : (milestoneResult.data || []);
  const scheduledDates = (dueDatesResult.error ? [] : dueDatesResult.data || []).map((row: any) => {
    const step: any = stepById.get(String(row.process_step_id));
    return {
      phase: row.phase_key,
      label: row.due_rule_label,
      date: row.due_date_override || row.due_date,
      processStep: step ? `${step.code} · ${step.name}` : null,
    };
  }).filter((row: any) => row.date || row.label).slice(0, 80);

  // V9-Abnahme Priorität 2: ein RPC-Fehler darf dem Modell nicht als "keine Termine vorhanden"
  // erscheinen, sondern muss ausdrücklich als "Datenquelle nicht verfügbar" erkennbar bleiben.
  const scheduleMatrixAvailable = !scheduleMatrixResult.error;
  const scheduleRows = scheduleMatrixAvailable ? (scheduleMatrixResult.data || []) : [];
  const scheduleResponsibilityMatrix = scheduleRows.map((row: any) => [
    row.schedule_type, row.due_date, row.process_step_code, row.label, row.responsibility_role, row.responsible_person, row.responsible_email, row.status, row.source,
  ]);

  const activeMemories: MemoryRow[] = memoryResult.error ? [] : (memoryResult.data || []) as MemoryRow[];
  const relevantMemories = selectRelevantMemories(activeMemories, prompt, currentTask?.id || null);

  const userMetadata = (claims.user_metadata || {}) as Record<string, unknown>;
  const displayName = String(userMetadata.display_name || "").trim()
    || [userMetadata.first_name, userMetadata.last_name].map((v) => String(v || "").trim()).filter(Boolean).join(" ")
    || String(claims.email || "").split("@")[0]
    || "LUMINA Nutzer";

  const serverContext = {
    contextPolicy: {
      sourcePriority: ["1_LUMINA_PROJECT_FACTS", "2_PERSISTENT_MEMORY", "3_GENERAL_EXPERT_KNOWLEDGE", "4_AI_RECOMMENDATION"],
      rule: "Projektfakten niemals aus Erinnerungen oder Empfehlungen ableiten. Wenn eine konkrete App-Information nicht vorliegt, ausdrücklich sagen, dass sie in den verfügbaren LUMINA-Daten nicht gefunden wurde.",
    },
    asOf: today,
    user: {
      displayName,
      email: String(claims.email || ""),
      projectSecurityRole: projectMemberResult.data?.active === false ? "inactive" : projectMemberResult.data?.security_role || null,
      responsibilityRoles: ownRoles.map((role: any) => ({ key: role.role_key, name: role.display_name })),
    },
    company: companyResult.data || null,
    project,
    currentPage: {
      view: requestedPageContext.view || "unknown",
      tab: requestedPageContext.tab ? (tabLabels[requestedPageContext.tab] || requestedPageContext.tab) : null,
      processStep: requestedPageContext.processStepCode || requestedPageContext.processStepName ? { code: requestedPageContext.processStepCode, name: requestedPageContext.processStepName } : null,
      currentTask,
      tool: requestedPageContext.toolCode ? { code: requestedPageContext.toolCode, name: requestedPageContext.toolName || requestedPageContext.processStepName || null } : null,
      currentTaskDocuments: currentTaskDocuments.map((document: any) => ({ displayName: document.display_name, status: document.document_status, createdAt: document.created_at })),
      currentTaskMessages: currentTaskMessages.map((message: any) => ({ subject: message.subject, body: String(message.body_text || "").slice(0, 500), status: message.status, createdAt: message.created_at })),
      currentTaskActivity: currentTask ? (eventsResult.data || []).map((event: any) => ({ type: event.event_type, data: event.event_data, createdAt: event.created_at })) : [],
      note: requestedPageContext.taskId && !currentTask ? "Die angeforderte Aufgabe ist im autorisierten Kontext nicht sichtbar und wurde deshalb nicht an die KI übergeben." : null,
    },
    projectControl: {
      // Die vollständigen Zeilen der Termin-/Verantwortlichkeitsmatrix werden bewusst NICHT hier
      // eingebettet: dieser gesamte serverContext unterliegt weiter unten boundedJson() und könnte
      // bei großen Projekten mitten in den Daten gekappt werden. Die Matrix wird stattdessen separat
      // und ungekürzt vor diesem Kontextblock in den Prompt aufgenommen (siehe scheduleMatrixBlock).
      scheduleResponsibilityMatrixMeta: {
        columns: ["type","date","processStep","label","role","person","email","status","source"],
        rowCount: scheduleResponsibilityMatrix.length,
        available: scheduleMatrixAvailable,
      },
      explicitMilestones: explicitMilestones.map((row: any) => ({ label: row.label, date: row.milestone_date, status: row.status, notes: row.notes, source: row.source_type, key: Boolean(row.is_key_milestone) })),
      visibleResponsibilities: visibleRoles.map((role: any) => ({ key: role.role_key, name: role.display_name, contact: [role.first_name, role.last_name].filter(Boolean).join(" ") || null, email: role.email || null, assignedToCurrentUser: roleIds.has(String(role.id)) })),
      accessibleTasks: normalizedTasks.length,
      openAccessibleTasks: openAccessibleTasks.length,
    },
    personalSituation: {
      assignedTasks: personalTasks.length,
      openTasks: openPersonalTasks.length,
      overdueTasks: overdue.length,
      reviewIssues: reviewIssues.length,
      tasksWithoutRequiredEvidence: missingEvidence.length,
      priorityTasks: openPersonalTasks.slice(0, 25),
    },
    recentMessages: (messagesResult.data || []).slice(0, 14).map((message: any) => ({ taskId: message.task_id, subject: message.subject, body: String(message.body_text || "").slice(0, 500), status: message.status, createdAt: message.created_at })),
    persistentMemory: relevantMemories.map((memory) => ({ id: memory.id, type: memory.memory_type, title: memory.title, content: memory.content, taskId: memory.task_id, updatedAt: memory.updated_at })),
  };

  // V9-Abnahme Priorität 2: die projektweite Termin-/Verantwortlichkeitsmatrix hat bei der
  // Kontextübertragung Vorrang vor allen anderen Kontextteilen und wird deshalb außerhalb von
  // boundedJson(serverContext) übertragen. Sie erhält ein eigenes, großzügiges Limit (statt des
  // 42.000-Zeichen-Budgets für den restlichen Kontext), damit sie bei jeder in der Praxis
  // vorkommenden Projektgröße vollständig ankommt; nur ein tatsächlich pathologischer Datenstand
  // würde dieses Limit überhaupt erreichen, und selbst dann bleibt die Kürzung für das Modell
  // sichtbar markiert statt mitten in validem JSON abzureißen. Ein RPC-Fehler wird nicht als leere
  // Matrix (= "keine Termine") dargestellt, sondern ausdrücklich als nicht verfügbare Datenquelle.
  const scheduleMatrixBlock = scheduleMatrixAvailable
    ? `Vollständige projektweite Termin-/Verantwortlichkeitsmatrix (Vorrang vor allen anderen Kontextteilen, nicht durch das allgemeine Kontextlimit gekürzt; Spalten: type,date,processStep,label,role,person,email,status,source):\n${boundedJson(scheduleResponsibilityMatrix, 120000)}`
    : `PROJEKTWEITE TERMIN-/VERANTWORTLICHKEITSMATRIX IST AKTUELL NICHT VERFÜGBAR (Fehler beim serverseitigen Laden der Datenquelle). Behandle dies ausdrücklich als "Datenquelle derzeit nicht verfügbar" und NICHT als "keine Termine vorhanden". Erfinde und errate in diesem Fall keine Termine oder Zuständigkeiten als Ersatz; sage dem Nutzer, dass die Matrix gerade nicht geladen werden konnte.`;

  const history = cleanHistory(body.history);
  const historyText = history.length
    ? `\n\nBisheriger Dialog (nur Kurzzeitgedächtnis, nicht automatisch Projektfakt):\n${history.map((item) => `${item.role === "assistant" ? item.assistant : "NUTZER"}: ${item.content}`).join("\n")}`
    : "";

  const persona = assistant === "KIRA"
    ? `Du bist KIRA, die kritische KI-Reviewpartnerin in LUMINA. Du sparrst mit einem erfahrenen Finance-Anwender auf professionellem Niveau. Prüfe Vollständigkeit, Nachweise, Plausibilität, Abschlussrisiken, Review-Stau und Widersprüche. Sei klar und knapp. Allgemeines HGB-/Abschlusswissen ist erlaubt, aber Projektfakten, Erinnerungen, Fachwissen und Empfehlungen müssen sauber getrennt bleiben. Du änderst niemals Daten, Status oder Freigaben.`
    : `Du bist KAI, der operative KI-Sparringspartner in LUMINA. Du arbeitest mit einem erfahrenen Finance-Anwender auf Augenhöhe. Nutze aktuelle LUMINA-Fakten, Rollen, Aufgaben, Termine, Meilensteine, Zuständigkeiten, Nachweise, Kommunikation und passende gespeicherte Erinnerungen. Wenn Hauptbuchhaltung erkennbar ist, antworte wie ein erfahrener Hauptbuch-Sparringspartner und nicht wie ein Lehrbuch. Du änderst niemals Daten, Status oder Freigaben.`;

  const factRule = `WICHTIGE QUELLENREGEL: Wenn der Nutzer nach Terminen, Status, Meilensteinen, Projektplan oder Zuständigkeiten fragt, nutze zuerst die vollständige, weiter unten separat und ungekürzt bereitgestellte Termin-/Verantwortlichkeitsmatrix. KAI/KIRA sollen alle im autorisierten Projektkontext vorhandenen Task-Termine, Prozess-Termine und Meilensteine kennen und die jeweils hinterlegte Rolle/Person nennen. Wenn für einen Termin keine Zuständigkeit hinterlegt ist, sage ausdrücklich "keine Zuständigkeit in LUMINA hinterlegt". Wenn die Matrix ausdrücklich als nicht verfügbar markiert ist, sage das dem Nutzer klar und weiche nicht auf Vermutungen aus. Nicht raten. Eigene Termine oder Maßnahmen erst danach klar als Empfehlung/Vorschlag kennzeichnen.`;
  const outputRule = mode === "assessment"
    ? `Dies ist die automatische Tagesbeurteilung. Antworte in höchstens 5 kurzen Punkten. Beginne direkt mit der wichtigsten Beobachtung. Nenne 2–3 konkrete Prioritäten und höchstens ein wesentliches Risiko. Keine Einleitung und keine Floskeln.`
    : `Antworte auf Deutsch, konkret und standardmäßig kurz (meist 3–7 Punkte oder wenige Absätze). Wenn mehr Details sinnvoll wären, biete am Ende knapp "Mehr Details" an. Erfinde keine Projektfakten.`;
  const memoryRule = `DAUERHAFTES ARBEITSGEDÄCHTNIS: Am Ende deiner Antwort MUSST du genau eine maschinenlesbare Zeile ergänzen: ${MEMORY_START}{"items":[]}${MEMORY_END}. Sie wird dem Nutzer nicht angezeigt. Maximal 3 Items. Erlaubte Typen: decision, commitment, open_point, preference, escalation, result. Speichere nur tatsächlich neue, projektbezogene Entscheidungen, Zusagen, offene Punkte, Arbeitspräferenzen, Eskalationen oder Ergebnisse. Speichere niemals bloße Höflichkeit, allgemeines Fachwissen oder deine eigene Empfehlung, solange der Nutzer sie nicht übernommen/bestätigt hat. Für neue Einträge: {"action":"add","type":"commitment","title":"kurzer Titel","content":"präziser Fakt","taskId":"optional aktuelle Task-ID"}. Wenn eine bestehende Erinnerung eindeutig erledigt wurde, darfst du {"action":"resolve","id":"ID aus persistentMemory"} ausgeben.`;

  const input = `${persona}\n\n${factRule}\n\n${scheduleMatrixBlock}\n\nWeiterer serverseitig autorisierter LUMINA-Kontext:\n${boundedJson(serverContext)}${historyText}\n\nAktuelle Frage/Auftrag:\n${prompt}\n\n${outputRule}\n\n${memoryRule}`;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "KI-Konfiguration fehlt: OPENAI_API_KEY ist auf dem Server nicht gesetzt." }, { status: 503 });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.LUMINA_AI_MODEL || "gpt-5-mini", input }),
      signal: controller.signal,
    });
    const payload = await aiResponse.json();
    if (!aiResponse.ok) return NextResponse.json({ error: payload?.error?.message || "KI-Dienst nicht erreichbar." }, { status: 502 });
    const rawResponse = extractOutputText(payload);
    if (!rawResponse) return NextResponse.json({ error: "Der KI-Dienst hat keine Textantwort geliefert." }, { status: 502 });

    const { answer, actions } = splitMemoryEnvelope(rawResponse);
    let added = 0;
    let resolved = 0;
    const validMemoryIds = new Set(activeMemories.map((memory) => memory.id));
    for (const action of actions) {
      if (action.action === "resolve" && action.id && validMemoryIds.has(String(action.id))) {
        const { error } = await supabase.from("kai_kira_memories").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", String(action.id)).eq("user_id", userId);
        if (!error) resolved += 1;
        continue;
      }
      if (action.action !== "add" || !action.type || !MEMORY_TYPES.has(action.type)) continue;
      const title = normalizeMemory(String(action.title || ""), 180);
      const content = normalizeMemory(String(action.content || ""), 1200);
      const taskId = action.taskId && taskIds.includes(String(action.taskId)) ? String(action.taskId) : null;
      if (!title || !content) continue;
      const duplicate = activeMemories.find((memory) => memory.memory_type === action.type && String(memory.task_id || "") === String(taskId || "") && normalizeMemory(memory.content, 1200).toLocaleLowerCase("de-DE") === content.toLocaleLowerCase("de-DE"));
      if (duplicate) {
        await supabase.from("kai_kira_memories").update({ updated_at: new Date().toISOString() }).eq("id", duplicate.id).eq("user_id", userId);
        continue;
      }
      const { error } = await supabase.from("kai_kira_memories").insert({ project_id: projectId, user_id: userId, task_id: taskId, memory_type: action.type, title, content, status: "active", source_type: "kai_kira_chat", source_excerpt: normalizeMemory(prompt, 600) });
      if (!error) added += 1;
    }
    if (relevantMemories.length) {
      await supabase.from("kai_kira_memories").update({ last_used_at: new Date().toISOString() }).in("id", relevantMemories.map((memory) => memory.id)).eq("user_id", userId);
    }

    const usage = usageAndCost(payload);
    return NextResponse.json({
      response: answer,
      model: payload?.model || process.env.LUMINA_AI_MODEL || "gpt-5-mini",
      durationMs: Date.now() - startedAt,
      usage,
      context: {
        roles: serverContext.user.responsibilityRoles,
        situation: serverContext.personalSituation,
        currentPage: serverContext.currentPage,
        milestones: explicitMilestones.length,
        scheduledDates: scheduleResponsibilityMatrix.length,
      },
      memory: { active: Math.max(0, activeMemories.length + added - resolved), used: relevantMemories.length, added, resolved, persistent: !memoryResult.error },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return NextResponse.json({ error: "Die KI-Anfrage hat das Zeitlimit überschritten. Bitte erneut versuchen." }, { status: 504 });
    return NextResponse.json({ error: "KI-Dienst nicht erreichbar." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
