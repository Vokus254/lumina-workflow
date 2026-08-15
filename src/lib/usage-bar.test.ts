import { describe, expect, it } from "vitest";
import { resolveLastActionLabel, resolveLastQueryUsageLabel, resolveSessionUsageLabel } from "./usage-bar";

describe("resolveLastActionLabel", () => {
  it("shows 0 tokens when the last action was a deterministic LUMINA action", () => {
    expect(resolveLastActionLabel("lumina", null)).toBe("Direkt aus LUMINA · 0 KI-Tokens");
  });

  it("shows the real token count when the last action was an actual LLM query", () => {
    expect(resolveLastActionLabel("llm", { totalTokens: 41932, estimatedEur: 0.12 })).toBe("KI-Abfrage · 41.932 Token");
  });

  it("shows a dash before any action has run", () => {
    expect(resolveLastActionLabel(null, null)).toBe("–");
  });
});

describe("resolveLastQueryUsageLabel", () => {
  it("regression: does not show a stale token count from an earlier LLM call after a later 0-token LUMINA action", () => {
    // Reproduces the reported bug: KAI/KIRA start (a 0-token action) still showed
    // "Letzte KI-Abfrage: 41.932 Token" left over from an earlier real LLM answer in the same
    // session. The label must only appear when the *current* last action was itself an LLM query.
    const staleUsageFromEarlierLlmCall = { totalTokens: 41932, estimatedEur: 0.12 };
    expect(resolveLastQueryUsageLabel("lumina", staleUsageFromEarlierLlmCall)).toBeNull();
  });

  it("shows the token/cost line when the last action really was an LLM query", () => {
    expect(resolveLastQueryUsageLabel("llm", { totalTokens: 1200, estimatedEur: 0.004 })).toBe("Letzte KI-Abfrage: 1.200 Token · ca. 0,0040 €");
  });

  it("returns null before any LLM query has ever run", () => {
    expect(resolveLastQueryUsageLabel(null, null)).toBeNull();
    expect(resolveLastQueryUsageLabel("lumina", null)).toBeNull();
  });
});

describe("resolveSessionUsageLabel", () => {
  it("stays visible and clearly labeled as historical even right after a 0-token action", () => {
    const label = resolveSessionUsageLabel({ tokens: 41932, eur: 0.12 });
    expect(label).toContain("Bisherige KI-Nutzung dieser Sitzung");
    expect(label).toContain("41.932 Token");
  });

  it("returns null when nothing has been spent yet this session", () => {
    expect(resolveSessionUsageLabel({ tokens: 0, eur: 0 })).toBeNull();
  });
});
