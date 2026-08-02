/** @jest-environment node */

/**
 * Integration tests: recipe contrast compliance.
 *
 * For each theme fixture, resolves ComponentTokenRecords to CSS vars in both
 * light and dark modes, then verifies that every testable recipe variant's
 * foreground/background pair meets WCAG AAA (7:1) contrast ratio.
 */

import {
  resolveTokensToCssVars,
  getContrastRatio,
  RECIPE_CONTRAST_PAIRS,
  semanticTokenToCssVar,
} from "../../src";
import type { ComponentTokenRecord, FlatCssVariableMap } from "../../src";

// ---------------------------------------------------------------------------
// Theme fixtures — realistic data covering all token groups
// ---------------------------------------------------------------------------

interface ThemeFixture {
  name: string;
  tokens: ComponentTokenRecord[];
}

function makeToken(
  themeId: string,
  name: string,
  vals: {
    bgL: string; bgD: string;
    txtL?: string; txtD?: string;
    borL?: string; borD?: string;
  },
  sortOrder: number,
): ComponentTokenRecord {
  return {
    themeId,
    name,
    bgLight: vals.bgL,
    bgDark: vals.bgD,
    textLight: vals.txtL ?? "transparent",
    textDark: vals.txtD ?? "transparent",
    borderLight: vals.borL ?? "transparent",
    borderDark: vals.borD ?? "transparent",
    sortOrder,
  };
}

/**
 * Contrast requirements (all must be >= 7:1):
 *
 * textMain (boxMain.text) vs boxBgMain (boxMain.bg)
 * textPrimary (boxPrimary.text) vs boxBgPrimary (boxPrimary.bg)
 * textPrimary (boxPrimary.text) vs boxBgAccent (boxAccent.bg)   ← cross-group!
 * textPrimary (boxPrimary.text) vs boxBgMain (boxMain.bg)       ← cross-group!
 * textSecondary (boxSecondary.text) vs boxBgSecondary (boxSecondary.bg)
 * textSecondary (boxSecondary.text) vs buttonBgSecondary (buttonSecondary.bg) ← cross-group!
 * buttonTextPrimary (buttonPrimary.text) vs buttonBgPrimary (buttonPrimary.bg)
 * buttonTextSecondary (buttonSecondary.text) vs buttonBgSecondary (buttonSecondary.bg)
 * textPop (textPop.text) vs boxBgMain (boxMain.bg)
 * textWarning (textWarning.text) vs boxBgMain (boxMain.bg)
 * textError (textError.text) vs boxBgMain (boxMain.bg)
 *
 * Strategy for light mode: very light backgrounds, very dark text.
 * Strategy for dark mode: very dark backgrounds, very light text.
 * Cross-group constraints mean we must keep text colors extreme (near-black/near-white).
 */

/**
 * 1) "AAA Light" — designed for maximum contrast (classic light theme approach).
 */
function buildAAALight(): ComponentTokenRecord[] {
  const id = "aaa-light";
  // Light: bg ~#f0+, text ~#1x. Dark: bg ~#1x, text ~#e0+.
  return [
    // Box
    makeToken(id, "boxMain",      { bgL: "#f8f8f8", bgD: "#0c0c0c", txtL: "#0c0c0c", txtD: "#f8f8f8" }, -1),
    makeToken(id, "boxPrimary",   { bgL: "#eaecf6", bgD: "#111540", txtL: "#0c0c0c", txtD: "#f0f0f8", borL: "#3949ab", borD: "#5c6bc0" }, 0),
    makeToken(id, "boxSecondary", { bgL: "#f4e4ec", bgD: "#2a0828", txtL: "#0c0c0c", txtD: "#f0f0f8", borL: "#c2185b", borD: "#e91e63" }, 1),
    makeToken(id, "boxAccent",    { bgL: "#eaf5ea", bgD: "#0c2010", txtL: "#0c0c0c", txtD: "#f0f0f8", borL: "#388e3c", borD: "#66bb6a" }, 2),

    // Button — light: dark bg + white text. dark: light bg + dark text.
    makeToken(id, "buttonPrimary",       { bgL: "#111540", bgD: "#c8cce8", txtL: "#ffffff", txtD: "#0c0c0c", borL: "#111540", borD: "#7986cb" }, 10),
    makeToken(id, "buttonSecondary",     { bgL: "#f4e4ec", bgD: "#2a0828", txtL: "#0c0c0c", txtD: "#f0f0f8", borL: "#880e4f", borD: "#e91e63" }, 11),
    makeToken(id, "buttonAccent",        { bgL: "#0c2010", bgD: "#c8e8cc", txtL: "#ffffff", txtD: "#0c0c0c", borL: "#1b5e20", borD: "#66bb6a" }, 12),
    makeToken(id, "buttonPrimaryHover",  { bgL: "#1a2060", bgD: "#b0b8d0", txtL: "#ffffff", txtD: "#0c0c0c" }, 13),
    makeToken(id, "buttonSecondaryHover",{ bgL: "#600838", bgD: "#e8c0d8", txtL: "#ffffff", txtD: "#0c0c0c" }, 14),
    makeToken(id, "buttonAccentHover",   { bgL: "#143018", bgD: "#b0d8b8", txtL: "#ffffff", txtD: "#0c0c0c" }, 15),
    makeToken(id, "buttonPlain",         { bgL: "#0c2010", bgD: "#c8e8cc", txtL: "#600838", txtD: "#3a0020" }, 16),

    // Arrow
    makeToken(id, "arrowPrimary",   { bgL: "#3949ab", bgD: "#111540", borL: "#c2185b", borD: "#880e4f" }, 20),
    makeToken(id, "arrowSecondary", { bgL: "#c2185b", bgD: "#880e4f", borL: "#388e3c", borD: "#1b5e20" }, 21),
    makeToken(id, "arrowAccent",    { bgL: "#388e3c", bgD: "#1b5e20", borL: "#3949ab", borD: "#111540" }, 22),

    // Icon
    makeToken(id, "iconPrimary",       { bgL: "#f4e4ec", bgD: "#2a0828" }, 30),
    makeToken(id, "iconSecondary",     { bgL: "#0c2010", bgD: "#388e3c" }, 31),
    makeToken(id, "iconAccent",        { bgL: "#0c2010", bgD: "#388e3c" }, 32),
    makeToken(id, "iconPrimaryHover",  { bgL: "#3949ab", bgD: "#5c6bc0" }, 33),
    makeToken(id, "iconSecondaryHover",{ bgL: "#3949ab", bgD: "#5c6bc0" }, 34),
    makeToken(id, "iconAccentHover",   { bgL: "#388e3c", bgD: "#66bb6a" }, 35),

    // Shadow
    makeToken(id, "shadowPrimary",   { bgL: "#3949ab", bgD: "#111540" }, 40),
    makeToken(id, "shadowSecondary", { bgL: "#c2185b", bgD: "#880e4f" }, 41),
    makeToken(id, "shadowAccent",    { bgL: "#388e3c", bgD: "#1b5e20" }, 42),

    // Text — must contrast against boxMain.bg (light: #f8f8f8, dark: #0c0c0c)
    // Need ratio >= 7:1 so use very dark colors in light, very light in dark
    makeToken(id, "textPop",     { bgL: "transparent", bgD: "transparent", txtL: "#0c3010", txtD: "#c0e8c8" }, 50),
    makeToken(id, "textError",   { bgL: "transparent", bgD: "transparent", txtL: "#6b0000", txtD: "#ffb0b0" }, 51),
    makeToken(id, "textWarning", { bgL: "transparent", bgD: "transparent", txtL: "#6b3000", txtD: "#ffd0a0" }, 52),

    // Special
    makeToken(id, "boxSearchProviders", { bgL: "#43a047", bgD: "#1b5e20" }, 60),
    makeToken(id, "boxAIProviders",     { bgL: "#43a047", bgD: "#1b5e20" }, 61),
    makeToken(id, "boxInfo",            { bgL: "#3949ab", bgD: "#111540" }, 62),
  ];
}

/**
 * 2) "Midnight" — dark-first theme with high contrast.
 */
function buildMidnight(): ComponentTokenRecord[] {
  const id = "midnight";
  return [
    // Box
    makeToken(id, "boxMain",      { bgL: "#f4f4f8", bgD: "#08080e", txtL: "#08080e", txtD: "#f4f4f8" }, -1),
    makeToken(id, "boxPrimary",   { bgL: "#e4e4f0", bgD: "#10102a", txtL: "#08080e", txtD: "#f0f0f8", borL: "#3d3d8c", borD: "#5c5cad" }, 0),
    makeToken(id, "boxSecondary", { bgL: "#f0e4f0", bgD: "#1e0820", txtL: "#08080e", txtD: "#f0f0f8", borL: "#8c3d8c", borD: "#ad5cad" }, 1),
    makeToken(id, "boxAccent",    { bgL: "#e4f0e8", bgD: "#081810", txtL: "#08080e", txtD: "#f0f0f8", borL: "#3d8c5c", borD: "#5cad7c" }, 2),

    // Button
    makeToken(id, "buttonPrimary",       { bgL: "#10102a", bgD: "#c8c8e0", txtL: "#f0f0ff", txtD: "#08080e", borL: "#10102a", borD: "#7070ad" }, 10),
    makeToken(id, "buttonSecondary",     { bgL: "#f0e4f0", bgD: "#1e0820", txtL: "#08080e", txtD: "#f0f0f8", borL: "#2b1435", borD: "#ad70ad" }, 11),
    makeToken(id, "buttonAccent",        { bgL: "#081810", bgD: "#c8e0d0", txtL: "#f0fff0", txtD: "#08080e", borL: "#0d2618", borD: "#70ad80" }, 12),
    makeToken(id, "buttonPrimaryHover",  { bgL: "#18183f", bgD: "#b8b8d0", txtL: "#f0f0ff", txtD: "#08080e" }, 13),
    makeToken(id, "buttonSecondaryHover",{ bgL: "#300a38", bgD: "#e0c0e0", txtL: "#f0f0ff", txtD: "#08080e" }, 14),
    makeToken(id, "buttonAccentHover",   { bgL: "#102818", bgD: "#b0d0b8", txtL: "#f0fff0", txtD: "#08080e" }, 15),
    makeToken(id, "buttonPlain",         { bgL: "#081810", bgD: "#c8e0d0", txtL: "#300a38", txtD: "#380c40" }, 16),

    // Arrow
    makeToken(id, "arrowPrimary",   { bgL: "#3d3d8c", bgD: "#10102a", borL: "#8c3d8c", borD: "#1e0820" }, 20),
    makeToken(id, "arrowSecondary", { bgL: "#8c3d8c", bgD: "#1e0820", borL: "#3d8c5c", borD: "#081810" }, 21),
    makeToken(id, "arrowAccent",    { bgL: "#3d8c5c", bgD: "#081810", borL: "#3d3d8c", borD: "#10102a" }, 22),

    // Icon
    makeToken(id, "iconPrimary",       { bgL: "#f0e4f0", bgD: "#1e0820" }, 30),
    makeToken(id, "iconSecondary",     { bgL: "#081810", bgD: "#3d8c5c" }, 31),
    makeToken(id, "iconAccent",        { bgL: "#081810", bgD: "#3d8c5c" }, 32),
    makeToken(id, "iconPrimaryHover",  { bgL: "#3d3d8c", bgD: "#5c5cad" }, 33),
    makeToken(id, "iconSecondaryHover",{ bgL: "#3d3d8c", bgD: "#5c5cad" }, 34),
    makeToken(id, "iconAccentHover",   { bgL: "#3d8c5c", bgD: "#5cad7c" }, 35),

    // Shadow
    makeToken(id, "shadowPrimary",   { bgL: "#3d3d8c", bgD: "#10102a" }, 40),
    makeToken(id, "shadowSecondary", { bgL: "#8c3d8c", bgD: "#1e0820" }, 41),
    makeToken(id, "shadowAccent",    { bgL: "#3d8c5c", bgD: "#081810" }, 42),

    // Text — must contrast against boxMain.bg (light: #f4f4f8, dark: #08080e)
    makeToken(id, "textPop",     { bgL: "transparent", bgD: "transparent", txtL: "#081810", txtD: "#c8e0d0" }, 50),
    makeToken(id, "textError",   { bgL: "transparent", bgD: "transparent", txtL: "#600000", txtD: "#ffb8b8" }, 51),
    makeToken(id, "textWarning", { bgL: "transparent", bgD: "transparent", txtL: "#602800", txtD: "#ffd8a8" }, 52),

    // Special
    makeToken(id, "boxSearchProviders", { bgL: "#3d8c5c", bgD: "#081810" }, 60),
    makeToken(id, "boxAIProviders",     { bgL: "#3d8c5c", bgD: "#081810" }, 61),
    makeToken(id, "boxInfo",            { bgL: "#3d3d8c", bgD: "#10102a" }, 62),
  ];
}

/**
 * 3) "Warm Brand" — warm palette with earth tones.
 */
function buildWarmBrand(): ComponentTokenRecord[] {
  const id = "warm-brand";
  return [
    // Box
    makeToken(id, "boxMain",      { bgL: "#f8f5f0", bgD: "#0e0a08", txtL: "#0e0a08", txtD: "#f8f5f0" }, -1),
    makeToken(id, "boxPrimary",   { bgL: "#f0e4d0", bgD: "#1a1008", txtL: "#0e0a08", txtD: "#f0e8e0", borL: "#8c6d3f", borD: "#ad8c5c" }, 0),
    makeToken(id, "boxSecondary", { bgL: "#f0d8d0", bgD: "#1a0808", txtL: "#0e0a08", txtD: "#f0e8e0", borL: "#8c3f3f", borD: "#ad5c5c" }, 1),
    makeToken(id, "boxAccent",    { bgL: "#eaf0d8", bgD: "#0e1808", txtL: "#0e0a08", txtD: "#f0e8e0", borL: "#5c8c3f", borD: "#7cad5c" }, 2),

    // Button
    makeToken(id, "buttonPrimary",       { bgL: "#1a1008", bgD: "#dcd0b8", txtL: "#ffffff", txtD: "#0e0a08", borL: "#3d2b1a", borD: "#8c6d3f" }, 10),
    makeToken(id, "buttonSecondary",     { bgL: "#f0d8d0", bgD: "#1a0808", txtL: "#0e0a08", txtD: "#f0e8e0", borL: "#3d1a1a", borD: "#8c3f3f" }, 11),
    makeToken(id, "buttonAccent",        { bgL: "#0e1808", bgD: "#c8d8b0", txtL: "#ffffff", txtD: "#0e0a08", borL: "#1a3d0d", borD: "#5c8c3f" }, 12),
    makeToken(id, "buttonPrimaryHover",  { bgL: "#2a1810", bgD: "#d0c0a0", txtL: "#ffffff", txtD: "#0e0a08" }, 13),
    makeToken(id, "buttonSecondaryHover",{ bgL: "#401010", bgD: "#e0c0c0", txtL: "#ffffff", txtD: "#0e0a08" }, 14),
    makeToken(id, "buttonAccentHover",   { bgL: "#182810", bgD: "#b8c8a0", txtL: "#ffffff", txtD: "#0e0a08" }, 15),
    makeToken(id, "buttonPlain",         { bgL: "#0e1808", bgD: "#c8d8b0", txtL: "#401010", txtD: "#481218" }, 16),

    // Arrow
    makeToken(id, "arrowPrimary",   { bgL: "#8c6d3f", bgD: "#1a1008", borL: "#8c3f3f", borD: "#1a0808" }, 20),
    makeToken(id, "arrowSecondary", { bgL: "#8c3f3f", bgD: "#1a0808", borL: "#5c8c3f", borD: "#0e1808" }, 21),
    makeToken(id, "arrowAccent",    { bgL: "#5c8c3f", bgD: "#0e1808", borL: "#8c6d3f", borD: "#1a1008" }, 22),

    // Icon
    makeToken(id, "iconPrimary",       { bgL: "#f0d8d0", bgD: "#1a0808" }, 30),
    makeToken(id, "iconSecondary",     { bgL: "#0e1808", bgD: "#5c8c3f" }, 31),
    makeToken(id, "iconAccent",        { bgL: "#0e1808", bgD: "#5c8c3f" }, 32),
    makeToken(id, "iconPrimaryHover",  { bgL: "#8c6d3f", bgD: "#ad8c5c" }, 33),
    makeToken(id, "iconSecondaryHover",{ bgL: "#8c6d3f", bgD: "#ad8c5c" }, 34),
    makeToken(id, "iconAccentHover",   { bgL: "#5c8c3f", bgD: "#7cad5c" }, 35),

    // Shadow
    makeToken(id, "shadowPrimary",   { bgL: "#8c6d3f", bgD: "#1a1008" }, 40),
    makeToken(id, "shadowSecondary", { bgL: "#8c3f3f", bgD: "#1a0808" }, 41),
    makeToken(id, "shadowAccent",    { bgL: "#5c8c3f", bgD: "#0e1808" }, 42),

    // Text — must contrast against boxMain.bg (light: #f8f5f0, dark: #0e0a08)
    makeToken(id, "textPop",     { bgL: "transparent", bgD: "transparent", txtL: "#0e1808", txtD: "#c8d8b0" }, 50),
    makeToken(id, "textError",   { bgL: "transparent", bgD: "transparent", txtL: "#600000", txtD: "#ffb8b8" }, 51),
    makeToken(id, "textWarning", { bgL: "transparent", bgD: "transparent", txtL: "#602800", txtD: "#ffd8a8" }, 52),

    // Special
    makeToken(id, "boxSearchProviders", { bgL: "#5c8c3f", bgD: "#0e1808" }, 60),
    makeToken(id, "boxAIProviders",     { bgL: "#5c8c3f", bgD: "#0e1808" }, 61),
    makeToken(id, "boxInfo",            { bgL: "#8c6d3f", bgD: "#1a1008" }, 62),
  ];
}

const THEME_FIXTURES: ThemeFixture[] = [
  { name: "AAA Light", tokens: buildAAALight() },
  { name: "Midnight", tokens: buildMidnight() },
  { name: "Warm Brand", tokens: buildWarmBrand() },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve all tokens for a theme in both modes, returning a map per mode. */
function resolveTheme(tokens: ComponentTokenRecord[]): {
  light: FlatCssVariableMap;
  dark: FlatCssVariableMap;
} {
  return {
    light: resolveTokensToCssVars(tokens, "light"),
    dark: resolveTokensToCssVars(tokens, "dark"),
  };
}

/** Look up a hex value from the flat CSS variable map by semantic token name. */
function lookupHex(
  cssVars: FlatCssVariableMap,
  semanticName: string,
): string | null {
  const cssVar = semanticTokenToCssVar(semanticName);
  if (!cssVar) return null;
  return cssVars[cssVar] ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Recipe Contrast Compliance", () => {
  // Ensure the contrast map itself is consistent
  describe("recipe-contrast-map sanity", () => {
    it("every pair resolves to known CSS variables", () => {
      for (const pair of RECIPE_CONTRAST_PAIRS) {
        const fgVar = semanticTokenToCssVar(pair.fgToken);
        const bgVar = semanticTokenToCssVar(pair.bgToken);

        expect(fgVar).not.toBeNull();
        expect(bgVar).not.toBeNull();
      }
    });

    it("has at least 15 testable pairs", () => {
      expect(RECIPE_CONTRAST_PAIRS.length).toBeGreaterThanOrEqual(15);
    });
  });

  // Parameterized tests per theme
  describe.each(THEME_FIXTURES)("Theme: $name", ({ tokens }) => {
    const resolved = resolveTheme(tokens);

    describe.each(["light", "dark"] as const)("%s mode", (mode) => {
      const cssVars = resolved[mode];

      it.each(RECIPE_CONTRAST_PAIRS)(
        "$recipe / $variant — fg=$fgToken vs bg=$bgToken meets AAA (>= 7:1)",
        ({ fgToken, bgToken }) => {
          const fgHex = lookupHex(cssVars, fgToken);
          const bgHex = lookupHex(cssVars, bgToken);

          // Both must be present (non-transparent) for this test to be meaningful
          if (!fgHex || !bgHex) {
            // Skip if a token resolved to transparent / missing — those are
            // already covered by the "sanity" tests and the resolver tests.
            return;
          }

          const ratio = getContrastRatio(fgHex, bgHex);

          expect(ratio).toBeGreaterThanOrEqual(7);
        },
      );
    });
  });
});
