// Trennt die Anzeige der ZULETZT ausgefuehrten Aktion von der historischen Sitzungssumme.
// Bugfix: nach einer 0-Token-LUMINA-Aktion (z. B. KAI/KIRA-Start) zeigte die zweite Zeile
// weiterhin "Letzte KI-Abfrage: 41.932 Token" aus einer fruaheren echten LLM-Antwort in
// derselben Sitzung - das wirkte fuer den Nutzer so, als haette die aktuelle 0-Token-Aktion
// erneut Tokens verbraucht. Die "letzte KI-Abfrage"-Zeile darf nur erscheinen, wenn die
// zuletzt ausgefuehrte Aktion tatsaechlich eine LLM-Abfrage war.

export type SparringUsage = { totalTokens: number; estimatedEur: number | null };
export type SparringSessionUsage = { tokens: number; eur: number };

export function resolveLastActionLabel(lastActionKind: "lumina" | "llm" | null, sparringUsage: SparringUsage | null): string {
  if (lastActionKind === "lumina") return "Direkt aus LUMINA · 0 KI-Tokens";
  if (lastActionKind === "llm") return `KI-Abfrage · ${(sparringUsage?.totalTokens ?? 0).toLocaleString("de-DE")} Token`;
  return "–";
}

export function resolveLastQueryUsageLabel(lastActionKind: "lumina" | "llm" | null, sparringUsage: SparringUsage | null): string | null {
  // Nur anzeigen, wenn die letzte Aktion tatsaechlich eine LLM-Abfrage war - ein aelterer
  // sparringUsage-Wert aus einer frueheren Aktion in derselben Sitzung wird sonst faelschlich
  // als Verbrauch der aktuellen (0-Token-)Aktion dargestellt.
  if (lastActionKind !== "llm" || !sparringUsage) return null;
  const eurSuffix = sparringUsage.estimatedEur !== null
    ? ` · ca. ${sparringUsage.estimatedEur.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
    : "";
  return `Letzte KI-Abfrage: ${sparringUsage.totalTokens.toLocaleString("de-DE")} Token${eurSuffix}`;
}

export function resolveSessionUsageLabel(sparringSessionUsage: SparringSessionUsage): string | null {
  // Historische Sitzungssumme bleibt unabhaengig von der letzten Aktion sichtbar, aber
  // eindeutig als "bisherige Nutzung" statt als aktueller Vorgang beschriftet.
  if (sparringSessionUsage.tokens <= 0) return null;
  return `Bisherige KI-Nutzung dieser Sitzung: ${sparringSessionUsage.tokens.toLocaleString("de-DE")} Token · ca. ${sparringSessionUsage.eur.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}
