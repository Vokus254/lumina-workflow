import { defineConfig } from "vitest/config";

// Bewusst minimal: nur fuer reine, deterministische Funktionen (intent-router, special-tools).
// Keine React-/Next-Testinfrastruktur noetig, solange dort keine Komponenten getestet werden.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
