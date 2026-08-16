// V2: gemeinsame, reine Hilfsfunktionen/Konstanten fuer alle Abschluss-Chat-Rollen-Shells
// (Bearbeiter/Reviewer/Vorstand/WP/Admin) - ein Ort statt fuenffacher Kopie. Keine Businesslogik,
// keine Datenzugriffe ausser dem generischen callWorkspace()-Aufruf gegen die bereits RLS-
// gebundene assistant-workspace-Route.

export type ChatSkin = "lumina" | "claude" | "chatgpt" | "grok" | "sap";
export const SKIN_OPTIONS: { value: ChatSkin; label: string }[] = [
  { value: "lumina", label: "Lumina" },
  { value: "claude", label: "Claude" },
  { value: "chatgpt", label: "ChatGPT" },
  { value: "grok", label: "Grok" },
  { value: "sap", label: "SAP" },
];

export const WORK_LABELS: Record<string, string> = { open: "Offen", accepted: "Angenommen", in_progress: "In Bearbeitung", submitted: "Eingereicht", completed: "Abgeschlossen", not_relevant: "Nicht relevant" };
export const REVIEW_LABELS: Record<string, string> = { unreviewed: "Ungeprüft", question: "Rückfrage", changes_required: "Nachbesserung", accepted: "Akzeptiert" };

export function formatGermanDate(value?: string | null) {
  if (!value) return "–";
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
}

export function formatGermanDateTime(value?: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${formatGermanDate(value)} ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

export async function callWorkspace(projectId: string, action: string, params: Record<string, unknown> = {}) {
  const response = await fetch("/api/workflow/assistant-workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, action, params }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "LUMINA-Daten konnten nicht geladen werden.");
  return payload.card;
}
