import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regressionstest gegen einen automatischen LLM-Aufruf beim Oeffnen/Anzeigen von KAI/KIRA.
// Es existiert (noch) keine React-/DOM-Testinfrastruktur in diesem Projekt (siehe
// vitest.config.ts: bewusst "environment: node", nur reine Funktionen) - ein echter
// Render-/Interaktionstest waere eine groessere Testinfrastruktur-Migration. Dieser Test prueft
// stattdessen strukturell auf Quelltextebene, dass der zuvor identifizierte automatische Trigger
// entfernt ist und nicht wieder auftaucht: eine fruehere useEffect-basierte "Tagesbeurteilung"
// rief bei jedem Aufruf von "Mein Tag" ohne bestehenden Chatverlauf selbststaendig
// askSparring(...) auf (day-sparring/route.ts, echter LLM-Aufruf) - unabhaengig davon, ob der
// KAI/KIRA-Drawer ueberhaupt geoeffnet war.

const SOURCE = readFileSync(new URL("./workflow-shell.tsx", import.meta.url), "utf8");

describe("KAI/KIRA start bleibt frei von automatischen LLM-Aufrufen", () => {
  it("die entfernte automatische Tagesbeurteilung (askSparring in einem useEffect) taucht nicht wieder auf", () => {
    expect(SOURCE).not.toContain("Beurteile meine heutige Arbeitssituation");
    expect(SOURCE).not.toContain("sparringAutoRef");
    expect(SOURCE).not.toContain('"assessment" | "chat"');
  });

  it("askSparring wird nur noch von den bekannten expliziten Nutzeraktionen aufgerufen (Prompt-Buttons, Enter im Composer, Senden-Button) - kein neuer, unerwarteter Aufrufer", () => {
    const callSites = SOURCE.match(/(?<!async function )askSparring\(/g) || [];
    // 3 bekannte, an explizite Nutzergesten gebundene Aufrufstellen: Schnellprompt-Button,
    // Enter-Taste im Composer, Senden-Button. Eine Aenderung dieser Zahl bedeutet, dass ein neuer
    // Aufrufer hinzugekommen ist und manuell geprueft werden muss, ob er wirklich an eine
    // explizite Nutzeraktion gebunden ist.
    expect(callSites.length).toBe(3);
  });

  it("keine useEffect-Definition im Modul ruft askSparring direkt in ihrem Effekt-Body auf", () => {
    const effectBodies = SOURCE.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) || [];
    expect(effectBodies.length).toBeGreaterThan(0);
    for (const body of effectBodies) {
      expect(body).not.toMatch(/[^.]askSparring\(/);
    }
  });

  it("der 0-Token-Startbildschirm bleibt der einzige Automatismus beim Oeffnen (loadWorkspaceAction statt askSparring)", () => {
    expect(SOURCE).toContain('void loadWorkspaceAction("start", {})');
  });
});
