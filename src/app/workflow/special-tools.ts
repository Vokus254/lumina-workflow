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
