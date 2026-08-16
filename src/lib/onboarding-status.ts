// V13: reine, testbare Statuslogik fuer das First-Login-Onboarding (user_project_onboarding).
// Der Status ist monoton: not_started -> introduced -> active, nie rueckwaerts. Server
// (assistant-workspace/route.ts, Aktion "onboardingAdvance") und Client (workflow-shell.tsx,
// handleWorkspaceChip) verwenden dieselbe Zuordnung, damit "welche Aktion darf was setzen" an
// genau einer Stelle entschieden wird statt zweimal getrennt gepflegt zu werden.

export type OnboardingStatus = "not_started" | "introduced" | "active";

const RANK: Record<OnboardingStatus, number> = { not_started: 0, introduced: 1, active: 2 };

export function nextOnboardingStatus(current: OnboardingStatus, requested: OnboardingStatus): OnboardingStatus {
  return RANK[requested] > RANK[current] ? requested : current;
}

// Nur die beiden bewussten Abschlussaktionen ("KAI etwas fragen" / "KIRA um zweiten Blick bitten")
// duerfen auf "active" zielen. Jede andere Onboarding-Aktion (Aufgaben/Zeitplan/Kollegen/
// Kommunikation ansehen) ist eine reine Erkundungsaktion und zielt nur auf "introduced".
export function onboardingTargetStatusForChip(action: string): OnboardingStatus {
  return action === "dismissOnboarding" || action === "switchKira" ? "active" : "introduced";
}
