/** @jest-environment node */

/**
 * Integration tests for theme consumption flow.
 *
 * These tests simulate the real data flow: ComponentTokenRecords -> resolveTokensToCssVars
 * + emitLegacyAliases -> ThemeConsumptionPayload. They validate that the app receives
 * the minimum colors required to display a theme in both light and dark modes.
 */

import {
  resolveTokensToCssVars,
  emitLegacyAliases,
  buildDefaultTokenRecords,
  COMPONENT_TOKEN_GROUPS,
  LEGACY_TO_TOKEN_MAP,
  getCssVarName,
} from "../../src";
import type { ComponentTokenRecord, ThemeConsumptionPayload } from "../../src";

// ---------------------------------------------------------------------------
// Realistic theme data (simulates what would be stored in the DB)
// ---------------------------------------------------------------------------

function buildRealisticTheme(themeId: string): ComponentTokenRecord[] {
  return [
    // Box tokens
    { themeId, name: "boxMain", bgLight: "#fafafa", bgDark: "#121212", textLight: "#121212", textDark: "#fafafa", borderLight: "transparent", borderDark: "transparent", sortOrder: -1 },
    { themeId, name: "boxPrimary", bgLight: "#1565c0", bgDark: "#0d47a1", textLight: "#ffffff", textDark: "#e3f2fd", borderLight: "#0d47a1", borderDark: "#1565c0", sortOrder: 0 },
    { themeId, name: "boxSecondary", bgLight: "#c2185b", bgDark: "#880e4f", textLight: "#ffffff", textDark: "#fce4ec", borderLight: "#880e4f", borderDark: "#c2185b", sortOrder: 1 },
    { themeId, name: "boxAccent", bgLight: "#388e3c", bgDark: "#1b5e20", textLight: "#ffffff", textDark: "#e8f5e9", borderLight: "#1b5e20", borderDark: "#388e3c", sortOrder: 2 },

    // Button tokens
    { themeId, name: "buttonPrimary", bgLight: "#0d47a1", bgDark: "#1565c0", textLight: "#ffffff", textDark: "#ffffff", borderLight: "#0d47a1", borderDark: "#1565c0", sortOrder: 10 },
    { themeId, name: "buttonSecondary", bgLight: "#c2185b", bgDark: "#e91e63", textLight: "#ffffff", textDark: "#ffffff", borderLight: "#880e4f", borderDark: "#c2185b", sortOrder: 11 },
    { themeId, name: "buttonAccent", bgLight: "#388e3c", bgDark: "#4caf50", textLight: "#ffffff", textDark: "#ffffff", borderLight: "#1b5e20", borderDark: "#388e3c", sortOrder: 12 },
    { themeId, name: "buttonPrimaryHover", bgLight: "#1976d2", bgDark: "#2196f3", textLight: "#ffffff", textDark: "#ffffff", borderLight: "transparent", borderDark: "transparent", sortOrder: 13 },
    { themeId, name: "buttonSecondaryHover", bgLight: "#e91e63", bgDark: "#f06292", textLight: "#ffffff", textDark: "#ffffff", borderLight: "transparent", borderDark: "transparent", sortOrder: 14 },
    { themeId, name: "buttonAccentHover", bgLight: "#4caf50", bgDark: "#66bb6a", textLight: "#ffffff", textDark: "#000000", borderLight: "transparent", borderDark: "transparent", sortOrder: 15 },
    { themeId, name: "buttonPlain", bgLight: "#388e3c", bgDark: "#4caf50", textLight: "#c2185b", textDark: "#e91e63", borderLight: "transparent", borderDark: "transparent", sortOrder: 16 },

    // Arrow tokens
    { themeId, name: "arrowPrimary", bgLight: "#1565c0", bgDark: "#0d47a1", textLight: "transparent", textDark: "transparent", borderLight: "#c2185b", borderDark: "#880e4f", sortOrder: 20 },
    { themeId, name: "arrowSecondary", bgLight: "#c2185b", bgDark: "#880e4f", textLight: "transparent", textDark: "transparent", borderLight: "#388e3c", borderDark: "#1b5e20", sortOrder: 21 },
    { themeId, name: "arrowAccent", bgLight: "#388e3c", bgDark: "#1b5e20", textLight: "transparent", textDark: "transparent", borderLight: "#1565c0", borderDark: "#0d47a1", sortOrder: 22 },

    // Icon tokens
    { themeId, name: "iconPrimary", bgLight: "#fce4ec", bgDark: "#880e4f", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 30 },
    { themeId, name: "iconSecondary", bgLight: "#1b5e20", bgDark: "#388e3c", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 31 },
    { themeId, name: "iconAccent", bgLight: "#1b5e20", bgDark: "#388e3c", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 32 },
    { themeId, name: "iconPrimaryHover", bgLight: "#1565c0", bgDark: "#2196f3", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 33 },
    { themeId, name: "iconSecondaryHover", bgLight: "#1565c0", bgDark: "#2196f3", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 34 },
    { themeId, name: "iconAccentHover", bgLight: "#388e3c", bgDark: "#4caf50", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 35 },

    // Shadow tokens
    { themeId, name: "shadowPrimary", bgLight: "#1565c0", bgDark: "#0d47a1", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 40 },
    { themeId, name: "shadowSecondary", bgLight: "#c2185b", bgDark: "#880e4f", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 41 },
    { themeId, name: "shadowAccent", bgLight: "#388e3c", bgDark: "#1b5e20", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 42 },

    // Text tokens
    { themeId, name: "textPop", bgLight: "transparent", bgDark: "transparent", textLight: "#a5d6a7", textDark: "#66bb6a", borderLight: "transparent", borderDark: "transparent", sortOrder: 50 },
    { themeId, name: "textError", bgLight: "transparent", bgDark: "transparent", textLight: "#66bb6a", textDark: "#a5d6a7", borderLight: "transparent", borderDark: "transparent", sortOrder: 51 },
    { themeId, name: "textWarning", bgLight: "transparent", bgDark: "transparent", textLight: "#a5d6a7", textDark: "#66bb6a", borderLight: "transparent", borderDark: "transparent", sortOrder: 52 },

    // Title tokens
    { themeId, name: "titlePrimary", bgLight: "transparent", bgDark: "transparent", textLight: "#1565c0", textDark: "#2196f3", borderLight: "transparent", borderDark: "transparent", sortOrder: 55 },
    { themeId, name: "titleSecondary", bgLight: "transparent", bgDark: "transparent", textLight: "#c2185b", textDark: "#e91e63", borderLight: "transparent", borderDark: "transparent", sortOrder: 56 },
    { themeId, name: "titleAccent", bgLight: "transparent", bgDark: "transparent", textLight: "#1b5e20", textDark: "#388e3c", borderLight: "transparent", borderDark: "transparent", sortOrder: 57 },

    // Special tokens
    { themeId, name: "boxSearchProviders", bgLight: "#43a047", bgDark: "#1b5e20", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 60 },
    { themeId, name: "boxAIProviders", bgLight: "#43a047", bgDark: "#1b5e20", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 61 },
    { themeId, name: "boxInfo", bgLight: "#1565c0", bgDark: "#0d47a1", textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 62 },
  ];
}

/**
 * Build a ThemeConsumptionPayload (mirrors what the API returns).
 */
function buildPayload(
  tokens: ComponentTokenRecord[],
  colorMode: "light" | "dark",
): ThemeConsumptionPayload {
  return {
    themeId: tokens[0]?.themeId ?? "unknown",
    themeName: "Test Theme",
    cssVariables: resolveTokensToCssVars(tokens, colorMode),
    legacyVariables: emitLegacyAliases(tokens, colorMode),
    // Required by ThemeConsumptionPayload and previously omitted. It went
    // unnoticed because HopperGuard's tsconfig only included src/**, so the
    // test tier compiled under jest's transform but was never type-checked.
    paletteFallbacks: {},
    fonts: [],
  };
}

// ---------------------------------------------------------------------------
// Minimum required CSS variables for the UI to render
// ---------------------------------------------------------------------------

/** Core box background variables the UI must have. */
const REQUIRED_BOX_BG_VARS = [
  "--hopper-box-primary-bg",
  "--hopper-box-secondary-bg",
  "--hopper-box-accent-bg",
];

/** Core text variables the UI must have. */
const REQUIRED_TEXT_VARS = [
  "--hopper-box-primary-text",
  "--hopper-box-secondary-text",
  "--hopper-box-accent-text",
];

/** Core button variables the UI must have. */
const REQUIRED_BUTTON_VARS = [
  "--hopper-button-primary-bg",
  "--hopper-button-primary-text",
  "--hopper-button-secondary-bg",
  "--hopper-button-secondary-text",
  "--hopper-button-accent-bg",
  "--hopper-button-accent-text",
];

/** Core border variables. */
const REQUIRED_BORDER_VARS = [
  "--hopper-box-primary-border",
  "--hopper-box-secondary-border",
  "--hopper-box-accent-border",
];

const ALL_REQUIRED_VARS = [
  ...REQUIRED_BOX_BG_VARS,
  ...REQUIRED_TEXT_VARS,
  ...REQUIRED_BUTTON_VARS,
  ...REQUIRED_BORDER_VARS,
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Theme Consumption Integration", () => {
  const themeId = "integration-test-theme";
  const tokens = buildRealisticTheme(themeId);

  describe("Minimum colors for selected theme", () => {
    it("light mode payload contains all required CSS variables", () => {
      const payload = buildPayload(tokens, "light");

      for (const varName of ALL_REQUIRED_VARS) {
        expect(payload.cssVariables[varName]).toBeDefined();
        expect(payload.cssVariables[varName]).not.toBe("");
      }
    });

    it("dark mode payload contains all required CSS variables", () => {
      const payload = buildPayload(tokens, "dark");

      for (const varName of ALL_REQUIRED_VARS) {
        expect(payload.cssVariables[varName]).toBeDefined();
        expect(payload.cssVariables[varName]).not.toBe("");
      }
    });

    it("produces a CSS variable for every non-transparent token group + slot combination", () => {
      const payload = buildPayload(tokens, "light");

      // Groups with non-transparent values should produce vars
      for (const group of COMPONENT_TOKEN_GROUPS) {
        const token = tokens.find((t) => t.name === group.key)!;
        for (const slot of ["bg", "text", "border"] as const) {
          const cssVar = getCssVarName(group.key, slot);
          const value = slot === "bg" ? token.bgLight : slot === "text" ? token.textLight : token.borderLight;
          if (value && value !== "transparent") {
            expect(payload.cssVariables[cssVar]).toBeDefined();
          } else {
            expect(payload.cssVariables[cssVar]).toBeUndefined();
          }
        }
      }
    });

    it("cssVariables count equals number of non-transparent slots", () => {
      const payload = buildPayload(tokens, "light");
      // Count non-transparent light-mode slots in the realistic theme
      let nonTransparentCount = 0;
      for (const token of tokens) {
        if (token.bgLight && token.bgLight !== "transparent") nonTransparentCount++;
        if (token.textLight && token.textLight !== "transparent") nonTransparentCount++;
        if (token.borderLight && token.borderLight !== "transparent") nonTransparentCount++;
      }
      expect(Object.keys(payload.cssVariables).length).toBe(nonTransparentCount);
    });
  });

  describe("Light vs Dark mode color resolution", () => {
    it("light mode uses *Light fields from tokens", () => {
      const payload = buildPayload(tokens, "light");

      expect(payload.cssVariables["--hopper-box-primary-bg"]).toBe("#1565c0");
      expect(payload.cssVariables["--hopper-box-primary-text"]).toBe("#ffffff");
      expect(payload.cssVariables["--hopper-box-primary-border"]).toBe("#0d47a1");
    });

    it("dark mode uses *Dark fields from tokens", () => {
      const payload = buildPayload(tokens, "dark");

      expect(payload.cssVariables["--hopper-box-primary-bg"]).toBe("#0d47a1");
      expect(payload.cssVariables["--hopper-box-primary-text"]).toBe("#e3f2fd");
      expect(payload.cssVariables["--hopper-box-primary-border"]).toBe("#1565c0");
    });

    it("light and dark mode produce different values for box tokens", () => {
      const lightPayload = buildPayload(tokens, "light");
      const darkPayload = buildPayload(tokens, "dark");

      expect(lightPayload.cssVariables["--hopper-box-primary-bg"])
        .not.toBe(darkPayload.cssVariables["--hopper-box-primary-bg"]);
    });

    it("both modes produce the same number of CSS variables", () => {
      const lightPayload = buildPayload(tokens, "light");
      const darkPayload = buildPayload(tokens, "dark");

      expect(Object.keys(lightPayload.cssVariables).length)
        .toBe(Object.keys(darkPayload.cssVariables).length);
    });

    it("legacy variables also differ between light and dark modes", () => {
      const lightPayload = buildPayload(tokens, "light");
      const darkPayload = buildPayload(tokens, "dark");

      expect(lightPayload.legacyVariables["--colors-boxBgPrimary"])
        .not.toBe(darkPayload.legacyVariables["--colors-boxBgPrimary"]);
    });
  });

  describe("Legacy variable emission", () => {
    it("emits legacy --colors-* variables for mapped tokens with non-transparent values", () => {
      const payload = buildPayload(tokens, "light");

      // Build lookup of token values
      const tokenMap = new Map(tokens.map((t) => [t.name, t]));

      for (const [legacyName, { tokenName, slot }] of Object.entries(LEGACY_TO_TOKEN_MAP)) {
        const token = tokenMap.get(tokenName);
        if (!token) continue;
        const value = slot === "bg" ? token.bgLight : slot === "text" ? token.textLight : token.borderLight;
        if (value && value !== "transparent") {
          expect(payload.legacyVariables[`--colors-${legacyName}`]).toBeDefined();
        } else {
          expect(payload.legacyVariables[`--colors-${legacyName}`]).toBeUndefined();
        }
      }
    });

    it("legacy variables match corresponding --hopper-* values", () => {
      const payload = buildPayload(tokens, "light");

      // boxBgPrimary legacy should match --hopper-box-primary-bg
      expect(payload.legacyVariables["--colors-boxBgPrimary"])
        .toBe(payload.cssVariables["--hopper-box-primary-bg"]);

      // textPrimary legacy should match --hopper-box-primary-text
      expect(payload.legacyVariables["--colors-textPrimary"])
        .toBe(payload.cssVariables["--hopper-box-primary-text"]);
    });
  });

  describe("Default theme (all transparent) produces empty variable maps", () => {
    it("default tokens produce no CSS variables (transparent values are skipped)", () => {
      const defaults = buildDefaultTokenRecords("default-theme");
      const payload = buildPayload(defaults, "light");

      // All-transparent defaults should produce empty maps so the
      // var() fallback chain in semanticVariables.ts works correctly.
      expect(Object.keys(payload.cssVariables).length).toBe(0);
    });

    it("default tokens produce no legacy aliases (transparent values are skipped)", () => {
      const defaults = buildDefaultTokenRecords("default-theme");
      const payload = buildPayload(defaults, "light");

      expect(Object.keys(payload.legacyVariables).length).toBe(0);
    });
  });
});
