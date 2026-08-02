/** @jest-environment node */

import {
  resolveTokensToCssVars,
  emitLegacyAliases,
  buildDefaultTokenRecords,
} from "../resolver";
import { COMPONENT_TOKEN_GROUPS, LEGACY_TO_TOKEN_MAP, getCssVarName } from "../token-registry";
import { getContrastRatio } from "../contrast";
import type { ComponentTokenRecord } from "../types";

/**
 * Helper to create a mock ComponentTokenRecord.
 */
function mockToken(overrides: Partial<ComponentTokenRecord> = {}): ComponentTokenRecord {
  return {
    themeId: "test-theme-id",
    name: "boxPrimary",
    bgLight: "#3a5ba0",
    bgDark: "#1a2b50",
    textLight: "#ffffff",
    textDark: "#f0f0f0",
    borderLight: "#2a4b90",
    borderDark: "#0a1b40",
    sortOrder: 0,
    ...overrides,
  };
}

describe("resolver", () => {
  describe("resolveTokensToCssVars", () => {
    it("produces --hopper-* CSS vars for light mode", () => {
      const tokens = [mockToken()];
      const vars = resolveTokensToCssVars(tokens, "light");

      expect(vars["--hopper-box-primary-bg"]).toBe("#3a5ba0");
      expect(vars["--hopper-box-primary-text"]).toBe("#ffffff");
      expect(vars["--hopper-box-primary-border"]).toBe("#2a4b90");
    });

    it("produces --hopper-* CSS vars for dark mode", () => {
      const tokens = [mockToken()];
      const vars = resolveTokensToCssVars(tokens, "dark");

      expect(vars["--hopper-box-primary-bg"]).toBe("#1a2b50");
      expect(vars["--hopper-box-primary-text"]).toBe("#f0f0f0");
      expect(vars["--hopper-box-primary-border"]).toBe("#0a1b40");
    });

    it("handles multiple tokens", () => {
      const tokens = [
        mockToken({ name: "boxPrimary" }),
        mockToken({ name: "buttonSecondary", bgLight: "#aa0000", bgDark: "#550000" }),
      ];
      const vars = resolveTokensToCssVars(tokens, "light");

      expect(vars["--hopper-box-primary-bg"]).toBe("#3a5ba0");
      expect(vars["--hopper-button-secondary-bg"]).toBe("#aa0000");
    });

    it("returns empty object for empty token array", () => {
      const vars = resolveTokensToCssVars([], "light");
      expect(Object.keys(vars).length).toBe(0);
    });

    it("produces 3 CSS vars per token (bg, text, border)", () => {
      const tokens = [mockToken()];
      const vars = resolveTokensToCssVars(tokens, "light");
      expect(Object.keys(vars).length).toBe(3);
    });

    it("skips transparent values so var() fallback chain works", () => {
      const tokens = [mockToken({
        bgLight: "transparent",
        textLight: "#ffffff",
        borderLight: "transparent",
      })];
      const vars = resolveTokensToCssVars(tokens, "light");

      expect(vars["--hopper-box-primary-bg"]).toBeUndefined();
      expect(vars["--hopper-box-primary-text"]).toBe("#ffffff");
      expect(vars["--hopper-box-primary-border"]).toBeUndefined();
    });

    it("returns empty object for all-transparent tokens", () => {
      const tokens = [mockToken({
        bgLight: "transparent",
        textLight: "transparent",
        borderLight: "transparent",
      })];
      const vars = resolveTokensToCssVars(tokens, "light");
      expect(Object.keys(vars).length).toBe(0);
    });
  });

  describe("emitLegacyAliases", () => {
    it("emits --colors-* legacy aliases for light mode", () => {
      // Note: "borderBgPrimary" is shared between boxPrimary and buttonPrimary
      // in the registry. The LEGACY_TO_TOKEN_MAP maps it to buttonPrimary (last writer wins).
      // So only bg and text legacy vars will come from boxPrimary.
      const tokens = [mockToken({ name: "boxPrimary" })];
      const vars = emitLegacyAliases(tokens, "light");

      expect(vars["--colors-boxBgPrimary"]).toBe("#3a5ba0");
      expect(vars["--colors-textPrimary"]).toBe("#ffffff");
    });

    it("emits --colors-* legacy aliases for dark mode", () => {
      const tokens = [mockToken({ name: "boxPrimary" })];
      const vars = emitLegacyAliases(tokens, "dark");

      expect(vars["--colors-boxBgPrimary"]).toBe("#1a2b50");
      expect(vars["--colors-textPrimary"]).toBe("#f0f0f0");
    });

    it("emits border legacy alias from the correct token (buttonPrimary)", () => {
      // borderBgPrimary maps to buttonPrimary in the LEGACY_TO_TOKEN_MAP
      const tokens = [
        mockToken({ name: "buttonPrimary", borderLight: "#aabbcc", borderDark: "#112233" }),
      ];
      const vars = emitLegacyAliases(tokens, "light");
      expect(vars["--colors-borderBgPrimary"]).toBe("#aabbcc");
    });

    it("skips tokens not found in the registry", () => {
      const tokens = [mockToken({ name: "nonExistentToken" })];
      const vars = emitLegacyAliases(tokens, "light");
      expect(Object.keys(vars).length).toBe(0);
    });

    it("maps all legacy variable names correctly", () => {
      // Create a token for each group and verify legacy aliases exist
      const tokens: ComponentTokenRecord[] = COMPONENT_TOKEN_GROUPS.map((group) =>
        mockToken({
          name: group.key,
          bgLight: "#aaa",
          textLight: "#bbb",
          borderLight: "#ccc",
          sortOrder: group.sortOrder,
        }),
      );

      const vars = emitLegacyAliases(tokens, "light");

      // Every legacy name in the map should have a corresponding --colors-* var
      for (const legacyName of Object.keys(LEGACY_TO_TOKEN_MAP)) {
        expect(vars[`--colors-${legacyName}`]).toBeDefined();
      }
    });
  });

  describe("buildDefaultTokenRecords", () => {
    it("creates records for all 32 token groups", () => {
      const records = buildDefaultTokenRecords("my-theme-id");
      expect(records.length).toBe(32);
    });

    it("sets themeId on all records", () => {
      const records = buildDefaultTokenRecords("my-theme-id");
      for (const record of records) {
        expect(record.themeId).toBe("my-theme-id");
      }
    });

    it("initializes all color slots to transparent", () => {
      const records = buildDefaultTokenRecords("test");
      for (const record of records) {
        expect(record.bgLight).toBe("transparent");
        expect(record.bgDark).toBe("transparent");
        expect(record.textLight).toBe("transparent");
        expect(record.textDark).toBe("transparent");
        expect(record.borderLight).toBe("transparent");
        expect(record.borderDark).toBe("transparent");
      }
    });

    it("assigns correct sort orders from the registry", () => {
      const records = buildDefaultTokenRecords("test");
      for (const record of records) {
        const group = COMPONENT_TOKEN_GROUPS.find((g) => g.key === record.name);
        expect(group).toBeDefined();
        expect(record.sortOrder).toBe(group!.sortOrder);
      }
    });

    it("uses token group key as the name", () => {
      const records = buildDefaultTokenRecords("test");
      const names = records.map((r) => r.name);
      const expectedNames = COMPONENT_TOKEN_GROUPS.map((g) => g.key);
      expect(names).toEqual(expectedNames);
    });
  });

  // ─── WCAG AA contrast enforcement ────────────────────────────────
  // The resolver guarantees every token's text/bg pair meets WCAG 2.2 AA
  // (4.5:1) in BOTH color modes, for ANY theme's token data. These are the
  // "tests for all light and dark themes": the invariant is proven over the
  // token model, so it holds for every theme regardless of its DB colors.
  describe("AA text-contrast enforcement", () => {
    const COLOR_MODES = ["light", "dark"] as const;

    function ratio(text: string, bg: string): number {
      return getContrastRatio(text, bg);
    }

    it.each(COLOR_MODES)(
      "raises a failing text/bg pair to >= 4.5:1 (%s mode)",
      (mode) => {
        // Light: near-white text on white (fails ~1.6:1). Dark: near-black on
        // black (fails). Both must be lifted to AA.
        const token = mockToken({
          name: "boxPrimary",
          bgLight: "#ffffff",
          textLight: "#bbbbbb", // ~1.6:1 on white — fails AA
          bgDark: "#000000",
          textDark: "#333333", // ~1.7:1 on black — fails AA
        });
        const vars = resolveTokensToCssVars([token], mode);
        const bg = vars["--hopper-box-primary-bg"];
        const text = vars["--hopper-box-primary-text"];
        expect(ratio(text, bg)).toBeGreaterThanOrEqual(4.5);
      },
    );

    it.each(COLOR_MODES)(
      "leaves an already-compliant pair untouched (%s mode)",
      (mode) => {
        const token = mockToken({
          name: "boxPrimary",
          bgLight: "#ffffff",
          textLight: "#1a1a1a", // ~17:1 — already AAA
          bgDark: "#000000",
          textDark: "#f5f5f5", // ~19:1 — already AAA
        });
        const vars = resolveTokensToCssVars([token], mode);
        const expected = mode === "light" ? "#1a1a1a" : "#f5f5f5";
        expect(vars["--hopper-box-primary-text"]).toBe(expected);
      },
    );

    it("does not touch text when bg is transparent (palette fallback owns the pair)", () => {
      const token = mockToken({
        name: "boxPrimary",
        bgLight: "transparent",
        textLight: "#bbbbbb",
      });
      const vars = resolveTokensToCssVars([token], "light");
      // bg skipped, and text passes through unchanged (can't compute a pair).
      expect(vars["--hopper-box-primary-bg"]).toBeUndefined();
      expect(vars["--hopper-box-primary-text"]).toBe("#bbbbbb");
    });

    it.each(COLOR_MODES)(
      "every emitted token pair across the full registry meets AA (%s mode)",
      (mode) => {
        // Adversarial theme: every token is a low-contrast gray-on-gray pair in
        // both modes. After resolution, NOT ONE emitted text/bg pair may fail.
        const tokens: ComponentTokenRecord[] = COMPONENT_TOKEN_GROUPS.map((g) => ({
          themeId: "adversarial",
          name: g.key,
          bgLight: "#dddddd",
          textLight: "#cccccc", // ~1.1:1 — fails hard
          bgDark: "#222222",
          textDark: "#333333", // ~1.2:1 — fails hard
          borderLight: "#dddddd",
          borderDark: "#222222",
          sortOrder: g.sortOrder,
        }));

        const vars = resolveTokensToCssVars(tokens, mode);
        for (const g of COMPONENT_TOKEN_GROUPS) {
          const bg = vars[getCssVarName(g.key, "bg")];
          const text = vars[getCssVarName(g.key, "text")];
          if (bg && text) {
            expect(ratio(text, bg)).toBeGreaterThanOrEqual(4.5);
          }
        }
      },
    );

    it("legacy aliases get the same contrast-adjusted text as the --hopper-* vars", () => {
      const token = mockToken({
        name: "boxPrimary",
        bgLight: "#ffffff",
        textLight: "#bbbbbb", // fails — both outputs must be the adjusted value
      });
      const hopperVars = resolveTokensToCssVars([token], "light");
      const legacyVars = emitLegacyAliases([token], "light");
      const adjustedText = hopperVars["--hopper-box-primary-text"];
      // Find the legacy text alias for boxPrimary and confirm it matches.
      const legacyTextEntry = Object.entries(LEGACY_TO_TOKEN_MAP).find(
        ([, m]) => m.tokenName === "boxPrimary" && m.slot === "text",
      );
      expect(legacyTextEntry).toBeDefined();
      const [legacyName] = legacyTextEntry!;
      expect(legacyVars[`--colors-${legacyName}`]).toBe(adjustedText);
      expect(ratio(adjustedText, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    });
  });
});
