/**
 * Core types for the ComponentToken-based theme system.
 */

/** Matches the DB row shape for component_token */
export interface ComponentTokenRecord {
  id?: number;
  themeId: string;
  name: string;
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
  sortOrder: number;
}

/** Reference to a palette + shade used for fallback resolution */
export interface PaletteRef {
  palette: string;
  shade: string;
}

/** Metadata describing a component token group */
export interface ComponentTokenGroup {
  /** The token name key, e.g. "boxPrimary" */
  key: string;
  /** Human-readable display name, e.g. "Box Primary" */
  displayName: string;
  /** Category for grouping in the editor UI */
  category: ComponentTokenCategory;
  /** Which slots are meaningful for this token (others remain "transparent") */
  activeSlots: TokenSlot[];
  /** Legacy semantic variable names this token replaces, keyed by slot */
  legacyVariables: Partial<Record<TokenSlot, string>>;
  /** Default palette references for fallback resolution, keyed by slot */
  defaultPaletteRef?: Partial<Record<TokenSlot, PaletteRef>>;
  /** Default sort order */
  sortOrder: number;
}

export type ComponentTokenCategory =
  | "box"
  | "button"
  | "arrow"
  | "icon"
  | "shadow"
  | "text"
  | "title"
  | "special";

export type TokenSlot = "bg" | "text" | "border";

export type ColorMode = "light" | "dark";

/** Flat map of CSS variable name to resolved hex value */
export type FlatCssVariableMap = Record<string, string>;

/** Payload returned by the consumption API (/api/theme/css-vars) */
export interface ThemeConsumptionPayload {
  themeId: string;
  themeName: string;
  cssVariables: FlatCssVariableMap;
  legacyVariables: FlatCssVariableMap;
  paletteFallbacks: FlatCssVariableMap;
  fonts: Array<{ name: string; fontFamily: string; googleFontUrl?: string | null }>;
}

/** Payload returned by the management API */
export interface ThemeManagementPayload {
  id: string;
  name: string;
  componentTokens: ComponentTokenRecord[];
}

/** Result of contrast validation for a bg/text pair */
export interface ContrastPairResult {
  bg: string;
  text: string;
  ratio: number;
  wcagLevel: "AAA" | "AA" | "Fail";
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ContrastResult {
  ratio: number;
  level: "AAA" | "AA" | "Fail";
  largeTextLevel: "AAA" | "AA" | "Fail";
  passes: {
    aaaLargeText: boolean;
    aaaNormalText: boolean;
    aaLargeText: boolean;
    aaNormalText: boolean;
  };
}
