import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Assistant = "KAI" | "KIRA";

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output || []) for (const content of item?.content || []) if (content?.type === "output_text" && typeof content.text === "string") parts.push(content.text);
  return parts.join("\n").trim();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  let body: { assistant?: Assistant; taskId?: string; prompt?: string; context?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 }); }
  const assistant: Assistant = body.assistant === "KIRA" ? "KIRA" : "KAI";
  const taskId = String(body.taskId || "").trim(), prompt = String(body.prompt || "").trim();
  if (!taskId || !prompt) return NextResponse.json({ error: "Aufgabe oder Frage fehlt." }, { status: 400 });
  const { data: task, error: taskError } = await supabase.from("tasks").select("id").eq("id", taskId).maybeSingle();
  if (taskError || !task) return NextResponse.json({ error: "Kein Zugriff auf diese Aufgabe." }, { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "KI-Konfiguration fehlt: OPENAI_API_KEY ist auf dem Server nicht gesetzt." }, { status: 503 });
  const role = assistant === "KIRA"
    ? "Du bist KIRA, die KI-Wirtschaftsprüferin in LUMINA. Prüfe kritisch auf Vollständigkeit, Plausibilität, Nachweise, Risiken und Widersprüche. Gib nur fachliche Hinweise und Empfehlungen. Ändere niemals Status, Freigaben, Daten oder Workflow-Gates und behaupte nie, eine Prüfung rechtsverbindlich abgeschlossen zu haben."
    : "Du bist KAI, der KI-Bilanzbuchhalter in LUMINA. Führe den Anwender konkret durch die Abschlussaufgabe, erkläre Vorgehen, benötigte Unterlagen, typische Fehler und nächste Arbeitsschritte. Gib nur fachliche Hilfestellung. Ändere niemals Status, Freigaben, Daten oder Workflow-Gates.";
  const input = `${role}\n\nAufgabenkontext aus LUMINA:\n${JSON.stringify(body.context ?? {}, null, 2)}\n\nFrage/Auftrag:\n${prompt}\n\nAntworte auf Deutsch, konkret, strukturiert und ausschließlich auf Basis des vorhandenen Kontexts. Fehlende Nachweise als fehlend kennzeichnen; nichts erfinden.`;
  const aiResponse = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.LUMINA_AI_MODEL || "gpt-5-mini", input }) });
  const payload = await aiResponse.json();
  if (!aiResponse.ok) return NextResponse.json({ error: payload?.error?.message || "KI-Dienst nicht erreichbar." }, { status: 502 });
  const text = extractOutputText(payload);
  if (!text) return NextResponse.json({ error: "Der KI-Dienst hat keine Textantwort geliefert." }, { status: 502 });
  return NextResponse.json({ response: text, model: payload?.model || process.env.LUMINA_AI_MODEL || "gpt-5-mini" });
}
