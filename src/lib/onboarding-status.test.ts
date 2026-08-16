import { describe, expect, it } from "vitest";
import { nextOnboardingStatus, onboardingTargetStatusForChip } from "./onboarding-status";

// V13-Korrektur: die vier Erkundungsaktionen duerfen das Onboarding nur auf "introduced" bringen,
// nie versehentlich sofort auf "active". Nur die beiden bewussten Abschlussaktionen
// ("KAI etwas fragen" / dismissOnboarding, "KIRA um zweiten Blick bitten" / switchKira) duerfen auf
// "active" zielen. Der Status ist monoton (nextOnboardingStatus) - "active" wird nie zurueckgesetzt.

describe("onboardingTargetStatusForChip", () => {
  it("Erkundungsaktionen zielen auf 'introduced'", () => {
    for (const action of ["myOpenTasks", "schedule", "colleagues", "openCommunication"]) {
      expect(onboardingTargetStatusForChip(action)).toBe("introduced");
    }
  });
  it("nur dismissOnboarding und switchKira zielen auf 'active'", () => {
    expect(onboardingTargetStatusForChip("dismissOnboarding")).toBe("active");
    expect(onboardingTargetStatusForChip("switchKira")).toBe("active");
  });
});

describe("nextOnboardingStatus (monotoner Statusuebergang)", () => {
  it("not_started + Meine Aufgaben ansehen -> introduced", () => {
    expect(nextOnboardingStatus("not_started", onboardingTargetStatusForChip("myOpenTasks"))).toBe("introduced");
  });
  it("not_started + Zeitplan ansehen -> introduced", () => {
    expect(nextOnboardingStatus("not_started", onboardingTargetStatusForChip("schedule"))).toBe("introduced");
  });
  it("introduced + Wer arbeitet mit mir? -> bleibt introduced", () => {
    expect(nextOnboardingStatus("introduced", onboardingTargetStatusForChip("colleagues"))).toBe("introduced");
  });
  it("introduced + Kommunikation öffnen -> bleibt introduced", () => {
    expect(nextOnboardingStatus("introduced", onboardingTargetStatusForChip("openCommunication"))).toBe("introduced");
  });
  it("not_started + KAI etwas fragen -> active", () => {
    expect(nextOnboardingStatus("not_started", onboardingTargetStatusForChip("dismissOnboarding"))).toBe("active");
  });
  it("introduced + KAI etwas fragen -> active", () => {
    expect(nextOnboardingStatus("introduced", onboardingTargetStatusForChip("dismissOnboarding"))).toBe("active");
  });
  it("introduced + KIRA um zweiten Blick bitten -> active", () => {
    expect(nextOnboardingStatus("introduced", onboardingTargetStatusForChip("switchKira"))).toBe("active");
  });
  it("active bleibt active, auch bei einer erneuten Erkundungsaktion", () => {
    expect(nextOnboardingStatus("active", onboardingTargetStatusForChip("myOpenTasks"))).toBe("active");
    expect(nextOnboardingStatus("active", onboardingTargetStatusForChip("dismissOnboarding"))).toBe("active");
  });
});
