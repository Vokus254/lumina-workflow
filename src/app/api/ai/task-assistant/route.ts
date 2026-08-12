import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Assistant = "KAI" | "KIRA";

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output || []) for (const content of item?.content || []) if (content?.type === "output_text" && typeof content.text === "string") parts.push(content.text);
  return parts.join("\n").trim();
}

function boundedJson(value: unknown, maxLength = 8000) {
  const json = JSON.stringify(value, null, 2);
  return json.length <= maxLength ? json : `${json.slice(0, maxLength)}\n… [Kontext gekürzt]`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });

  let body: { assistant?: Assistant; taskId?: string; prompt?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 }); }

  const assistant: Assistant = body.assistant === "KIRA" ? "KIRA" : "KAI";
  const taskId = String(body.taskId || "").trim();
  const prompt = String(body.prompt || "").trim();
  if (!taskId || !prompt) return NextResponse.json({ error: "Aufgabe oder Frage fehlt." }, { status: 400 });
  if (prompt.length > 4000) return NextResponse.json({ error: "Die Frage ist zu lang. Bitte auf maximal 4.000 Zeichen kürzen." }, { status: 400 });

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,project_id,process_step_id,responsibility_role_id,source_number,title,category,required_documents_text,expected_format,company_scope_text,due_rule_label,due_date,due_date_override,internal_comment,work_status,review_status")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError || !task) return NextResponse.json({ error: "Kein Zugriff auf diese Aufgabe." }, { status: 403 });

  const [projectResult, roleResult, guidanceResult, workGuideResult, documentsResult] = await Promise.all([
    supabase.from("projects").select("id,name,reporting_date").eq("id", task.project_id).maybeSingle(),
    task.responsibility_role_id
      ? supabase.from("responsibility_roles").select("role_key,display_name").eq("id", task.responsibility_role_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    task.process_step_id
      ? supabase.from("process_step_guidance").select("ziel,was_ist_zu_tun,benoetigte_unterlagen,liefergegenstand,typische_fehler,erledigt_wenn,zustaendige_rolle,rechtsgrundlage,arbeitshilfe_name,datenbasis_hinweis").eq("process_step_id", task.process_step_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("task_work_guides").select("objective,rationale,expected_result,completion_note,common_errors").eq("task_id", taskId).maybeSingle(),
    supabase.from("documents").select("id,display_name,document_status").eq("task_id", taskId).is("archived_at", null).limit(20),
  ]);

  const serverContext = {
    task: {
      id: task.id, number: task.source_number, title: task.title, category: task.category,
      requiredDocuments: task.required_documents_text, expectedFormat: task.expected_format, companyScope: task.company_scope_text,
      dueRule: task.due_rule_label, dueDate: task.due_date_override || task.due_date, internalComment: task.internal_comment,
      workStatus: task.work_status, reviewStatus: task.review_status,
    },
    project: projectResult.data || null,
    responsibilityRole: roleResult.data || null,
    guidance: guidanceResult.data || null,
    workGuide: workGuideResult.data || null,
    documents: documentsResult.data || [],
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "KI-Konfiguration fehlt: OPENAI_API_KEY ist auf dem Server nicht gesetzt." }, { status: 503 });

  const role = assistant === "KIRA"
    ? "Du bist KIRA, die KI-Wirtschaftsprüferin in LUMINA. Prüfe kritisch auf Vollständigkeit, Plausibilität, Nachweise, Risiken und Widersprüche. Gib nur fachliche Hinweise und Empfehlungen. Ändere niemals Status, Freigaben, Daten oder Workflow-Gates und behaupte nie, eine Prüfung rechtsverbindlich abgeschlossen zu haben."
    : "Du bist KAI, der KI-Bilanzbuchhalter in LUMINA. Führe den Anwender konkret durch die Abschlussaufgabe, erkläre Vorgehen, benötigte Unterlagen, typische Fehler und nächste Arbeitsschritte. Gib nur fachliche Hilfestellung. Ändere niemals Status, Freigaben, Daten oder Workflow-Gates.";
  const input = `${role}\n\nAufgabenkontext aus LUMINA (serverseitig autorisiert):\n${boundedJson(serverContext)}\n\nFrage/Auftrag:\n${prompt}\n\nAntworte auf Deutsch, konkret, strukturiert und ausschließlich auf Basis des vorhandenen Kontexts. Fehlende Nachweise als fehlend kennzeichnen; nichts erfinden.`;

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
    const text = extractOutputText(payload);
    if (!text) return NextResponse.json({ error: "Der KI-Dienst hat keine Textantwort geliefert." }, { status: 502 });
    return NextResponse.json({ response: text, model: payload?.model || process.env.LUMINA_AI_MODEL || "gpt-5-mini" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Die KI-Anfrage hat das Zeitlimit überschritten. Bitte erneut versuchen." }, { status: 504 });
    }
    return NextResponse.json({ error: "KI-Dienst nicht erreichbar." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
