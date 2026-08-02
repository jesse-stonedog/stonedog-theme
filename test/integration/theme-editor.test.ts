/** @jest-environment node */

/**
 * Integration tests for the ThemeEditor data flow.
 *
 * These tests validate that:
 * 1. ThemeTokenEditor can look up ComponentToken records by COMPONENT_TOKEN_GROUPS keys
 *    (i.e. "boxPrimary" not legacy "boxBgPrimary") and display hex values, not "Not set".
 * 2. ColorPaletteViewer can resolve hex colors from resolveTokensToCssVars output
 *    instead of parsing legacy CSS var references.
 * 3. Multiple themes all produce the required --hopper-* CSS variables.
 */

import {
  resolveTokensToCssVars,
  COMPONENT_TOKEN_GROUPS,
} from "../../src";
import type { ComponentTokenRecord } from "../../src";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a full 28-token set for a theme using provided hex palettes.
 */
function buildThemeTokens(
  themeId: string,
  colors: {
    primaryBg: string;
    primaryText: string;
    primaryBorder: string;
    secondaryBg: string;
    secondaryText: string;
    secondaryBorder: string;
    accentBg: string;
    accentText: string;
    accentBorder: string;
  },
): ComponentTokenRecord[] {
  const p = colors;
  return [
    // Box
    { themeId, name: "boxMain", bgLight: "#fafafa", bgDark: "#121212", textLight: "#121212", textDark: "#fafafa", borderLight: "transparent", borderDark: "transparent", sortOrder: -1 },
    { themeId, name: "boxPrimary", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: p.primaryText, textDark: p.primaryText, borderLight: p.primaryBorder, borderDark: p.primaryBorder, sortOrder: 0 },
    { themeId, name: "boxSecondary", bgLight: p.secondaryBg, bgDark: p.secondaryBg, textLight: p.secondaryText, textDark: p.secondaryText, borderLight: p.secondaryBorder, borderDark: p.secondaryBorder, sortOrder: 1 },
    { themeId, name: "boxAccent", bgLight: p.accentBg, bgDark: p.accentBg, textLight: p.accentText, textDark: p.accentText, borderLight: p.accentBorder, borderDark: p.accentBorder, sortOrder: 2 },
    // Button
    { themeId, name: "buttonPrimary", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: p.primaryText, textDark: p.primaryText, borderLight: p.primaryBorder, borderDark: p.primaryBorder, sortOrder: 10 },
    { themeId, name: "buttonSecondary", bgLight: p.secondaryBg, bgDark: p.secondaryBg, textLight: p.secondaryText, textDark: p.secondaryText, borderLight: p.secondaryBorder, borderDark: p.secondaryBorder, sortOrder: 11 },
    { themeId, name: "buttonAccent", bgLight: p.accentBg, bgDark: p.accentBg, textLight: p.accentText, textDark: p.accentText, borderLight: p.accentBorder, borderDark: p.accentBorder, sortOrder: 12 },
    { themeId, name: "buttonPrimaryHover", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: p.primaryText, textDark: p.primaryText, borderLight: "transparent", borderDark: "transparent", sortOrder: 13 },
    { themeId, name: "buttonSecondaryHover", bgLight: p.secondaryBg, bgDark: p.secondaryBg, textLight: p.secondaryText, textDark: p.secondaryText, borderLight: "transparent", borderDark: "transparent", sortOrder: 14 },
    { themeId, name: "buttonAccentHover", bgLight: p.accentBg, bgDark: p.accentBg, textLight: p.accentText, textDark: p.accentText, borderLight: "transparent", borderDark: "transparent", sortOrder: 15 },
    { themeId, name: "buttonPlain", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: p.primaryText, textDark: p.primaryText, borderLight: "transparent", borderDark: "transparent", sortOrder: 16 },
    // Arrow
    { themeId, name: "arrowPrimary", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: "transparent", textDark: "transparent", borderLight: p.primaryBorder, borderDark: p.primaryBorder, sortOrder: 20 },
    { themeId, name: "arrowSecondary", bgLight: p.secondaryBg, bgDark: p.secondaryBg, textLight: "transparent", textDark: "transparent", borderLight: p.secondaryBorder, borderDark: p.secondaryBorder, sortOrder: 21 },
    { themeId, name: "arrowAccent", bgLight: p.accentBg, bgDark: p.accentBg, textLight: "transparent", textDark: "transparent", borderLight: p.accentBorder, borderDark: p.accentBorder, sortOrder: 22 },
    // Icon
    { themeId, name: "iconPrimary", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 30 },
    { themeId, name: "iconSecondary", bgLight: p.secondaryBg, bgDark: p.secondaryBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 31 },
    { themeId, name: "iconAccent", bgLight: p.accentBg, bgDark: p.accentBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 32 },
    { themeId, name: "iconPrimaryHover", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 33 },
    { themeId, name: "iconSecondaryHover", bgLight: p.secondaryBg, bgDark: p.secondaryBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 34 },
    { themeId, name: "iconAccentHover", bgLight: p.accentBg, bgDark: p.accentBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 35 },
    // Shadow
    { themeId, name: "shadowPrimary", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 40 },
    { themeId, name: "shadowSecondary", bgLight: p.secondaryBg, bgDark: p.secondaryBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 41 },
    { themeId, name: "shadowAccent", bgLight: p.accentBg, bgDark: p.accentBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 42 },
    // Text
    { themeId, name: "textPop", bgLight: "transparent", bgDark: "transparent", textLight: p.accentText, textDark: p.accentText, borderLight: "transparent", borderDark: "transparent", sortOrder: 50 },
    { themeId, name: "textError", bgLight: "transparent", bgDark: "transparent", textLight: "#dc3545", textDark: "#ff6b6b", borderLight: "transparent", borderDark: "transparent", sortOrder: 51 },
    { themeId, name: "textWarning", bgLight: "transparent", bgDark: "transparent", textLight: "#ffc107", textDark: "#ffdd57", borderLight: "transparent", borderDark: "transparent", sortOrder: 52 },
    // Title
    { themeId, name: "titlePrimary", bgLight: "transparent", bgDark: "transparent", textLight: p.primaryText, textDark: p.primaryText, borderLight: "transparent", borderDark: "transparent", sortOrder: 55 },
    { themeId, name: "titleSecondary", bgLight: "transparent", bgDark: "transparent", textLight: p.secondaryText, textDark: p.secondaryText, borderLight: "transparent", borderDark: "transparent", sortOrder: 56 },
    { themeId, name: "titleAccent", bgLight: "transparent", bgDark: "transparent", textLight: p.accentText, textDark: p.accentText, borderLight: "transparent", borderDark: "transparent", sortOrder: 57 },
    // Special
    { themeId, name: "boxSearchProviders", bgLight: p.accentBg, bgDark: p.accentBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 60 },
    { themeId, name: "boxAIProviders", bgLight: p.secondaryBg, bgDark: p.secondaryBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 61 },
    { themeId, name: "boxInfo", bgLight: p.primaryBg, bgDark: p.primaryBg, textLight: "transparent", textDark: "transparent", borderLight: "transparent", borderDark: "transparent", sortOrder: 62 },
  ];
}

const HEX_REGEX = /^#[0-9a-fA-F]{3,6}$/;

// ---------------------------------------------------------------------------
// Theme fixtures
// ---------------------------------------------------------------------------

const themeFixtures = [
  {
    name: "Blue Corporate",
    themeId: "blue-corp",
    colors: {
      primaryBg: "#1565c0",
      primaryText: "#ffffff",
      primaryBorder: "#0d47a1",
      secondaryBg: "#c2185b",
      secondaryText: "#ffffff",
      secondaryBorder: "#880e4f",
      accentBg: "#388e3c",
      accentText: "#ffffff",
      accentBorder: "#1b5e20",
    },
  },
  {
    name: "Pink Brand",
    themeId: "pink-brand",
    colors: {
      primaryBg: "#e91e63",
      primaryText: "#ffffff",
      primaryBorder: "#c2185b",
      secondaryBg: "#9c27b0",
      secondaryText: "#ffffff",
      secondaryBorder: "#7b1fa2",
      accentBg: "#ff5722",
      accentText: "#ffffff",
      accentBorder: "#e64a19",
    },
  },
  {
    name: "Green Nature",
    themeId: "green-nature",
    colors: {
      primaryBg: "#2e7d32",
      primaryText: "#ffffff",
      primaryBorder: "#1b5e20",
      secondaryBg: "#558b2f",
      secondaryText: "#ffffff",
      secondaryBorder: "#33691e",
      accentBg: "#00897b",
      accentText: "#ffffff",
      accentBorder: "#00695c",
    },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThemeEditor Data Flow Integration", () => {

  describe("Test 1: ThemeTokenEditor data flow - Box Primary not 'Not set'", () => {
    it("ComponentToken lookup by COMPONENT_TOKEN_GROUPS key returns hex values", () => {
      const tokens = buildThemeTokens("test-theme", themeFixtures[0].colors);

      // Build the same lookup map that the refactored ThemeTokenEditor uses
      const tokenMap: Record<string, ComponentTokenRecord> = {};
      for (const token of tokens) {
        tokenMap[token.name] = token;
      }

      // The key used in COMPONENT_TOKEN_GROUPS is "boxPrimary" (NOT "boxBgPrimary")
      const boxPrimaryGroup = COMPONENT_TOKEN_GROUPS.find((g) => g.key === "boxPrimary");
      expect(boxPrimaryGroup).toBeDefined();

      const lookedUp = tokenMap[boxPrimaryGroup!.key];
      expect(lookedUp).toBeDefined();
      expect(lookedUp.bgLight).toMatch(HEX_REGEX);
      expect(lookedUp.bgDark).toMatch(HEX_REGEX);
      expect(lookedUp.textLight).toMatch(HEX_REGEX);
      expect(lookedUp.textDark).toMatch(HEX_REGEX);
      expect(lookedUp.borderLight).toMatch(HEX_REGEX);
      expect(lookedUp.borderDark).toMatch(HEX_REGEX);

      // Specifically verify values are NOT "transparent"
      expect(lookedUp.bgLight).not.toBe("transparent");
      expect(lookedUp.textLight).not.toBe("transparent");
    });

    it("all COMPONENT_TOKEN_GROUPS keys have matching token records", () => {
      const tokens = buildThemeTokens("test-theme", themeFixtures[0].colors);

      const tokenMap: Record<string, ComponentTokenRecord> = {};
      for (const token of tokens) {
        tokenMap[token.name] = token;
      }

      for (const group of COMPONENT_TOKEN_GROUPS) {
        expect(tokenMap[group.key]).toBeDefined();
      }
    });
  });

  describe("Test 2: ColorPaletteViewer data flow - Box Background Primary not 'Not resolved'", () => {
    it("resolveTokensToCssVars produces --hopper-box-primary-bg with a hex value", () => {
      const tokens = buildThemeTokens("test-theme", themeFixtures[0].colors);

      const cssVars = resolveTokensToCssVars(tokens, "light");

      expect(cssVars["--hopper-box-primary-bg"]).toBeDefined();
      expect(cssVars["--hopper-box-primary-bg"]).toMatch(HEX_REGEX);
    });

    it("resolveTokensToCssVars produces --hopper-box-primary-text with a hex value", () => {
      const tokens = buildThemeTokens("test-theme", themeFixtures[0].colors);

      const cssVars = resolveTokensToCssVars(tokens, "light");

      expect(cssVars["--hopper-box-primary-text"]).toBeDefined();
      expect(cssVars["--hopper-box-primary-text"]).toMatch(HEX_REGEX);
    });

    it("dark mode also produces valid hex values", () => {
      const tokens = buildThemeTokens("test-theme", themeFixtures[0].colors);

      const cssVars = resolveTokensToCssVars(tokens, "dark");

      expect(cssVars["--hopper-box-primary-bg"]).toBeDefined();
      expect(cssVars["--hopper-box-primary-bg"]).toMatch(HEX_REGEX);
      expect(cssVars["--hopper-box-primary-text"]).toBeDefined();
      expect(cssVars["--hopper-box-primary-text"]).toMatch(HEX_REGEX);
    });
  });

  describe("Test 3: Parameterized multi-theme css-vars test", () => {
    const REQUIRED_VARS = [
      "--hopper-box-primary-bg",
      "--hopper-box-primary-text",
      "--hopper-box-secondary-bg",
      "--hopper-box-secondary-text",
      "--hopper-box-accent-bg",
      "--hopper-box-accent-text",
    ];

    it.each(themeFixtures)(
      "$name (light mode) produces all 6 required variables",
      (fixture) => {
        const tokens = buildThemeTokens(fixture.themeId, fixture.colors);
        const cssVars = resolveTokensToCssVars(tokens, "light");

        for (const varName of REQUIRED_VARS) {
          expect(cssVars[varName]).toBeDefined();
          expect(cssVars[varName]).toMatch(HEX_REGEX);
        }
      },
    );

    it.each(themeFixtures)(
      "$name (dark mode) produces all 6 required variables",
      (fixture) => {
        const tokens = buildThemeTokens(fixture.themeId, fixture.colors);
        const cssVars = resolveTokensToCssVars(tokens, "dark");

        for (const varName of REQUIRED_VARS) {
          expect(cssVars[varName]).toBeDefined();
          expect(cssVars[varName]).toMatch(HEX_REGEX);
        }
      },
    );

    it.each(themeFixtures)(
      "$name produces correct hex values from input colors",
      (fixture) => {
        const tokens = buildThemeTokens(fixture.themeId, fixture.colors);
        const cssVars = resolveTokensToCssVars(tokens, "light");

        expect(cssVars["--hopper-box-primary-bg"]).toBe(fixture.colors.primaryBg);
        expect(cssVars["--hopper-box-primary-text"]).toBe(fixture.colors.primaryText);
        expect(cssVars["--hopper-box-secondary-bg"]).toBe(fixture.colors.secondaryBg);
        expect(cssVars["--hopper-box-accent-bg"]).toBe(fixture.colors.accentBg);
      },
    );
  });
});
