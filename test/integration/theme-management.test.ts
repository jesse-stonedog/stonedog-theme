/** @jest-environment node */

/**
 * Integration tests for theme management: creating themes, overriding tokens,
 * and verifying AAA contrast compliance.
 *
 * These tests simulate the full lifecycle of theme creation and modification,
 * using realistic data and validating WCAG AAA contrast requirements.
 */

import {
  buildDefaultTokenRecords,
  resolveTokensToCssVars,
  emitLegacyAliases,
  validateComponentTokenContrast,
  getContrastRatio,
  getWCAGLevel,
  analyzeContrast,
  adjustForContrast,
  findAAACompliantShade,
  COMPONENT_TOKEN_GROUPS,
} from "../../src";
import type { ComponentTokenRecord, ContrastPairResult } from "../../src";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate creating a new theme: build defaults then apply overrides.
 * This mirrors what the PUT /api/themes/[themeId]/tokens endpoint does.
 */
function createThemeWithOverrides(
  themeId: string,
  overrides: Array<{
    name: string;
    bgLight?: string;
    bgDark?: string;
    textLight?: string;
    textDark?: string;
    borderLight?: string;
    borderDark?: string;
  }>,
): ComponentTokenRecord[] {
  const defaults = buildDefaultTokenRecords(themeId);
  const tokenMap = new Map<string, ComponentTokenRecord>();

  for (const token of defaults) {
    tokenMap.set(token.name, { ...token });
  }

  for (const override of overrides) {
    const existing = tokenMap.get(override.name);
    if (!existing) continue;

    tokenMap.set(override.name, {
      ...existing,
      bgLight: override.bgLight ?? existing.bgLight,
      bgDark: override.bgDark ?? existing.bgDark,
      textLight: override.textLight ?? existing.textLight,
      textDark: override.textDark ?? existing.textDark,
      borderLight: override.borderLight ?? existing.borderLight,
      borderDark: override.borderDark ?? existing.borderDark,
    });
  }

  return Array.from(tokenMap.values());
}

/**
 * Check all bg/text pairs for AAA contrast compliance.
 * Returns an array of failing pairs.
 */
function checkAAACompliance(
  tokens: ComponentTokenRecord[],
  colorMode: "light" | "dark",
): Array<{ name: string; result: ContrastPairResult }> {
  const failures: Array<{ name: string; result: ContrastPairResult }> = [];

  for (const token of tokens) {
    const bg = colorMode === "light" ? token.bgLight : token.bgDark;
    const text = colorMode === "light" ? token.textLight : token.textDark;

    const result = validateComponentTokenContrast(bg, text);
    if (result && result.wcagLevel !== "AAA") {
      failures.push({ name: token.name, result });
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Theme Management Integration", () => {
  describe("Creating new themes", () => {
    it("buildDefaultTokenRecords creates a complete set for all 32 groups", () => {
      const tokens = buildDefaultTokenRecords("new-theme-123");
      expect(tokens.length).toBe(32);

      const tokenNames = tokens.map((t) => t.name);
      const groupKeys = COMPONENT_TOKEN_GROUPS.map((g) => g.key);
      expect(tokenNames).toEqual(groupKeys);
    });

    it("new theme with defaults resolves to empty CSS variable map (transparent skipped)", () => {
      const tokens = buildDefaultTokenRecords("new-theme");
      const vars = resolveTokensToCssVars(tokens, "light");

      // Transparent values are skipped so var() fallback chain works
      expect(Object.keys(vars).length).toBe(0);
    });

    it("new theme can be fully customized with overrides", () => {
      const tokens = createThemeWithOverrides("custom-theme", [
        {
          name: "boxPrimary",
          bgLight: "#1a237e",
          bgDark: "#0d1642",
          textLight: "#ffffff",
          textDark: "#e8eaf6",
          borderLight: "#283593",
          borderDark: "#1a237e",
        },
        {
          name: "buttonPrimary",
          bgLight: "#283593",
          bgDark: "#1a237e",
          textLight: "#ffffff",
          textDark: "#ffffff",
          borderLight: "#1a237e",
          borderDark: "#283593",
        },
      ]);

      const vars = resolveTokensToCssVars(tokens, "light");
      expect(vars["--hopper-box-primary-bg"]).toBe("#1a237e");
      expect(vars["--hopper-button-primary-bg"]).toBe("#283593");

      // Non-overridden tokens remain undefined (transparent is skipped)
      expect(vars["--hopper-box-secondary-bg"]).toBeUndefined();
    });
  });

  describe("Overriding themes", () => {
    it("partial overrides only affect specified slots", () => {
      const tokens = createThemeWithOverrides("override-test", [
        {
          name: "boxPrimary",
          bgLight: "#ff0000",
          // Only overriding bgLight, rest should remain transparent
        },
      ]);

      const boxPrimary = tokens.find((t) => t.name === "boxPrimary")!;
      expect(boxPrimary.bgLight).toBe("#ff0000");
      expect(boxPrimary.bgDark).toBe("transparent");
      expect(boxPrimary.textLight).toBe("transparent");
      expect(boxPrimary.borderLight).toBe("transparent");
    });

    it("overrides can target light and dark modes independently", () => {
      const tokens = createThemeWithOverrides("mode-test", [
        {
          name: "boxPrimary",
          bgLight: "#ffffff",
          bgDark: "#000000",
          textLight: "#000000",
          textDark: "#ffffff",
        },
      ]);

      const lightVars = resolveTokensToCssVars(tokens, "light");
      const darkVars = resolveTokensToCssVars(tokens, "dark");

      expect(lightVars["--hopper-box-primary-bg"]).toBe("#ffffff");
      expect(darkVars["--hopper-box-primary-bg"]).toBe("#000000");
      expect(lightVars["--hopper-box-primary-text"]).toBe("#000000");
      expect(darkVars["--hopper-box-primary-text"]).toBe("#ffffff");
    });

    it("multiple overrides can be applied at once", () => {
      const tokens = createThemeWithOverrides("multi-override", [
        { name: "boxPrimary", bgLight: "#111111" },
        { name: "boxSecondary", bgLight: "#222222" },
        { name: "boxAccent", bgLight: "#333333" },
        { name: "buttonPrimary", bgLight: "#444444" },
      ]);

      const vars = resolveTokensToCssVars(tokens, "light");
      expect(vars["--hopper-box-primary-bg"]).toBe("#111111");
      expect(vars["--hopper-box-secondary-bg"]).toBe("#222222");
      expect(vars["--hopper-box-accent-bg"]).toBe("#333333");
      expect(vars["--hopper-button-primary-bg"]).toBe("#444444");
    });

    it("overriding with invalid token name has no effect", () => {
      const tokens = createThemeWithOverrides("invalid-name-test", [
        { name: "nonExistentToken", bgLight: "#ff0000" },
      ]);

      // All tokens should remain at defaults (transparent)
      for (const token of tokens) {
        expect(token.bgLight).toBe("transparent");
      }
    });

    it("legacy variables update when tokens are overridden", () => {
      const tokens = createThemeWithOverrides("legacy-update-test", [
        {
          name: "boxPrimary",
          bgLight: "#abcdef",
          textLight: "#123456",
        },
        {
          // borderBgPrimary is shared between boxPrimary and buttonPrimary;
          // the last-written group (buttonPrimary) wins in the legacy map,
          // so we must override buttonPrimary's border to see it in legacy vars.
          name: "buttonPrimary",
          borderLight: "#654321",
        },
      ]);

      const legacyVars = emitLegacyAliases(tokens, "light");
      expect(legacyVars["--colors-boxBgPrimary"]).toBe("#abcdef");
      expect(legacyVars["--colors-textPrimary"]).toBe("#123456");
      expect(legacyVars["--colors-borderBgPrimary"]).toBe("#654321");
    });
  });

  describe("AAA Contrast Validation", () => {
    it("black text on white background passes AAA", () => {
      const result = validateComponentTokenContrast("#ffffff", "#000000");
      expect(result).not.toBeNull();
      expect(result!.wcagLevel).toBe("AAA");
      expect(result!.ratio).toBeGreaterThanOrEqual(7);
    });

    it("white text on dark blue background passes AAA", () => {
      const result = validateComponentTokenContrast("#0d47a1", "#ffffff");
      expect(result).not.toBeNull();
      expect(result!.wcagLevel).toBe("AAA");
    });

    it("gray text on white background may fail AAA", () => {
      const result = validateComponentTokenContrast("#ffffff", "#999999");
      expect(result).not.toBeNull();
      // #999999 on white = ~2.85:1, fails even AA
      expect(result!.wcagLevel).toBe("Fail");
    });

    it("full AAA-compliant theme passes all bg/text pair checks", () => {
      // Build a theme specifically designed for AAA compliance
      const aaaTheme = createThemeWithOverrides("aaa-theme", [
        { name: "boxPrimary", bgLight: "#1a237e", bgDark: "#e8eaf6", textLight: "#ffffff", textDark: "#000000", borderLight: "#000000", borderDark: "#ffffff" },
        { name: "boxSecondary", bgLight: "#880e4f", bgDark: "#fce4ec", textLight: "#ffffff", textDark: "#000000", borderLight: "#000000", borderDark: "#ffffff" },
        { name: "boxAccent", bgLight: "#1b5e20", bgDark: "#e8f5e9", textLight: "#ffffff", textDark: "#000000", borderLight: "#000000", borderDark: "#ffffff" },
        { name: "buttonPrimary", bgLight: "#0d47a1", bgDark: "#e3f2fd", textLight: "#ffffff", textDark: "#000000", borderLight: "#000000", borderDark: "#ffffff" },
        { name: "buttonSecondary", bgLight: "#880e4f", bgDark: "#fce4ec", textLight: "#ffffff", textDark: "#000000", borderLight: "#000000", borderDark: "#ffffff" },
        { name: "buttonAccent", bgLight: "#1b5e20", bgDark: "#e8f5e9", textLight: "#ffffff", textDark: "#000000", borderLight: "#000000", borderDark: "#ffffff" },
        { name: "buttonPrimaryHover", bgLight: "#0d47a1", bgDark: "#e3f2fd", textLight: "#ffffff", textDark: "#000000" },
        { name: "buttonSecondaryHover", bgLight: "#880e4f", bgDark: "#fce4ec", textLight: "#ffffff", textDark: "#000000" },
        { name: "buttonAccentHover", bgLight: "#1b5e20", bgDark: "#e8f5e9", textLight: "#ffffff", textDark: "#000000" },
        { name: "buttonPlain", bgLight: "#1b5e20", bgDark: "#e8f5e9", textLight: "#ffffff", textDark: "#000000" },
      ]);

      const lightFailures = checkAAACompliance(aaaTheme, "light");
      const darkFailures = checkAAACompliance(aaaTheme, "dark");

      // Filter out tokens with transparent bg/text (those can't be checked)
      const meaningfulLightFailures = lightFailures.filter(
        (f) => f.result.bg !== "transparent" && f.result.text !== "transparent",
      );
      const meaningfulDarkFailures = darkFailures.filter(
        (f) => f.result.bg !== "transparent" && f.result.text !== "transparent",
      );

      expect(meaningfulLightFailures).toEqual([]);
      expect(meaningfulDarkFailures).toEqual([]);
    });

    it("detects AAA failures in a poorly-designed theme", () => {
      const badTheme = createThemeWithOverrides("bad-theme", [
        {
          name: "boxPrimary",
          bgLight: "#cccccc",
          textLight: "#dddddd", // Very low contrast
        },
      ]);

      const failures = checkAAACompliance(badTheme, "light");
      const boxFailure = failures.find((f) => f.name === "boxPrimary");
      expect(boxFailure).toBeDefined();
      expect(boxFailure!.result.wcagLevel).toBe("Fail");
    });

    it("adjustForContrast can fix a failing pair to meet AAA", () => {
      const bg = "#ffffff";
      const badFg = "#aaaaaa"; // Low contrast against white

      const analysis = analyzeContrast(badFg, bg);
      expect(analysis.passes.aaaNormalText).toBe(false);

      const adjusted = adjustForContrast(badFg, bg, 7);
      const newRatio = getContrastRatio(adjusted, bg);
      expect(newRatio).toBeGreaterThanOrEqual(7);
      expect(getWCAGLevel(newRatio)).toBe("AAA");
    });

    it("findAAACompliantShade returns a shade meeting AAA on dark bg", () => {
      const darkBg = "#1a237e";
      const palette = [
        { shade: "50", hexValue: "#e8eaf6" },
        { shade: "100", hexValue: "#c5cae9" },
        { shade: "200", hexValue: "#9fa8da" },
        { shade: "300", hexValue: "#7986cb" },
        { shade: "400", hexValue: "#5c6bc0" },
        { shade: "500", hexValue: "#3f51b5" },
        { shade: "700", hexValue: "#303f9f" },
        { shade: "900", hexValue: "#1a237e" },
      ];

      const compliant = findAAACompliantShade(darkBg, palette);
      expect(compliant).not.toBeNull();

      const ratio = getContrastRatio(darkBg, compliant!.hexValue);
      expect(ratio).toBeGreaterThanOrEqual(7);
    });

    it("findAAACompliantShade returns a shade meeting AAA on light bg", () => {
      const lightBg = "#ffffff";
      const palette = [
        { shade: "50", hexValue: "#e8eaf6" },
        { shade: "100", hexValue: "#c5cae9" },
        { shade: "500", hexValue: "#3f51b5" },
        { shade: "700", hexValue: "#303f9f" },
        { shade: "900", hexValue: "#1a237e" },
      ];

      const compliant = findAAACompliantShade(lightBg, palette);
      expect(compliant).not.toBeNull();

      const ratio = getContrastRatio(lightBg, compliant!.hexValue);
      expect(ratio).toBeGreaterThanOrEqual(7);
    });

    it("validates all token bg/text pairs for a realistic AAA theme", () => {
      // A carefully designed AAA-compliant theme
      // All bg/text pairs must have contrast ratio >= 7:1
      const tokens: ComponentTokenRecord[] = [
        { themeId: "aaa", name: "boxPrimary", bgLight: "#0d47a1", bgDark: "#e3f2fd", textLight: "#ffffff", textDark: "#000000", borderLight: "#ffffff", borderDark: "#000000", sortOrder: 0 },
        { themeId: "aaa", name: "boxSecondary", bgLight: "#880e4f", bgDark: "#fce4ec", textLight: "#ffffff", textDark: "#000000", borderLight: "#ffffff", borderDark: "#000000", sortOrder: 1 },
        { themeId: "aaa", name: "boxAccent", bgLight: "#1b5e20", bgDark: "#e8f5e9", textLight: "#ffffff", textDark: "#000000", borderLight: "#ffffff", borderDark: "#000000", sortOrder: 2 },
      ];

      for (const token of tokens) {
        // Light mode
        const lightResult = validateComponentTokenContrast(token.bgLight, token.textLight);
        if (lightResult) {
          expect(lightResult.wcagLevel).toBe("AAA");
          expect(lightResult.ratio).toBeGreaterThanOrEqual(7);
        }

        // Dark mode
        const darkResult = validateComponentTokenContrast(token.bgDark, token.textDark);
        if (darkResult) {
          expect(darkResult.wcagLevel).toBe("AAA");
          expect(darkResult.ratio).toBeGreaterThanOrEqual(7);
        }
      }
    });

    it("contrast check is symmetric - order of bg/text doesn't affect ratio", () => {
      const ratio1 = getContrastRatio("#0d47a1", "#ffffff");
      const ratio2 = getContrastRatio("#ffffff", "#0d47a1");
      expect(ratio1).toBeCloseTo(ratio2, 5);
    });
  });
});
