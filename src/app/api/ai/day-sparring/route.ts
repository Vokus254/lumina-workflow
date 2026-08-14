import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Assistant = "KAI" | "KIRA";
type HistoryItem = { role?: "user" | "assistant"; content?: string; assistant?: Assistant };

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
  return json.length <= maxLength ? json : `${json.slice(0, maxLength)}\nâ€¦ [Kontext gekÃ¼rzt]`;
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

  let body: { assistant?: Assistant; projectId?: string; prompt?: string; history?: HistoryItem[]; mode?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "UngÃ¼ltige Anfrage." }, { status: 400 }); }

  const assistant: Assistant = body.assistant === "KIRA" ? "KIRA" : "KAI";
  const projectId = String(body.projectId || "").trim();
  const prompt = String(body.prompt || "").trim();
  const mode = body.mode === "assessment" ? "assessment" : "chat";
  if (!projectId || !prompt) return NextResponse.json({ error: "Projekt oder Frage fehlt." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "Die Frage ist zu lang. Bitte auf maximal 4.000 Zeichen kÃ¼rzen." }, { status: 400 });

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
  if (taskError) return NextResponse.json({ error: "Der persÃ¶nliche Aufgabenkontext konnte nicht geladen werden." }, { status: 500 });

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
      processStep: step ? `${step.code} Â· ${step.name}` : null,
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
    ? `\n\nBisheriger Dialog (nur als GesprÃ¤chskontext):\n${history.map((item) => `${item.role === "assistant" ? item.assistant : "NUTZER"}: ${item.content}`).join("\n")}`
    : "";

  const persona = assistant === "KIRA"
    ? `Du bist KIRA, die kritische KI-Reviewpartnerin in LUMINA. Du sparrst mit einem erfahrenen Finance-Anwender auf professionellem Niveau. PrÃ¼fe die aktuelle Arbeitssituation auf VollstÃ¤ndigkeit, Nachweise, PlausibilitÃ¤t, Abschlussrisiken, Review-Stau und WidersprÃ¼che. Sei klar und knapp. Du darfst allgemeines HGB-/Abschlusswissen ergÃ¤nzen, musst aber Projektfakten strikt vom allgemeinen Fachhinweis trennen. Du Ã¤nderst niemals Daten, Status oder Freigaben und behauptest keine rechtsverbindliche PrÃ¼fung.`
    : `Du bist KAI, der operative KI-Sparringspartner in LUMINA. Du arbeitest mit einem erfahrenen Finance-Anwender auf AugenhÃ¶he. Nutze seine tatsÃ¤chlichen Responsibility-Rollen und seine persÃ¶nlichen Aufgaben, Fristen, RÃ¼ckfragen, Dokumentlage und Nachrichten, um konkrete PrioritÃ¤ten und nÃ¤chste Schritte vorzuschlagen. Wenn die Rolle Hauptbuchhalter/Hauptbuchhaltung erkennbar ist, antworte wie ein erfahrener Sparringspartner fÃ¼r das Hauptbuch und nicht wie ein Lehrbuch. Du darfst allgemeines HGB-/Abschlusswissen ergÃ¤nzen, musst aber Projektfakten strikt vom allgemeinen Fachhinweis trennen. Du Ã¤nderst niemals Daten, Status oder Freigaben.`;

  const outputRule = mode === "assessment"
    ? `Dies ist die automatische Tagesbeurteilung. Antworte in hÃ¶chstens 5 kurzen Punkten. Beginne direkt mit der wichtigsten Beobachtung. Nenne 2â€“3 konkrete PrioritÃ¤ten und hÃ¶chstens ein wesentliches Risiko. Keine Einleitung und keine Floskeln.`
    : `Antworte auf Deutsch, konkret und praxisnah. Beziehe die Antwort sichtbar auf Rolle, Projekt und aktuelle Aufgaben, sofern relevant. Bei einer einfachen Frage kurz antworten; bei komplexen Fragen strukturiert. Erfinde keine Projektfakten.`;

  const input = `${persona}\n\nServerseitig autorisierter persÃ¶nlicher LUMINA-Kontext:\n${boundedJson(serverContext)}${historyText}\n\nAktuelle Frage/Auftrag:\n${prompt}\n\n${outputRule}`;
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
    return NextResponse.json({ response, model: payload?.model || process.env.LUMINA_AI_MODEL || "gpt-5-mini", context: { roles: serverContext.user.responsibilityRoles, situation: serverContext.situation } });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return NextResponse.json({ error: "Die KI-Anfrage hat das Zeitlimit Ã¼berschritten. Bitte erneut versuchen." }, { status: 504 });
    return NextResponse.json({ error: "KI-Dienst nicht erreichbar." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

