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
 * Get the CSS variable name for a token + slot.
 * e.g. getCssVarName("boxPrimary", "bg") -> "--hopper-box-primary-bg"
 */
export function getCssVarName(tokenName: string, slot: TokenSlot): string {
  return `--hopper-${toKebabCase(tokenName)}-${slot}`;
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
 */
export function getFontFamilyCssVarName(role: FontRole): string {
  return `--hopper-font-family-${role}`;
}

/**
 * The CSS custom property carrying a weight step's numeric value.
 * e.g. getFontWeightCssVarName("bold") -> "--hopper-font-weight-bold"
 */
export function getFontWeightCssVarName(step: FontWeightStep): string {
  return `--hopper-font-weight-${step}`;
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
