// V14: Component-/Workspace-Registry fuer den Conversational Workspace.
//
// Prinzip (siehe KAI_KIRA_CONTEXT.md / SECURITY_RULES.md): weder KAI/KIRA noch der
// deterministische Router duerfen jemals eine frei erfundene URL oder Entity-ID zurueckgeben.
// Jede Referenz ist ausschliesslich { type, ref } - eine Kennung, die der Server (assistant-
// workspace/route.ts) gegen echte, RLS-gebundene LUMINA-Daten aufloest, bevor irgendeine Karte
// gerendert wird. Diese Datei ist die zentrale, typisierte Liste aller aktuell existierenden bzw.
// fuer die V15/V16/V17-Roadmap vorgesehenen Kartentypen - eine neue Karte wird hier eingetragen,
// niemals als roher String irgendwo im Client verstreut.
//
// "implemented: true" = bereits ueber WorkspaceCard (kai-workspace.tsx) + assistant-workspace/
// route.ts real, 0-Token, RLS-gebunden verfuegbar. "implemented: false" = Registry-Eintrag fuer
// die Roadmap (V15/V16/V17), noch ohne Implementierung - siehe V14-Abschlussbericht.

export type WorkspaceComponentType =
  | "task" // WorkspaceCard "measure" mit task - Aufgabe als vollstaendige Mini-App (V14 Referenzimplementierung)
  | "taskList" // "myOpenTasks"/"myOverdueTasks"/"dueToday"/"reviewIssues"/"missingEvidence"
  | "schedule" // Terminmatrix (get_project_schedule_responsibility RPC)
  | "process" // "processSteps" - Prozessnavigation
  | "documents" // Dokumentliste zu einer Aufgabe
  | "communication" // Kommunikationsverlauf zu einer Aufgabe
  | "review" // Reviewstatus (aktuell Teil der Aufgaben-Mini-App, siehe MeasureCardView Tab "Review")
  | "colleagues" // "Wer arbeitet mit mir?"
  | "onboarding" // First-Login-Onboarding (V13)
  | "specialTool" // 2.1/2.2/2.4/3.17/4.4 - aktuell nur ueber den Legacy-Desktop, siehe Roadmap
  | "susaUpload" // 3.17.1 - Roadmap V15
  | "mapping" // 3.17.2 - Roadmap V15
  | "reportingStructure" // 3.17.3 - Roadmap V16
  | "balanceSheet" // 4.4.1 Bilanz - Roadmap V16
  | "profitLoss" // 4.4.1 GuV - Roadmap V16
  | "responsibilityMatrix" // 2.2 - Roadmap V15
  | "milestonePlan" // 2.1 - Roadmap V15
  | "statusReport"; // Statusbericht-Kacheln - Roadmap V17

export type WorkspaceComponentEntry = {
  type: WorkspaceComponentType;
  label: string;
  /** true, wenn die Karte serverseitig ohne LLM-Aufruf aufgeloest wird (assistant-workspace/route.ts). */
  tokenFree: boolean;
  implemented: boolean;
  /** Kurzbeschreibung, wie eine Referenz aufgeloest wird - nie eine freie URL/ID vom Client/LLM. */
  resolvedBy: string;
};

export const WORKSPACE_COMPONENT_REGISTRY: readonly WorkspaceComponentEntry[] = [
  { type: "task", label: "Aufgabe", tokenFree: true, implemented: true, resolvedBy: "assistant-workspace 'measure' - taskNumber gegen tasks (RLS) aufgeloest" },
  { type: "taskList", label: "Aufgabenliste", tokenFree: true, implemented: true, resolvedBy: "assistant-workspace 'myOpenTasks' u.a. - role_user_assignments-gebunden" },
  { type: "schedule", label: "Terminmatrix", tokenFree: true, implemented: true, resolvedBy: "RPC get_project_schedule_responsibility (can_access_project)" },
  { type: "process", label: "Abschlussprozess", tokenFree: true, implemented: true, resolvedBy: "assistant-workspace 'processTree' - process_steps (RLS)" },
  { type: "documents", label: "Dokumente", tokenFree: true, implemented: true, resolvedBy: "assistant-workspace 'documents' - taskId-gebunden (RLS)" },
  { type: "communication", label: "Kommunikation", tokenFree: true, implemented: true, resolvedBy: "assistant-workspace 'communication' - taskId-gebunden (RLS)" },
  { type: "review", label: "Review", tokenFree: true, implemented: true, resolvedBy: "Teil der 'measure'-Karte (task.reviewStatus)" },
  { type: "colleagues", label: "Wer arbeitet mit mir?", tokenFree: true, implemented: true, resolvedBy: "assistant-workspace 'colleagues' - responsibility_roles (can_access_project)" },
  { type: "onboarding", label: "First-Login-Onboarding", tokenFree: true, implemented: true, resolvedBy: "assistant-workspace 'start' - user_project_onboarding (self+can_access_project)" },
  { type: "specialTool", label: "Spezialwerkzeug", tokenFree: true, implemented: false, resolvedBy: "aktuell nur Legacy-Desktop-Overlay (activeToolCode) - Roadmap V15+" },
  { type: "susaUpload", label: "SuSa hochladen (3.17.1)", tokenFree: true, implemented: false, resolvedBy: "Roadmap V15" },
  { type: "mapping", label: "Mapping (3.17.2)", tokenFree: true, implemented: false, resolvedBy: "Roadmap V15" },
  { type: "reportingStructure", label: "Berichtsstruktur (3.17.3)", tokenFree: true, implemented: false, resolvedBy: "Roadmap V16" },
  { type: "balanceSheet", label: "Bilanz (4.4.1)", tokenFree: true, implemented: false, resolvedBy: "Roadmap V16" },
  { type: "profitLoss", label: "GuV (4.4.1)", tokenFree: true, implemented: false, resolvedBy: "Roadmap V16" },
  { type: "responsibilityMatrix", label: "Rollen & Verantwortlichkeiten (2.2)", tokenFree: true, implemented: false, resolvedBy: "Roadmap V15" },
  { type: "milestonePlan", label: "Zeitplan Abschluss (2.1)", tokenFree: true, implemented: false, resolvedBy: "Roadmap V15" },
  { type: "statusReport", label: "Statusbericht", tokenFree: true, implemented: false, resolvedBy: "Roadmap V17" },
] as const;
