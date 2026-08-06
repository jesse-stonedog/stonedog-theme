/**
 * Static registry of all ComponentToken groups and their mapping
 * to legacy semantic variable names.
 */

import type { ComponentTokenGroup, FontRole, FontWeightStep, TokenSlot } from "./types";

/**
 * Convert a camelCase token name to kebab-case.
 * e.g. "boxPrimary" -> "box-primary"
 */
export function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * The custom-property namespace a host gets for saying nothing.
 *
 * Matches `DEFAULT_CSS_VAR_PREFIX` in `stonedog-style`, and must keep matching:
 * that package's tokens resolve to `var(--hopper-…)` and this one writes those
 * properties, so a disagreement means every colour is defined under one name
 * and read under another. Neither half errors; the page simply renders with no
 * colour at all.
 *
 * It stays `"hopper"` for the reason it does over there — HopperGuard's theme
 * data lives in a database keyed on `--hopper-*`, so moving the DEFAULT is a
 * data migration (NEH-256), separate from letting a host CHOOSE another one.
 */
export const DEFAULT_CSS_VAR_PREFIX = "hopper";

/**
 * A prefix that can appear between `--` and the rest of a custom-property name.
 *
 * CSS idents allow more than this (escapes, non-ASCII); the narrow set is
 * deliberate. Anything outside it is far likelier to be a mistake — a stray
 * space, a `--` someone included, an empty string from an unset env var — than
 * an intentional exotic name.
 */
const VALID_CSS_VAR_PREFIX = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

/**
 * Reject a prefix that would produce a malformed custom property.
 *
 * **This throws rather than falling back to the default, and that is the whole
 * point.** Both alternatives are silent: an invalid prefix emits properties no
 * browser will parse, and a fallback emits perfectly valid properties in the
 * wrong namespace. Either way every component renders with no colour, with no
 * build error and nothing in the console — the exact failure this package
 * exists to make impossible. A thrown error names the problem at the one moment
 * someone can act on it.
 */
export function assertValidCssVarPrefix(cssVarPrefix: string): void {
  if (!VALID_CSS_VAR_PREFIX.test(cssVarPrefix)) {
    throw new Error(
      `[stonedog-theme] invalid cssVarPrefix ${JSON.stringify(cssVarPrefix)}: ` +
        "expected a CSS identifier such as \"hopper\" or \"optima\" — letters, " +
        "digits, hyphens and underscores, starting with a letter or underscore, " +
        "and WITHOUT the leading \"--\".",
    );
  }
}

/**
 * Get the CSS variable name for a token + slot.
 * e.g. getCssVarName("boxPrimary", "bg") -> "--hopper-box-primary-bg"
 *      getCssVarName("boxPrimary", "bg", "optima") -> "--optima-box-primary-bg"
 *
 * The prefix is a trailing argument with a default, matching how
 * `stonedog-style` spells the same idea (`requiredCssCustomProperties(prefix)`).
 * One concept, one shape, across both halves of the design system.
 *
 * **Careful passing this to `Array.map`.** `map` supplies the index as the
 * second argument, so `names.map(getCssVarName)` would silently become
 * `getCssVarName(name, 0)`. Here the slot argument sits in between so the
 * compiler catches it; the font helpers below take the prefix second and are
 * therefore the ones to watch. Wrap them in an arrow.
 */
export function getCssVarName(
  tokenName: string,
  slot: TokenSlot,
  cssVarPrefix: string = DEFAULT_CSS_VAR_PREFIX,
): string {
  assertValidCssVarPrefix(cssVarPrefix);
  return `--${cssVarPrefix}-${toKebabCase(tokenName)}-${slot}`;
}

/**
 * Every typeface role, in the order a host should emit them.
 *
 * `body` first because it is the one every theme sets and the only one
 * HopperGuard has ever set.
 */
export const FONT_ROLES: readonly FontRole[] = ["body", "heading", "mono"];

/** Every weight step, lightest first. */
export const FONT_WEIGHT_STEPS: readonly FontWeightStep[] = [
  "normal",
  "medium",
  "semibold",
  "bold",
];

/**
 * The lowest and highest values CSS accepts for a numeric `font-weight`
 * (CSS Fonts 4, §2.2.1). Outside this range the declaration is invalid and the
 * browser discards it, so the property would be defined and still paint nothing
 * — the exact failure mode this package exists to prevent. Shared by the
 * resolver (which skips) and the JSON loader (which rejects) so the two cannot
 * disagree about what a usable weight is.
 */
export const MIN_FONT_WEIGHT = 1;
export const MAX_FONT_WEIGHT = 1000;

/**
 * The CSS custom property carrying a role's font stack.
 * e.g. getFontFamilyCssVarName("body") -> "--hopper-font-family-body"
 *
 * `font-family` / `font-weight` are spelled out rather than compressed to
 * `--hopper-font-body`, so the two namespaces cannot collide as roles or steps
 * are added, and so the property names the CSS property it feeds. These names
 * are public API from the moment they ship: adding one is backwards-compatible,
 * changing one silently un-styles whatever read it.
 *
 * **Do not pass this straight to `Array.map`** — `map` supplies the index as
 * the second argument, which is now the prefix position, so
 * `FONT_ROLES.map(getFontFamilyCssVarName)` would ask for `--0-font-family-…`.
 * The compiler rejects it (number is not a string), which is why the prefix is
 * typed rather than left loose; write `FONT_ROLES.map((r) => getFontFamilyCssVarName(r))`.
 */
export function getFontFamilyCssVarName(
  role: FontRole,
  cssVarPrefix: string = DEFAULT_CSS_VAR_PREFIX,
): string {
  assertValidCssVarPrefix(cssVarPrefix);
  return `--${cssVarPrefix}-font-family-${role}`;
}

/**
 * The CSS custom property carrying a weight step's numeric value.
 * e.g. getFontWeightCssVarName("bold") -> "--hopper-font-weight-bold"
 *
 * Same `Array.map` caveat as `getFontFamilyCssVarName` above.
 */
export function getFontWeightCssVarName(
  step: FontWeightStep,
  cssVarPrefix: string = DEFAULT_CSS_VAR_PREFIX,
): string {
  assertValidCssVarPrefix(cssVarPrefix);
  return `--${cssVarPrefix}-font-weight-${step}`;
}

/**
 * All ~28 component token groups with their metadata and legacy variable mappings.
 */
export const COMPONENT_TOKEN_GROUPS: ComponentTokenGroup[] = [
  // === Box ===
  {
    key: "boxMain",
    displayName: "Box Main (Page)",
    category: "box",
    activeSlots: ["bg", "text"],
    legacyVariables: { bg: "boxBgMain", text: "textMain" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "50" }, text: { palette: "primary", shade: "900" } },
    sortOrder: -1,
  },
  {
    key: "boxPrimary",
    displayName: "Box Primary",
    category: "box",
    activeSlots: ["bg", "text", "border"],
    legacyVariables: { bg: "boxBgPrimary", text: "textPrimary", border: "borderBgPrimary" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "solid" }, text: { palette: "primary", shade: "contrast" }, border: { palette: "primary", shade: "border" } },
    sortOrder: 0,
  },
  {
    key: "boxSecondary",
    displayName: "Box Secondary",
    category: "box",
    activeSlots: ["bg", "text", "border"],
    legacyVariables: { bg: "boxBgSecondary", text: "textSecondary", border: "borderBgSecondary" },
    defaultPaletteRef: { bg: { palette: "secondary", shade: "solid" }, text: { palette: "secondary", shade: "contrast" }, border: { palette: "secondary", shade: "border" } },
    sortOrder: 1,
  },
  {
    key: "boxAccent",
    displayName: "Box Accent",
    category: "box",
    activeSlots: ["bg", "text", "border"],
    legacyVariables: { bg: "boxBgAccent", text: "textAccent", border: "borderBgAccent" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "solid" }, text: { palette: "accent", shade: "contrast" }, border: { palette: "accent", shade: "border" } },
    sortOrder: 2,
  },

  // === Button ===
  {
    key: "buttonPrimary",
    displayName: "Button Primary",
    category: "button",
    activeSlots: ["bg", "text", "border"],
    legacyVariables: { bg: "buttonBgPrimary", text: "buttonTextPrimary", border: "borderBgPrimary" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "900" }, text: { palette: "primary", shade: "contrast" }, border: { palette: "primary", shade: "border" } },
    sortOrder: 10,
  },
  {
    key: "buttonSecondary",
    displayName: "Button Secondary",
    category: "button",
    activeSlots: ["bg", "text", "border"],
    legacyVariables: { bg: "buttonBgSecondary", text: "buttonTextSecondary", border: "borderBgSecondary" },
    defaultPaletteRef: { bg: { palette: "secondary", shade: "solid" }, text: { palette: "secondary", shade: "contrast" }, border: { palette: "secondary", shade: "border" } },
    sortOrder: 11,
  },
  {
    key: "buttonAccent",
    displayName: "Button Accent",
    category: "button",
    activeSlots: ["bg", "text", "border"],
    legacyVariables: { bg: "buttonBgAccent", text: "buttonTextAccent", border: "borderBgAccent" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "solid" }, text: { palette: "accent", shade: "contrast" }, border: { palette: "accent", shade: "border" } },
    sortOrder: 12,
  },
  {
    key: "buttonPrimaryHover",
    displayName: "Button Primary Hover",
    category: "button",
    activeSlots: ["bg", "text"],
    legacyVariables: { bg: "buttonBgPrimaryHover", text: "buttonTextPrimaryHover" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "solid" }, text: { palette: "primary", shade: "solid" } },
    sortOrder: 13,
  },
  {
    key: "buttonSecondaryHover",
    displayName: "Button Secondary Hover",
    category: "button",
    activeSlots: ["bg", "text"],
    legacyVariables: { bg: "buttonBgSecondaryHover", text: "buttonTextSecondaryHover" },
    defaultPaletteRef: { bg: { palette: "secondary", shade: "solid" }, text: { palette: "secondary", shade: "solid" } },
    sortOrder: 14,
  },
  {
    key: "buttonAccentHover",
    displayName: "Button Accent Hover",
    category: "button",
    activeSlots: ["bg", "text"],
    legacyVariables: { bg: "buttonBgAccentHover", text: "buttonTextAccentHover" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "solid" }, text: { palette: "accent", shade: "solid" } },
    sortOrder: 15,
  },
  {
    key: "buttonPlain",
    displayName: "Button Plain",
    category: "button",
    activeSlots: ["bg", "text"],
    legacyVariables: { bg: "buttonBgPlain", text: "buttonTextPlain" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "solid" }, text: { palette: "secondary", shade: "solid" } },
    sortOrder: 16,
  },

  // === Arrow ===
  {
    key: "arrowPrimary",
    displayName: "Arrow Primary",
    category: "arrow",
    activeSlots: ["bg", "border"],
    legacyVariables: { bg: "arrowBgPrimary", border: "arrowBorderPrimary" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "solid" }, border: { palette: "secondary", shade: "solid" } },
    sortOrder: 20,
  },
  {
    key: "arrowSecondary",
    displayName: "Arrow Secondary",
    category: "arrow",
    activeSlots: ["bg", "border"],
    legacyVariables: { bg: "arrowBgSecondary", border: "arrowBorderSecondary" },
    defaultPaletteRef: { bg: { palette: "secondary", shade: "solid" }, border: { palette: "accent", shade: "solid" } },
    sortOrder: 21,
  },
  {
    key: "arrowAccent",
    displayName: "Arrow Accent",
    category: "arrow",
    activeSlots: ["bg", "border"],
    legacyVariables: { bg: "arrowBgAccent", border: "arrowBorderAccent" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "solid" }, border: { palette: "primary", shade: "solid" } },
    sortOrder: 22,
  },

  // === Icon ===
  {
    key: "iconPrimary",
    displayName: "Icon Primary",
    category: "icon",
    activeSlots: ["bg"],
    legacyVariables: { bg: "iconBgPrimary" },
    defaultPaletteRef: { bg: { palette: "secondary", shade: "50" } },
    sortOrder: 30,
  },
  {
    key: "iconSecondary",
    displayName: "Icon Secondary",
    category: "icon",
    activeSlots: ["bg"],
    legacyVariables: { bg: "iconBgSecondary" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "900" } },
    sortOrder: 31,
  },
  {
    key: "iconAccent",
    displayName: "Icon Accent",
    category: "icon",
    activeSlots: ["bg"],
    legacyVariables: { bg: "iconBgAccent" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "900" } },
    sortOrder: 32,
  },
  {
    key: "iconPrimaryHover",
    displayName: "Icon Primary Hover",
    category: "icon",
    activeSlots: ["bg"],
    legacyVariables: { bg: "iconBgPrimaryHover" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "solid" } },
    sortOrder: 33,
  },
  {
    key: "iconSecondaryHover",
    displayName: "Icon Secondary Hover",
    category: "icon",
    activeSlots: ["bg"],
    legacyVariables: { bg: "iconBgSecondaryHover" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "solid" } },
    sortOrder: 34,
  },
  {
    key: "iconAccentHover",
    displayName: "Icon Accent Hover",
    category: "icon",
    activeSlots: ["bg"],
    legacyVariables: { bg: "iconBgAccentHover" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "solid" } },
    sortOrder: 35,
  },

  // === Shadow ===
  {
    key: "shadowPrimary",
    displayName: "Shadow Primary",
    category: "shadow",
    activeSlots: ["bg"],
    legacyVariables: { bg: "boxshadowBgPrimary" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "solid" } },
    sortOrder: 40,
  },
  {
    key: "shadowSecondary",
    displayName: "Shadow Secondary",
    category: "shadow",
    activeSlots: ["bg"],
    legacyVariables: { bg: "boxshadowBgSecondary" },
    defaultPaletteRef: { bg: { palette: "secondary", shade: "solid" } },
    sortOrder: 41,
  },
  {
    key: "shadowAccent",
    displayName: "Shadow Accent",
    category: "shadow",
    activeSlots: ["bg"],
    legacyVariables: { bg: "boxshadowBgAccent" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "solid" } },
    sortOrder: 42,
  },

  // === Text (standalone) ===
  {
    key: "textPop",
    displayName: "Text Pop",
    category: "text",
    activeSlots: ["text"],
    legacyVariables: { text: "textPop" },
    defaultPaletteRef: { text: { palette: "accent", shade: "subtle" } },
    sortOrder: 50,
  },
  {
    key: "textError",
    displayName: "Text Error",
    category: "text",
    activeSlots: ["text"],
    legacyVariables: { text: "textError" },
    defaultPaletteRef: { text: { palette: "accent", shade: "focusRing" } },
    sortOrder: 51,
  },
  {
    key: "textWarning",
    displayName: "Text Warning",
    category: "text",
    activeSlots: ["text"],
    legacyVariables: { text: "textWarning" },
    defaultPaletteRef: { text: { palette: "accent", shade: "subtle" } },
    sortOrder: 52,
  },

  // === Title (Logo) ===
  {
    key: "titlePrimary",
    displayName: "Title Primary",
    category: "title",
    activeSlots: ["text"],
    legacyVariables: { text: "titlePrimary" },
    defaultPaletteRef: { text: { palette: "primary", shade: "solid" } },
    sortOrder: 55,
  },
  {
    key: "titleSecondary",
    displayName: "Title Secondary",
    category: "title",
    activeSlots: ["text"],
    legacyVariables: { text: "titleSecondary" },
    defaultPaletteRef: { text: { palette: "secondary", shade: "300" } },
    sortOrder: 56,
  },
  {
    key: "titleAccent",
    displayName: "Title Accent",
    category: "title",
    activeSlots: ["text"],
    legacyVariables: { text: "titleAccent" },
    defaultPaletteRef: { text: { palette: "accent", shade: "900" } },
    sortOrder: 57,
  },

  // === Special ===
  {
    key: "boxSearchProviders",
    displayName: "Search Providers Box",
    category: "special",
    activeSlots: ["bg"],
    legacyVariables: { bg: "boxSearchProviders" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "600" } },
    sortOrder: 60,
  },
  {
    key: "boxAIProviders",
    displayName: "AI Providers Box",
    category: "special",
    activeSlots: ["bg"],
    legacyVariables: { bg: "boxAIProviders" },
    defaultPaletteRef: { bg: { palette: "accent", shade: "600" } },
    sortOrder: 61,
  },
  {
    key: "boxInfo",
    displayName: "Info Box",
    category: "special",
    activeSlots: ["bg"],
    legacyVariables: { bg: "boxInfo" },
    defaultPaletteRef: { bg: { palette: "primary", shade: "solid" } },
    sortOrder: 62,
  },
];

/**
 * Reverse map: legacy semantic variable name -> { tokenName, slot }
 * e.g. "boxBgPrimary" -> { tokenName: "boxPrimary", slot: "bg" }
 */
export const LEGACY_TO_TOKEN_MAP: Record<string, { tokenName: string; slot: TokenSlot }> =
  buildLegacyMap();

function buildLegacyMap(): Record<string, { tokenName: string; slot: TokenSlot }> {
  const map: Record<string, { tokenName: string; slot: TokenSlot }> = {};
  for (const group of COMPONENT_TOKEN_GROUPS) {
    for (const [slot, legacyName] of Object.entries(group.legacyVariables)) {
      if (legacyName) {
        map[legacyName] = { tokenName: group.key, slot: slot as TokenSlot };
      }
    }
  }
  return map;
}

/** Look up a ComponentTokenGroup by key */
export function getTokenGroup(key: string): ComponentTokenGroup | undefined {
  return COMPONENT_TOKEN_GROUPS.find((g) => g.key === key);
}

/** Get all token groups for a given category */
export function getTokenGroupsByCategory(category: string): ComponentTokenGroup[] {
  return COMPONENT_TOKEN_GROUPS.filter((g) => g.category === category);
}
