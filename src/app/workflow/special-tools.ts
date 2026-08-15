// Gemeinsame Quelle fuer die V9-Spezialwerkzeug-Prozessschritte (2.1, 2.2, 2.4, 3.17, 4.4).
// Server (page.tsx) und Client (workflow-shell.tsx) muessen dieselbe Codeliste verwenden,
// sonst koennen Erreichbarkeits- und Klicklogik auseinanderlaufen (V9-Abnahme, Risiko T2).
export const SPECIAL_TOOL_STEP_CODES = new Set(["2.1", "2.2", "2.4", "3.17", "4.4"]);

export function isSpecialToolStep(code?: string | null): boolean {
  return Boolean(code) && SPECIAL_TOOL_STEP_CODES.has(code as string);
}

// V11: Unterwerkzeug-Codes und -Titel, identisch zu LUMINA_TOOL_TITLES in
// public/legacy/lumina.html. Einzige Quelle fuer Server (day-sparring/route.ts baut daraus das
// autoritative Navigationsverzeichnis fuer entityReferences) und Client (Beschriftung der
// "Werkzeug oeffnen"-Buttons), damit sich beide Seiten nicht auseinanderentwickeln.
export const SPECIAL_TOOL_SUBITEMS: Record<string, string> = {
  "2.1.1": "Zeitplan der Meilensteine",
  "2.1.2": "Gesamtverantwortung & Koordination",
  "2.2.1": "Verantwortliche je Bilanzposten",
  "2.2.2": "Gesamtverantwortung & Koordination",
  "2.4.1": "Maßnahmen- / Aufgabenliste",
  "2.4.2": "Gesamtverantwortung & Koordination",
  "3.17.1": "SuSa hochladen",
  "3.17.2": "Mapping",
  "3.17.3": "Berichtsstruktur",
  "4.4.1": "Bilanz & GuV",
  "4.4.2": "Gesamtverantwortung & Koordination",
};

// Stichworte, die Nutzerfragen typischerweise auf 3.17.1 ("SuSa hochladen") lenken sollen,
// z. B. "Wo kann ich die Saldenliste hochladen?". Dient nur als Routing-Hinweis fuer den
// KAI/KIRA-Prompt - der eigentliche Code 3.17.1 bleibt aus SPECIAL_TOOL_SUBITEMS validiert,
// hier wird nichts erfunden, nur eine bereits existierende Kachel bevorzugt vorgeschlagen.
export const SUSA_UPLOAD_SYNONYMS = ["saldenliste", "susa", "summen- und saldenliste", "summen-und-saldenliste"];

export function specialToolParentCode(subCode: string): string | null {
  const match = subCode.match(/^(\d+(?:\.\d+)*)\.\d+$/);
  return match ? match[1] : null;
}

// V12-Regressionsfix, jetzt als reine, testbare Entscheidung: welcher Code soll zuerst EXAKT
// gegen process_steps geprüft werden, und wann darf überhaupt auf den Elternschritt eines
// Unterwerkzeug-Codes ausgewichen werden? Vorher wurde specialToolParentCode() ungeprüft auf
// JEDEN mehrteiligen Code angewendet, wodurch z. B. "1.7" fälschlich zu "1" und "3.17" fälschlich
// zu "3" verkürzt wurde, bevor ein exakter Treffer überhaupt versucht war. Die Regel jetzt: exakt
// zuerst; der Elterncode wird ausschließlich dann als Fallback vorgeschlagen, wenn der angefragte
// Code selbst ein bekannter Unterwerkzeug-Schlüssel aus SPECIAL_TOOL_SUBITEMS ist (z. B. "3.17.1").
export function resolveStepLookupPlan(ref: string): { exactCode: string; parentFallbackCode: string | null } {
  const parent = SPECIAL_TOOL_SUBITEMS[ref] ? specialToolParentCode(ref) : null;
  return { exactCode: ref, parentFallbackCode: parent };
}

// V12-Bugfix: SPECIAL_TOOL_SUBITEMS kennt nur Titel für Unterwerkzeuge (z. B. "3.17.1"), nicht für
// den übergeordneten Werkzeug-Code selbst ("3.17"). Ohne Fallback lieferte "öffne 3.17" tool.title
// = null, was im Workspace wörtlich als "3.17 · null" gerendert wurde. Für Top-Level-Codes auf den
// echten Namen des Prozessschritts zurückfallen, statt null durchzureichen.
export function resolveToolTitle(toolCode: string | null | undefined, stepName?: string | null): string | null {
  if (!toolCode) return null;
  return SPECIAL_TOOL_SUBITEMS[toolCode] || stepName || null;
}
