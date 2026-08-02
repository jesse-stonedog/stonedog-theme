/**
 * Static mapping of recipe variants to their foreground/background semantic token pairs.
 * Used by integration tests to verify WCAG AAA contrast compliance per theme.
 */

import { LEGACY_TO_TOKEN_MAP, getCssVarName } from "./token-registry";

export interface RecipeContrastPair {
  recipe: string;
  variant: string;
  fgToken: string; // semantic var name, e.g. "buttonTextPrimary"
  bgToken: string; // semantic var name, e.g. "buttonBgPrimary"
}

/**
 * Resolve a semantic token name (e.g. "buttonTextPrimary") to its CSS variable name
 * (e.g. "--hopper-button-primary-text") using the LEGACY_TO_TOKEN_MAP.
 *
 * Returns null if the semantic name is not in the legacy map.
 */
export function semanticTokenToCssVar(semanticName: string): string | null {
  const entry = LEGACY_TO_TOKEN_MAP[semanticName];
  if (!entry) return null;
  return getCssVarName(entry.tokenName, entry.slot);
}

/**
 * Only testable pairs: both tokens resolve to known CSS vars,
 * no gradients, opacity, inherit, or hardcoded colors.
 *
 * Skipped (by recipe):
 *   button: aurora (gradient), glass (/40 opacity), matte (/70 opacity), unstyled (inherit)
 *   box: solid (raw var), aurora/glass/matte (gradient/opacity), none/unstyled (transparent), link (no text)
 *   inputText: aurora (gradient), none (hardcoded white)
 *   iconButton: solid (raw CSS var), outline (no text), aurora/glass/matte (gradient/opacity), none (chakra)
 *   form: aurora/glass/matte (gradient/rgba), lines (hardcoded black), none/unstyled (inherit)
 *   stack: all variants use chakra tokens, gradients, or rgba
 */
export const RECIPE_CONTRAST_PAIRS: RecipeContrastPair[] = [
  // === Button ===
  { recipe: "button", variant: "solid", fgToken: "buttonTextPrimary", bgToken: "buttonBgPrimary" },
  { recipe: "button", variant: "solid (hover)", fgToken: "buttonTextSecondary", bgToken: "buttonBgSecondary" },
  { recipe: "button", variant: "outline", fgToken: "textMain", bgToken: "boxBgMain" },
  { recipe: "button", variant: "ghost", fgToken: "textSecondary", bgToken: "buttonBgSecondary" },
  { recipe: "button", variant: "none", fgToken: "textMain", bgToken: "boxBgMain" },
  { recipe: "button", variant: "link", fgToken: "textMain", bgToken: "boxBgMain" },

  // === Box ===
  { recipe: "box", variant: "outline", fgToken: "textPrimary", bgToken: "boxBgPrimary" },
  { recipe: "box", variant: "ghost", fgToken: "textSecondary", bgToken: "boxBgSecondary" },

  // === Text ===
  { recipe: "text", variant: "base", fgToken: "textPrimary", bgToken: "boxBgMain" },
  { recipe: "text", variant: "pop", fgToken: "textPop", bgToken: "boxBgMain" },
  { recipe: "text", variant: "warning", fgToken: "textWarning", bgToken: "boxBgMain" },
  { recipe: "text", variant: "error", fgToken: "textError", bgToken: "boxBgMain" },

  // === InputText ===
  { recipe: "inputText", variant: "solid", fgToken: "textPrimary", bgToken: "boxBgAccent" },
  { recipe: "inputText", variant: "outline", fgToken: "textPrimary", bgToken: "boxBgMain" },
  { recipe: "inputText", variant: "glass", fgToken: "textPrimary", bgToken: "boxBgAccent" },
  { recipe: "inputText", variant: "matte", fgToken: "textSecondary", bgToken: "buttonBgSecondary" },
  { recipe: "inputText", variant: "ghost", fgToken: "textSecondary", bgToken: "buttonBgSecondary" },

  // === Form ===
  { recipe: "form", variant: "solid", fgToken: "textPrimary", bgToken: "boxBgAccent" },
  { recipe: "form", variant: "outline", fgToken: "textPrimary", bgToken: "boxBgMain" },

  // === IconButton ===
  { recipe: "iconButton", variant: "ghost", fgToken: "textSecondary", bgToken: "buttonBgSecondary" },
];
