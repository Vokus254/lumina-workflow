// Reine, deterministische Routing-Regeln fuer KAI/KIRA - keine LLM-Klassifikation, keine I/O.
// Gemeinsam genutzt von workflow-shell.tsx (Client, vor jedem askSparring-Aufruf) und
// day-sparring/route.ts (Server, als Sicherheitsnetz), damit beide Seiten dieselbe Definition
// von "eindeutig navigierbar" bzw. "braucht einen Fokus" verwenden statt zwei Kopien zu pflegen.

const FULL_MATRIX_PATTERNS: RegExp[] = [
  /vollständig/i,
  /gesamte?\s+terminmatrix/i,
  /alle\s+termine/i,
  /zeig(e|en)?\s+(mir\s+)?alle/i,
  /komplette?\s+(liste|matrix|übersicht)/i,
  /gesamte?\s+liste/i,
];
export function isFullMatrixRequest(text: string) {
  return FULL_MATRIX_PATTERNS.some((pattern) => pattern.test(text));
}

const NAV_VERB = "(?:gehe?\\s+zu|geh\\s+zu|öffne|zeig(?:e)?(?:\\s+mir)?|wo\\s+ist)";
const NAV_REF_PATTERN = new RegExp(`^${NAV_VERB}\\s+(?:die\\s+|den\\s+)?(?:kachel|maßnahme|aufgabe|schritt)?\\s*([\\d][\\d.]*)\\b`, "i");
const NAV_SEARCH_PATTERN = new RegExp(`^${NAV_VERB}\\s+(?:die\\s+|den\\s+)?(.+)$`, "i");

export type RoutedIntent = { kind: "fullSchedule" } | { kind: "measure"; ref: string } | { kind: "search"; query: string };

export function routeIntent(text: string): RoutedIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (isFullMatrixRequest(trimmed)) return { kind: "fullSchedule" };
  const refMatch = trimmed.match(NAV_REF_PATTERN);
  if (refMatch) return { kind: "measure", ref: refMatch[1] };
  const searchMatch = trimmed.match(NAV_SEARCH_PATTERN);
  if (searchMatch && searchMatch[1].trim().length >= 2) return { kind: "search", query: searchMatch[1].trim() };
  return null;
}

// "Reicht das für den WP?" ohne offene Maßnahme bezieht sich grammatikalisch auf ein "das"/"es",
// das ohne konkreten Fokus nicht existiert - deterministisch abfangen statt zu raten.
const NEEDS_FOCUS_PATTERNS: RegExp[] = [
  /reicht\s+(das|es|dies)/i,
  /ist\s+(das|es|dies)\s+vollständig/i,
  /was\s+fehlt(\s+noch)?\s*\??\s*$/i,
  /genügt\s+(das|es|dies)/i,
  /ausreichend\s+dokumentiert/i,
];
export function needsExplicitFocus(text: string) {
  return NEEDS_FOCUS_PATTERNS.some((pattern) => pattern.test(text));
}

// Nur bei ausdrücklich projektweiten Formulierungen darf der große Projektkontext (Matrix +
// vollständiges Navigationsverzeichnis) überhaupt geladen werden.
const PROJECT_WIDE_PATTERNS: RegExp[] = [
  /gesamten?\s+jahresabschluss/i,
  /gesamtbeurteilung/i,
  /gesamtes?\s+projekt/i,
  /gesamtprojekt/i,
  /größten?\s+risiken?.*projekt/i,
  /projektweite/i,
  /komplett(e|en)?\s+abschluss/i,
];
export function isExplicitProjectRequest(text: string) {
  return PROJECT_WIDE_PATTERNS.some((pattern) => pattern.test(text));
}
