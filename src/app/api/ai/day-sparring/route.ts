import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Assistant = "KAI" | "KIRA";
type HistoryItem = { role?: "user" | "assistant"; content?: string; assistant?: Assistant };
type PageContext = { view?: string; taskId?: string | null; tab?: string | null; processStepId?: string | null; processStepCode?: string | null; processStepName?: string | null };

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

function boundedJson(value: unknown, maxLength = 15000) {
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
  const [{ data: roleAssignments }, { data: projectMember }] = await Promise.all([
    supabase.from("role_user_assignments").select("role_id").eq("user_id", userId),
    supabase.from("project_members").select("security_role,active").eq("project_id", projectId).eq("user_id", userId).maybeSingle(),
  ]);
  const roleIds = [...new Set((roleAssignments || []).map((row: any) => String(row.role_id || "")).filter(Boolean))];

  const { data: roles } = roleIds.length
    ? await supabase.from("responsibility_roles").select("id,role_key,display_name").eq("project_id", projectId).in("id", roleIds)
    : { data: [] as any[] };
  const projectRoleIds = new Set((roles || []).map((role: any) => String(role.id)));

  let taskQuery = supabase.from("tasks")
    .select("id,process_step_id,responsibility_role_id,source_number,title,category,required_documents_text,expected_format,due_rule_label,due_date,due_date_override,work_status,review_status,internal_comment")
    .eq("project_id", projectId);
  if (projectRoleIds.size) taskQuery = taskQuery.in("responsibility_role_id", [...projectRoleIds]);
  else taskQuery = taskQuery.eq("responsibility_role_id", "00000000-0000-0000-0000-000000000000");
  const { data: tasks, error: taskError } = await taskQuery;
  if (taskError) return NextResponse.json({ error: "Der persönliche Aufgabenkontext konnte nicht geladen werden." }, { status: 500 });

  const taskRows = tasks || [];
  const taskIds = taskRows.map((task: any) => String(task.id));
  const stepIds = [...new Set(taskRows.map((task: any) => String(task.process_step_id || "")).filter(Boolean))];
  const [{ data: steps }, documentsResult, messagesResult] = await Promise.all([
    stepIds.length
      ? supabase.from("process_steps").select("id,code,name,parent_id").eq("project_id", projectId).in("id", stepIds)
      : Promise.resolve({ data: [] as any[] }),
    taskIds.length
      ? supabase.from("documents").select("task_id,display_name,document_status,created_at").in("task_id", taskIds).is("archived_at", null).limit(80)
      : Promise.resolve({ data: [] as any[] }),
    taskIds.length
      ? supabase.from("task_messages").select("task_id,subject,body_text,status,created_at").in("task_id", taskIds).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const stepById = new Map((steps || []).map((step: any) => [String(step.id), step]));
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
      processStep: step ? `${step.code} · ${step.name}` : null,
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

  const openTasks = normalizedTasks.filter((task: any) => task.workStatus !== "completed");
  const currentTask = requestedPageContext.taskId
    ? normalizedTasks.find((task: any) => String(task.id) === String(requestedPageContext.taskId)) || null
    : null;
  const tabLabels: Record<string, string> = { details: "Anleitung", previous: "Vorjahr", room: "Arbeitsbereich", notes: "Notizen", email: "E-Mail", communication: "Kommunikation", review: "Prüfung" };
  const currentTaskMessages = currentTask ? (messagesResult.data || []).filter((message: any) => String(message.task_id) === String(currentTask.id)).slice(0, 8) : [];
  const currentTaskDocuments = currentTask ? (documentsResult.data || []).filter((document: any) => String(document.task_id) === String(currentTask.id)).slice(0, 12) : [];
  const reviewIssues = openTasks.filter((task: any) => task.reviewStatus === "question" || task.reviewStatus === "changes_required");
  const overdue = openTasks.filter((task: any) => task.overdue);
  const missingEvidence = openTasks.filter((task: any) => String(task.requiredDocuments || "").trim() && task.documentCount === 0);
  const userMetadata = (claims.user_metadata || {}) as Record<string, unknown>;
  const displayName = String(userMetadata.display_name || "").trim()
    || [userMetadata.first_name, userMetadata.last_name].map((v) => String(v || "").trim()).filter(Boolean).join(" ")
    || String(claims.email || "").split("@")[0]
    || "LUMINA Nutzer";

  const serverContext = {
    asOf: today,
    user: {
      displayName,
      email: String(claims.email || ""),
      projectSecurityRole: projectMember?.active === false ? "inactive" : projectMember?.security_role || null,
      responsibilityRoles: (roles || []).map((role: any) => ({ key: role.role_key, name: role.display_name })),
    },
    project,
    currentPage: {
      view: requestedPageContext.view || "unknown",
      tab: requestedPageContext.tab ? (tabLabels[requestedPageContext.tab] || requestedPageContext.tab) : null,
      processStep: requestedPageContext.processStepCode || requestedPageContext.processStepName ? { code: requestedPageContext.processStepCode, name: requestedPageContext.processStepName } : null,
      currentTask,
      currentTaskDocuments: currentTaskDocuments.map((document: any) => ({ displayName: document.display_name, status: document.document_status, createdAt: document.created_at })),
      currentTaskMessages: currentTaskMessages.map((message: any) => ({ subject: message.subject, body: String(message.body_text || "").slice(0, 500), status: message.status, createdAt: message.created_at })),
      note: requestedPageContext.taskId && !currentTask ? "Die angeforderte Aufgabe ist im autorisierten persönlichen Kontext nicht sichtbar und wurde deshalb nicht an die KI übergeben." : null,
    },
    situation: {
      assignedTasks: normalizedTasks.length,
      openTasks: openTasks.length,
      overdueTasks: overdue.length,
      reviewIssues: reviewIssues.length,
      tasksWithoutRequiredEvidence: missingEvidence.length,
    },
    priorityTasks: openTasks.slice(0, 25),
    recentMessages: (messagesResult.data || []).slice(0, 12).map((message: any) => ({
      taskId: message.task_id,
      subject: message.subject,
      body: String(message.body_text || "").slice(0, 500),
      status: message.status,
      createdAt: message.created_at,
    })),
  };

  const history = cleanHistory(body.history);
  const historyText = history.length
    ? `\n\nBisheriger Dialog (nur als Gesprächskontext):\n${history.map((item) => `${item.role === "assistant" ? item.assistant : "NUTZER"}: ${item.content}`).join("\n")}`
    : "";

  const persona = assistant === "KIRA"
    ? `Du bist KIRA, die kritische KI-Reviewpartnerin in LUMINA. Du sparrst mit einem erfahrenen Finance-Anwender auf professionellem Niveau. Prüfe die aktuelle Arbeitssituation auf Vollständigkeit, Nachweise, Plausibilität, Abschlussrisiken, Review-Stau und Widersprüche. Sei klar und knapp. Du darfst allgemeines HGB-/Abschlusswissen ergänzen, musst aber Projektfakten strikt vom allgemeinen Fachhinweis trennen. Du änderst niemals Daten, Status oder Freigaben und behauptest keine rechtsverbindliche Prüfung.`
    : `Du bist KAI, der operative KI-Sparringspartner in LUMINA. Du arbeitest mit einem erfahrenen Finance-Anwender auf Augenhöhe. Nutze seine tatsächlichen Responsibility-Rollen und seine persönlichen Aufgaben, Fristen, Rückfragen, Dokumentlage und Nachrichten, um konkrete Prioritäten und nächste Schritte vorzuschlagen. Wenn die Rolle Hauptbuchhalter/Hauptbuchhaltung erkennbar ist, antworte wie ein erfahrener Sparringspartner für das Hauptbuch und nicht wie ein Lehrbuch. Du darfst allgemeines HGB-/Abschlusswissen ergänzen, musst aber Projektfakten strikt vom allgemeinen Fachhinweis trennen. Du änderst niemals Daten, Status oder Freigaben.`;

  const outputRule = mode === "assessment"
    ? `Dies ist die automatische Tagesbeurteilung. Antworte in höchstens 5 kurzen Punkten. Beginne direkt mit der wichtigsten Beobachtung. Nenne 2–3 konkrete Prioritäten und höchstens ein wesentliches Risiko. Keine Einleitung und keine Floskeln.`
    : `Antworte auf Deutsch, konkret und praxisnah. Beziehe die Antwort sichtbar auf Rolle, Projekt und aktuelle Aufgaben, sofern relevant. Bei einer einfachen Frage kurz antworten; bei komplexen Fragen strukturiert. Erfinde keine Projektfakten.`;
  const contextRule = currentTask
    ? `WICHTIG: Der Nutzer befindet sich gerade in der Aufgabe ${currentTask.number || ""} ${currentTask.title || ""} im Reiter ${requestedPageContext.tab ? (tabLabels[requestedPageContext.tab] || requestedPageContext.tab) : "Aufgabe"}. Beziehe die Antwort primär auf genau diesen aktuellen Arbeitskontext. Nutze nur die serverseitig bestätigten Daten zu Aufgabe, Dokumenten und Nachrichten.`
    : `WICHTIG: Beziehe dich primär auf den aktuell geöffneten LUMINA-Bereich ${requestedPageContext.view || "Projekt"}${requestedPageContext.processStepCode ? ` / Prozessschritt ${requestedPageContext.processStepCode}` : ""}.`;

  const input = `${persona}\n\nServerseitig autorisierter persönlicher LUMINA-Kontext:\n${boundedJson(serverContext)}${historyText}\n\nAktuelle Frage/Auftrag:\n${prompt}\n\n${outputRule}`;
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
    const response = extractOutputText(payload);
    if (!response) return NextResponse.json({ error: "Der KI-Dienst hat keine Textantwort geliefert." }, { status: 502 });
    const model = String(payload?.model || process.env.LUMINA_AI_MODEL || "gpt-5-mini");
    const inputTokens = Number(payload?.usage?.input_tokens || 0);
    const outputTokens = Number(payload?.usage?.output_tokens || 0);
    const totalTokens = Number(payload?.usage?.total_tokens || inputTokens + outputTokens);
    const cachedInputTokens = Number(payload?.usage?.input_tokens_details?.cached_tokens || 0);
    const defaultMiniPricing = model === "gpt-5-mini" || model.startsWith("gpt-5-mini-");
    const inputUsdPerM = Number(process.env.LUMINA_AI_INPUT_USD_PER_M || (defaultMiniPricing ? "0.25" : "NaN"));
    const cachedInputUsdPerM = Number(process.env.LUMINA_AI_CACHED_INPUT_USD_PER_M || (defaultMiniPricing ? "0.025" : "NaN"));
    const outputUsdPerM = Number(process.env.LUMINA_AI_OUTPUT_USD_PER_M || (defaultMiniPricing ? "2.00" : "NaN"));
    const usdToEur = Number(process.env.LUMINA_USD_TO_EUR || "0.879");
    const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    const estimatedUsd = [inputUsdPerM, cachedInputUsdPerM, outputUsdPerM, usdToEur].every(Number.isFinite)
      ? (uncachedInputTokens * inputUsdPerM + cachedInputTokens * cachedInputUsdPerM + outputTokens * outputUsdPerM) / 1_000_000
      : null;
    const estimatedEur = estimatedUsd === null ? null : estimatedUsd * usdToEur;
    return NextResponse.json({
      response,
      model,
      elapsedMs: Date.now() - startedAt,
      usage: { inputTokens, cachedInputTokens, outputTokens, totalTokens, estimatedEur, exchangeRate: Number.isFinite(usdToEur) ? usdToEur : null },
      context: { roles: serverContext.user.responsibilityRoles, situation: serverContext.situation, currentPage: serverContext.currentPage },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return NextResponse.json({ error: "Die KI-Anfrage hat das Zeitlimit überschritten. Bitte erneut versuchen." }, { status: 504 });
    return NextResponse.json({ error: "KI-Dienst nicht erreichbar." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
