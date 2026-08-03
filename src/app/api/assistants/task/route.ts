import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type AssistantKey = "KAI" | "KIRA";
type FileContent = { type: "input_file"; filename: string; file_data: string };

// Keep this latency-sensitive route below Vercel's 60 second function limit.
const MODEL = process.env.OPENAI_ASSISTANT_MODEL || "gpt-5.6-terra";
const OPENAI_TIMEOUT_MS = 48_000;
const MAX_FILES = 3;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set([
  "pdf", "txt", "md", "json", "csv", "xls", "xlsx", "doc", "docx", "ppt", "pptx",
]);

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function assistantInstruction(assistant: AssistantKey) {
  const shared = `Du arbeitest ausschließlich innerhalb einer konkreten Jahresabschlussaufgabe in LUMINA. Antworte auf Deutsch, klar, freundlich und umsetzbar. Nutze nur die übergebenen Informationen und Dateien. Erfinde keine Belege, Buchungen, Beträge oder Prüfergebnisse. Weise fehlende Informationen ausdrücklich aus. Nenne bei Aussagen aus einer Datei möglichst den Dateinamen und die betroffene Tabelle oder Position. Formatiere die Antwort mit kurzen Überschriften und Listen.`;
  if (assistant === "KAI") {
    return `${shared}\n\nDu bist KAI, ein erfahrener Bilanzbuchhalter und Arbeitsassistent. Hilf dem Bearbeiter bei der Erstellung: erkläre die Aufgabe, prüfe die vorhandene Arbeitsdatei rechnerisch und fachlich soweit möglich, zeige konkrete nächste Schritte, Abstimmungen und fehlende Nachweise. Schließe mit einer priorisierten Checkliste ab. Du erteilst keine Abschlussfreigabe.`;
  }
  return `${shared}\n\nDu bist KIRA, eine unabhängige digitale Prüfungsassistentin. Prüfe die tatsächlich vorliegenden Unterlagen kritisch auf Vollständigkeit, rechnerische Plausibilität, Kontenabstimmung, Periodenabgrenzung und Nachweise. Gliedere Feststellungen in Kritisch, Wesentlich und Hinweis. Schließe mit einem eindeutigen Arbeitsurteil ab: „prüfbereit“, „Rückfragen“ oder „Nacharbeit erforderlich“. Das ist eine Arbeitsunterstützung und kein Prüfungsurteil oder Bestätigungsvermerk; die menschliche Freigabe bleibt erforderlich.`;
}

function responseText(payload: unknown) {
  const data = payload as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (data.output_text?.trim()) return data.output_text.trim();
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((item) => item.text || "")
    .join("\n")
    .trim();
}

export async function GET(request: Request) {
  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId) return jsonError("Aufgabe fehlt.");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonError("Bitte melden Sie sich erneut an.", 401);

  const { data, error } = await supabase
    .from("task_ai_interactions")
    .select("id,assistant_key,request_text,response_text,model,document_ids,created_at,created_by_user_id")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return jsonError(error.message, 403);
  return Response.json({ interactions: data || [] });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return jsonError("KAI und KIRA sind noch nicht vollständig konfiguriert.", 503);

  let body: { taskId?: string; assistant?: AssistantKey; question?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Ungültige Anfrage.");
  }
  if (!body.taskId || !["KAI", "KIRA"].includes(body.assistant || "")) {
    return jsonError("Aufgabe oder Assistent fehlt.");
  }
  const assistant = body.assistant as AssistantKey;
  const question = body.question?.trim() || (assistant === "KAI"
    ? "Analysiere die Aufgabe und die vorhandenen Unterlagen vollständig. Was soll ich jetzt konkret tun?"
    : "Prüfe die vorhandenen Unterlagen vollständig und nenne Feststellungen sowie den nächsten erforderlichen Schritt.");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return jsonError("Bitte melden Sie sich erneut an.", 401);

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,project_id,source_number,title,category,required_documents_text,expected_format,company_scope_text,due_date,due_date_override,internal_comment,work_status,review_status")
    .eq("id", body.taskId)
    .single();
  if (taskError || !task) return jsonError("Diese Aufgabe ist für Sie nicht freigegeben.", 403);

  const [{ data: workPackage }, { data: documents, error: documentError }, { data: history }] = await Promise.all([
    supabase.rpc("get_task_work_package", { p_task_id: body.taskId }),
    supabase.from("documents").select("id,display_name,document_status,created_at").eq("task_id", body.taskId).is("archived_at", null),
    supabase.from("task_ai_interactions").select("assistant_key,request_text,response_text,created_at").eq("task_id", body.taskId).order("created_at", { ascending: false }).limit(4),
  ]);
  if (documentError) return jsonError("Die Unterlagen der Aufgabe konnten nicht geladen werden.", 403);

  const documentIds = (documents || []).map((document) => document.id);
  const latestVersions: Array<Record<string, unknown>> = [];
  if (documentIds.length) {
    const { data: versions } = await supabase
      .from("document_versions")
      .select("id,document_id,version_number,storage_bucket,storage_path,original_file_name,mime_type,file_size,created_at")
      .in("document_id", documentIds)
      .order("version_number", { ascending: false });
    const seen = new Set<string>();
    for (const version of versions || []) {
      if (!seen.has(version.document_id)) {
        seen.add(version.document_id);
        latestVersions.push(version);
      }
    }
  }

  const fileContent: FileContent[] = [];
  const analyzedDocuments: string[] = [];
  const analyzedDocumentIds: string[] = [];
  let totalBytes = 0;
  for (const version of latestVersions) {
    if (fileContent.length >= MAX_FILES) break;
    const name = String(version.original_file_name || "Unterlage");
    const extension = name.split(".").pop()?.toLowerCase() || "";
    const size = Number(version.file_size || 0);
    if (!ACCEPTED_EXTENSIONS.has(extension) || size > MAX_FILE_BYTES || totalBytes + size > MAX_TOTAL_BYTES) continue;
    const { data: blob, error } = await supabase.storage
      .from(String(version.storage_bucket))
      .download(String(version.storage_path));
    if (error || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    fileContent.push({
      type: "input_file",
      filename: name,
      file_data: `data:${String(version.mime_type || "application/octet-stream")};base64,${buffer.toString("base64")}`,
    });
    analyzedDocuments.push(name);
    analyzedDocumentIds.push(String(version.document_id));
    totalBytes += buffer.length;
  }

  const guide = (workPackage as { guide?: unknown; steps?: unknown } | null) || {};
  const context = [
    `AUFGABE\nNr.: ${task.source_number || "–"}\nTitel: ${task.title}\nKategorie: ${task.category || "–"}`,
    `Benötigte Unterlagen: ${task.required_documents_text || "nicht angegeben"}\nErwartetes Format: ${task.expected_format || "nicht angegeben"}\nGesellschaft: ${task.company_scope_text || "nicht angegeben"}`,
    `Fälligkeit: ${task.due_date_override || task.due_date || "nicht angegeben"}\nArbeitsstatus: ${task.work_status}\nPrüfstatus: ${task.review_status}`,
    `ARBEITSANLEITUNG\n${JSON.stringify(guide.guide || {})}\nSchritte: ${JSON.stringify(guide.steps || [])}`,
    analyzedDocuments.length ? `Zur Analyse beigefügte Dateien: ${analyzedDocuments.join(", ")}` : "Es konnte keine unterstützte aktuelle Datei beigefügt werden.",
    history?.length ? `Bisheriger KAI/KIRA-Verlauf (nur Kontext):\n${history.map((entry) => `${entry.assistant_key}: ${String(entry.response_text || "").slice(0, 1400)}`).join("\n\n")}` : "Noch kein KAI/KIRA-Verlauf.",
    `ANFRAGE DES BENUTZERS\n${question}`,
  ].join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  const startedAt = Date.now();
  let openAiResponse: Response;
  try {
    openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        store: false,
        max_output_tokens: 2200,
        reasoning: { effort: "low" },
        input: [
          { role: "developer", content: [{ type: "input_text", text: assistantInstruction(assistant) }] },
          { role: "user", content: [...fileContent, { type: "input_text", text: context }] },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("LUMINA assistant timed out", { assistant, model: MODEL, durationMs: Date.now() - startedAt });
      return jsonError("Die Analyse hat diesmal zu lange gedauert. Bitte starten Sie sie erneut – Ihre Datei bleibt erhalten.", 504);
    }
    console.error("LUMINA assistant request failed", error);
    return jsonError("KAI/KIRA konnte den Analysedienst gerade nicht erreichen. Bitte versuchen Sie es erneut.", 502);
  } finally {
    clearTimeout(timeout);
  }
  const payload = await openAiResponse.json();
  if (!openAiResponse.ok) {
    console.error("OpenAI assistant error", openAiResponse.status, payload);
    return jsonError("Die Analyse konnte gerade nicht erstellt werden. Bitte versuchen Sie es erneut.", 502);
  }
  const answer = responseText(payload);
  if (!answer) return jsonError("Der Assistent hat keine auswertbare Antwort geliefert.", 502);

  const { data: interactionId, error: saveError } = await supabase.rpc("record_task_ai_interaction", {
    p_task_id: body.taskId,
    p_assistant_key: assistant,
    p_request_text: question,
    p_response_text: answer,
    p_model: MODEL,
    p_document_ids: analyzedDocumentIds,
  });
  if (saveError) return jsonError("Die Analyse wurde erstellt, konnte aber nicht im Aufgabenverlauf gespeichert werden.", 500);

  return Response.json({
    interaction: { id: interactionId, assistant_key: assistant, request_text: question, response_text: answer, model: MODEL, document_ids: analyzedDocumentIds, created_at: new Date().toISOString() },
    analyzedDocuments,
  });
}
