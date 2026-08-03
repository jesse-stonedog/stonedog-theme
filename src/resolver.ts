/**
 * Resolves ComponentToken records into flat CSS variable maps
 * for client consumption.
 */

import type {
  ComponentTokenRecord,
  ColorMode,
  FlatCssVariableMap,
  ThemeFontSettings,
} from "./types";
import {
  getCssVarName,
  getFontFamilyCssVarName,
  getFontWeightCssVarName,
  FONT_ROLES,
  FONT_WEIGHT_STEPS,
  MIN_FONT_WEIGHT,
  MAX_FONT_WEIGHT,
  LEGACY_TO_TOKEN_MAP,
  COMPONENT_TOKEN_GROUPS,
} from "./token-registry";
import { adjustForContrast, getContrastRatio } from "./contrast";
import { themeLog } from "./logger";

/**
 * WCAG 2.2 Level AA contrast floor for normal-size text (1.4.3). Every
 * resolved token whose text is rendered over its own background is held to
 * this minimum — see `resolveTokenSlots`. AA (not AAA 7:1) is the floor so we
 * never alter a designer's color more than necessary; a pair already at/above
 * 4.5:1 is returned untouched.
 */
export const AA_NORMAL_TEXT_RATIO = 4.5;

/**
 * Pick a token's bg/text/border for the color mode and enforce the AA text
 * contrast floor. If a token has a concrete bg AND a concrete text, the text is
 * nudged (via `adjustForContrast`, a no-op when already compliant) to the
 * nearest shade that meets 4.5:1 against the bg. Transparent slots are left
 * alone — those resolve through the palette-fallback chain downstream, which
 * pairs colors the resolver can't see here.
 *
 * Centralizing the floor here means EVERY theme and BOTH color modes inherit
 * AA contrast automatically; a new or edited theme can't ship a failing
 * token/text pair.
 */
export function resolveTokenSlots(
  token: ComponentTokenRecord,
  colorMode: ColorMode,
): { bg: string; text: string; border: string } {
  const isLight = colorMode === "light";
  const bg = isLight ? token.bgLight : token.bgDark;
  let text = isLight ? token.textLight : token.textDark;
  const border = isLight ? token.borderLight : token.borderDark;

  if (
    bg &&
    bg !== "transparent" &&
    text &&
    text !== "transparent" &&
    getContrastRatio(text, bg) < AA_NORMAL_TEXT_RATIO
  ) {
    const adjusted = adjustForContrast(text, bg, AA_NORMAL_TEXT_RATIO);
    themeLog().warn("[stonedog-theme/resolver] adjusted token text for AA contrast", {
      token: token.name,
      colorMode,
      bg,
      from: text,
      to: adjusted,
    });
    text = adjusted;
  }

  return { bg, text, border };
}

/**
 * Resolve an array of ComponentTokenRecords into a flat CSS variable map
 * for the given color mode.
 *
 * Produces variables like:
 *   "--hopper-box-primary-bg": "#3a5ba0"
 *   "--hopper-box-primary-text": "#ffffff"
 *   "--hopper-box-primary-border": "#2a4b90"
 */
export function resolveTokensToCssVars(
  tokens: ComponentTokenRecord[],
  colorMode: ColorMode,
): FlatCssVariableMap {
  themeLog().info("[stonedog-theme/resolver] resolveTokensToCssVars", {
    tokenCount: tokens.length,
    colorMode,
  });
  const vars: FlatCssVariableMap = {};

  for (const token of tokens) {
    const { bg: bgValue, text: textValue, border: borderValue } =
      resolveTokenSlots(token, colorMode);

    // Skip "transparent" values so the var() fallback chain in
    // semanticVariables.ts works correctly (CSS treats "transparent" as
    // a valid value and won't fall back to the next var()).
    if (bgValue && bgValue !== "transparent") {
      vars[getCssVarName(token.name, "bg")] = bgValue;
    }
    if (textValue && textValue !== "transparent") {
      vars[getCssVarName(token.name, "text")] = textValue;
    }
    if (borderValue && borderValue !== "transparent") {
      vars[getCssVarName(token.name, "border")] = borderValue;
    }
  }

  return vars;
}

/**
 * Resolve a theme's typefaces into a flat CSS variable map (NEH-277).
 *
 * Produces variables like:
 *   "--hopper-font-family-body": "\"Inter\", sans-serif"
 *   "--hopper-font-weight-bold": "700"
 *
 * Fonts do not vary by colour mode — a theme does not change typeface between
 * light and dark — so unlike `resolveTokensToCssVars` this takes no
 * `ColorMode`. Merge its output into the same map: they are properties on the
 * same element, and keeping them in one place is the whole point of routing
 * type through the token layer instead of a bespoke `body { font-family }`
 * rule written by each host.
 *
 * **A role or step the theme omits emits nothing**, exactly as a `"transparent"`
 * colour slot does. That is what makes this additive: a host that consumes
 * these properties with a fallback (`var(--hopper-font-family-body, inherit)`)
 * keeps its own typeface until a theme has an opinion, and a host that consumes
 * none of them is unaffected.
 */
export function resolveFontsToCssVars(settings: ThemeFontSettings): FlatCssVariableMap {
  const fonts = settings.fonts ?? {};
  const weights = settings.weights ?? {};

  themeLog().info("[stonedog-theme/resolver] resolveFontsToCssVars", {
    roles: FONT_ROLES.filter((role) => fonts[role] !== undefined),
    steps: FONT_WEIGHT_STEPS.filter((step) => weights[step] !== undefined),
  });

  const vars: FlatCssVariableMap = {};

  // Iterate the registry, never the caller's keys: a role the registry does not
  // know has no property to emit, and copying unknown keys through would let a
  // typo become a plausible-looking variable nothing reads. The JSON loader
  // rejects such a key outright; a database row is merely skipped.
  for (const role of FONT_ROLES) {
    const font = fonts[role];
    if (!font) continue;

    const stack = font.fontFamily.trim();
    if (stack === "") {
      themeLog().warn("[stonedog-theme/resolver] skipped a font with an empty stack", {
        role,
        name: font.name,
      });
      continue;
    }

    vars[getFontFamilyCssVarName(role)] = stack;
  }

  for (const step of FONT_WEIGHT_STEPS) {
    const weight = weights[step];
    if (weight === undefined) continue;

    if (!Number.isInteger(weight) || weight < MIN_FONT_WEIGHT || weight > MAX_FONT_WEIGHT) {
      themeLog().warn("[stonedog-theme/resolver] skipped an out-of-range font weight", {
        step,
        weight,
      });
      continue;
    }

    vars[getFontWeightCssVarName(step)] = String(weight);
  }

  return vars;
}

/**
 * The Google Fonts stylesheets a theme needs loaded, in role order, deduped.
 *
 * The one part of a typeface that is not a custom property. A stylesheet can
 * *name* `"Inter"`, but something has to fetch it, and only a `<link>` or an
 * `@import` can — so this stays a payload seam rather than becoming a variable.
 * It is not a second theming mechanism: it is the loader for the first one.
 */
export function googleFontUrls(settings: ThemeFontSettings): string[] {
  const fonts = settings.fonts ?? {};
  const urls = new Set<string>();

  for (const role of FONT_ROLES) {
    const url = fonts[role]?.googleFontUrl;
    if (url) urls.add(url);
  }

  return [...urls];
}

/**
 * Emit legacy CSS variable aliases for backward compatibility.
 * Maps old `--colors-{legacyName}` variables to the resolved hex values
 * from ComponentToken records.
 *
 * e.g. "--colors-boxBgPrimary": "#3a5ba0"
 */
export function emitLegacyAliases(
  tokens: ComponentTokenRecord[],
  colorMode: ColorMode,
): FlatCssVariableMap {
  themeLog().info("[stonedog-theme/resolver] emitLegacyAliases", {
    tokenCount: tokens.length,
    colorMode,
  });
  const vars: FlatCssVariableMap = {};

  // Build a quick lookup: tokenName -> ComponentTokenRecord
  const tokenMap = new Map<string, ComponentTokenRecord>();
  for (const token of tokens) {
    tokenMap.set(token.name, token);
  }

  // Walk through all known legacy variable names. Resolve each token's slots
  // ONCE (with the AA text-contrast floor applied) so the legacy aliases match
  // the --hopper-* vars exactly — a "text" alias gets the same contrast-adjusted
  // value resolveTokensToCssVars emits.
  const slotsCache = new Map<string, { bg: string; text: string; border: string }>();
  for (const [legacyName, { tokenName, slot }] of Object.entries(LEGACY_TO_TOKEN_MAP)) {
    const token = tokenMap.get(tokenName);
    if (!token) continue;

    let slots = slotsCache.get(tokenName);
    if (!slots) {
      slots = resolveTokenSlots(token, colorMode);
      slotsCache.set(tokenName, slots);
    }

    const value = slots[slot];

    // Skip "transparent" to avoid overriding palette-resolved values
    if (value && value !== "transparent") {
      vars[`--colors-${legacyName}`] = value;
    }
  }

  return vars;
}

/**
 * Build default ComponentTokenRecords for a theme using transparent values.
 * Useful for initializing a new theme with all token groups.
 */
export function buildDefaultTokenRecords(themeId: string): ComponentTokenRecord[] {
  return COMPONENT_TOKEN_GROUPS.map((group) => ({
    themeId,
    name: group.key,
    bgLight: "transparent",
    bgDark: "transparent",
    textLight: "transparent",
    textDark: "transparent",
    borderLight: "transparent",
    borderDark: "transparent",
    sortOrder: group.sortOrder,
  }));
}
