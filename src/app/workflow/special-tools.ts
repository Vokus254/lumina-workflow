// Gemeinsame Quelle fuer die V9-Spezialwerkzeug-Prozessschritte (2.1, 2.2, 2.4, 3.17, 4.4).
// Server (page.tsx) und Client (workflow-shell.tsx) muessen dieselbe Codeliste verwenden,
// sonst koennen Erreichbarkeits- und Klicklogik auseinanderlaufen (V9-Abnahme, Risiko T2).
export const SPECIAL_TOOL_STEP_CODES = new Set(["2.1", "2.2", "2.4", "3.17", "4.4"]);

export function isSpecialToolStep(code?: string | null): boolean {
  return Boolean(code) && SPECIAL_TOOL_STEP_CODES.has(code as string);
}
