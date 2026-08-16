import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V13: First-Login-Onboarding. Wie in kai-kira-no-auto-llm.test.ts gibt es (bewusst) keine
// React-/DOM-Testinfrastruktur in diesem Projekt - dieser Test prueft strukturell auf
// Quelltextebene die beiden vom Nutzer geforderten Garantien:
// 1. user_project_onboarding wird server-seitig NUR ueber die explizite Aktion
//    "onboardingAdvance" beschrieben, niemals als Nebeneffekt des "start"-Lesepfads.
// 2. Der Client loest "onboardingAdvance" ausschliesslich aus handleWorkspaceChip aus (echte
//    Nutzergeste: Klick auf eine der Onboarding-Aktionsschaltflaechen), nie aus einem useEffect.

const ROUTE_SOURCE = readFileSync(new URL("../api/workflow/assistant-workspace/route.ts", import.meta.url), "utf8");
const SHELL_SOURCE = readFileSync(new URL("./workflow-shell.tsx", import.meta.url), "utf8");
const WORKSPACE_SOURCE = readFileSync(new URL("./kai-workspace.tsx", import.meta.url), "utf8");

describe("V13 First-Login-Onboarding bleibt 0-Token und schreibt den Status nur explizit", () => {
  it("der 'start'-Lesepfad liest user_project_onboarding nur per select, nie per upsert/insert", () => {
    const startActionBlock = ROUTE_SOURCE.slice(ROUTE_SOURCE.indexOf('if (action === "start")'), ROUTE_SOURCE.indexOf('if (action === "myOpenTasks"'));
    expect(startActionBlock).toContain('.from("user_project_onboarding").select("status")');
    expect(startActionBlock).not.toMatch(/user_project_onboarding["'][\s\S]{0,80}\.(upsert|insert|update)\(/);
  });

  it("nur die Aktion 'onboardingAdvance' schreibt in user_project_onboarding (genau eine upsert-Stelle)", () => {
    const upsertSites = ROUTE_SOURCE.match(/\.from\("user_project_onboarding"\)\.upsert\(/g) || [];
    expect(upsertSites.length).toBe(1);
    expect(ROUTE_SOURCE).toContain('if (action === "onboardingAdvance")');
  });

  it("advanceOnboarding wird ausschliesslich aus handleWorkspaceChip aufgerufen, nicht aus einem useEffect-Body", () => {
    const callSites = SHELL_SOURCE.match(/(?<!async function )advanceOnboarding\(/g) || [];
    expect(callSites.length).toBe(1);
    const effectBodies = SHELL_SOURCE.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) || [];
    expect(effectBodies.length).toBeGreaterThan(0);
    for (const body of effectBodies) {
      expect(body).not.toContain("advanceOnboarding(");
    }
  });

  it("die Onboarding-Karte bietet genau die sechs vereinbarten Aktionen an", () => {
    const onboardingBlock = WORKSPACE_SOURCE.slice(WORKSPACE_SOURCE.indexOf('card.type === "onboarding"'), WORKSPACE_SOURCE.indexOf('card.type === "colleagues"'));
    for (const action of ["myOpenTasks", "schedule", "colleagues", "openCommunication", "dismissOnboarding", "switchKira"]) {
      expect(onboardingBlock).toContain(`onChip("${action}")`);
    }
  });
});
