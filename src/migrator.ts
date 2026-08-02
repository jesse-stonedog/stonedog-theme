/**
 * Migration utilities: converts legacy override data into ComponentToken records.
 *
 * Used by the migration script (scripts/migrate-themes-to-component-tokens.ts)
 * to transform existing ColorPaletteShadeOverride + SemanticTokenColorValue data
 * into the new flat ComponentToken format.
 */

import type { ComponentTokenRecord } from "./types";
import { COMPONENT_TOKEN_GROUPS, LEGACY_TO_TOKEN_MAP } from "./token-registry";

/** Shape of a ColorPaletteShadeOverride row from the DB */
export interface LegacyOverride {
  semanticVariable: string;
  overrideValue: string;
  isDark: boolean;
}

/** Shape of a SemanticTokenColorValue row with its definition */
export interface LegacySemanticTokenValue {
  colorMode: string; // "default", "_dark", "system", "value"
  cssValue: string;
  semanticTokenDefinition: {
    name: string;
  };
  paletteReference?: {
    key: string;
    shades?: Array<{ shade: string; hexValue: string }>;
  } | null;
  shade?: number | null;
}

/** Shape of a palette for resolving CSS var references */
export interface PaletteData {
  key: string;
  shades: Array<{ shade: string; hexValue: string }>;
}

/**
 * Default CSS variable values from semanticVariables.ts.
 * Maps legacy variable name -> CSS var reference.
 */
export interface DefaultSemanticValues {
  [variableName: string]: string; // e.g. "boxBgPrimary": "var(--colors-primary-solid)"
}

/**
 * Resolve a CSS variable reference like "var(--colors-primary-solid)" or
 * "colors.primary.solid" to a hex value using the available palette data.
 */
export function resolveCssVarToHex(
  cssValue: string,
  palettes: PaletteData[],
): string | null {
  // Handle "var(--colors-{palette}-{shade})" format
  const varMatch = /var\(--colors-(\w+)-(\w+)\)/.exec(cssValue);
  if (varMatch) {
    const [, paletteKey, shade] = varMatch;
    return findHexInPalettes(paletteKey, shade, palettes);
  }

  // Handle "colors.{palette}.{shade}" format (dotted notation)
  const dottedMatch = /^colors\.(\w+)\.(\w+)$/.exec(cssValue);
  if (dottedMatch) {
    const [, paletteKey, shade] = dottedMatch;
    return findHexInPalettes(paletteKey, shade, palettes);
  }

  // Handle bare hex values
  if (/^#[0-9a-fA-F]{3,6}$/.test(cssValue)) {
    return cssValue;
  }

  return null;
}

function findHexInPalettes(
  paletteKey: string,
  shade: string,
  palettes: PaletteData[],
): string | null {
  const palette = palettes.find((p) => p.key === paletteKey);
  if (!palette) return null;

  const shadeEntry = palette.shades.find((s) => s.shade === shade);
  return shadeEntry?.hexValue ?? null;
}

/**
 * Convert legacy theme data into ComponentToken insert records.
 *
 * Process:
 * 1. Start with defaults from semanticVariables.ts
 * 2. Apply SemanticTokenColorValue overrides (these map tokens to palette references)
 * 3. Apply ColorPaletteShadeOverride records (these are direct hex overrides)
 * 4. Resolve all CSS var references to hex using palette data
 *
 * @param themeId - The theme UUID
 * @param overrides - ColorPaletteShadeOverride rows for this theme
 * @param semanticTokenValues - SemanticTokenColorValue rows for this theme
 * @param palettes - All available color palettes with shades
 * @param defaultValues - Default CSS var values from semanticVariables.ts
 */
export function mapLegacyToComponentTokens(
  themeId: string,
  overrides: LegacyOverride[],
  semanticTokenValues: LegacySemanticTokenValue[],
  palettes: PaletteData[],
  defaultValues: DefaultSemanticValues,
): ComponentTokenRecord[] {
  // Initialize the token map with all groups having transparent values
  const tokenData: Record<
    string,
    {
      bgLight: string; bgDark: string;
      textLight: string; textDark: string;
      borderLight: string; borderDark: string;
      sortOrder: number;
    }
  > = {};

  for (const group of COMPONENT_TOKEN_GROUPS) {
    tokenData[group.key] = {
      bgLight: "transparent",
      bgDark: "transparent",
      textLight: "transparent",
      textDark: "transparent",
      borderLight: "transparent",
      borderDark: "transparent",
      sortOrder: group.sortOrder,
    };
  }

  // Step 1: Apply defaults from semanticVariables.ts
  for (const [legacyName, cssVar] of Object.entries(defaultValues)) {
    const mapping = LEGACY_TO_TOKEN_MAP[legacyName];
    if (!mapping) continue;

    const hex = resolveCssVarToHex(cssVar, palettes);
    if (!hex) continue;

    const data = tokenData[mapping.tokenName];
    if (!data) continue;

    setSlotValue(data, mapping.slot, "light", hex);
    // Default: same value for dark mode unless overridden
    setSlotValue(data, mapping.slot, "dark", hex);
  }

  // Step 2: Apply SemanticTokenColorValue overrides
  for (const stcv of semanticTokenValues) {
    const legacyName = stcv.semanticTokenDefinition.name;
    const mapping = LEGACY_TO_TOKEN_MAP[legacyName];
    if (!mapping) continue;

    const data = tokenData[mapping.tokenName];
    if (!data) continue;

    // Resolve the CSS value to hex
    let hex: string | null = null;
    if (stcv.cssValue) {
      // Ensure it has the "colors." prefix if needed
      const cssVal = stcv.cssValue.startsWith("colors.")
        ? stcv.cssValue
        : `colors.${stcv.cssValue}`;
      hex = resolveCssVarToHex(cssVal, palettes);
    }

    if (!hex) continue;

    // Apply based on colorMode
    switch (stcv.colorMode) {
      case "default":
        setSlotValue(data, mapping.slot, "light", hex);
        break;
      case "_dark":
        setSlotValue(data, mapping.slot, "dark", hex);
        break;
      case "system":
      case "value":
        // Apply to both modes
        setSlotValue(data, mapping.slot, "light", hex);
        setSlotValue(data, mapping.slot, "dark", hex);
        break;
    }
  }

  // Step 3: Apply ColorPaletteShadeOverride records (direct hex values)
  for (const override of overrides) {
    const mapping = LEGACY_TO_TOKEN_MAP[override.semanticVariable];
    if (!mapping) continue;

    const data = tokenData[mapping.tokenName];
    if (!data) continue;

    // overrideValue is typically a direct hex or CSS var reference
    let hex = override.overrideValue;
    if (!hex.startsWith("#")) {
      const resolved = resolveCssVarToHex(hex, palettes);
      if (resolved) hex = resolved;
      else continue;
    }

    if (override.isDark) {
      setSlotValue(data, mapping.slot, "dark", hex);
    } else {
      setSlotValue(data, mapping.slot, "light", hex);
    }
  }

  // Convert to ComponentTokenRecord array
  return Object.entries(tokenData).map(([name, data]) => ({
    themeId,
    name,
    bgLight: data.bgLight,
    bgDark: data.bgDark,
    textLight: data.textLight,
    textDark: data.textDark,
    borderLight: data.borderLight,
    borderDark: data.borderDark,
    sortOrder: data.sortOrder,
  }));
}

function setSlotValue(
  data: Record<string, string | number>,
  slot: string,
  mode: "light" | "dark",
  value: string,
): void {
  const key = `${slot}${mode === "light" ? "Light" : "Dark"}`;
  data[key] = value;
}
