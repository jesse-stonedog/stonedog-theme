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

/**
 * The typeface roles a theme may re-point (NEH-277).
 *
 * A closed union, not free text, for the same reason token names are: a role
 * the resolver does not know emits no property, and a property nothing defines
 * renders as nothing — silently. Three roles because three is what a brand
 * actually varies: running text, display text, and code. `stonedog-style`'s
 * *scale* (size, line-height, density) is shape and stays there; only the
 * family and the weight are brand.
 */
export type FontRole = "body" | "heading" | "mono";

/**
 * The weight steps a theme may re-point.
 *
 * These are exactly the steps `stonedog-style`'s recipes name today —
 * `normal`, `semibold`, `bold` — plus `medium`, which Panda's own
 * `fontWeights` category defines and a brand with a lighter typeface reaches
 * for first. Not the full Panda ladder (`thin` … `black`): a step no recipe
 * references is a property no one can observe, and every name here is
 * permanent once published.
 */
export type FontWeightStep = "normal" | "medium" | "semibold" | "bold";

/**
 * One typeface, as a theme carries it.
 *
 * `fontFamily` is the whole stack (`"Inter", sans-serif`), not the family name
 * — a stack without a generic fallback renders in whatever the browser picks
 * when the webfont is slow or blocked.
 *
 * `googleFontUrl` is the one part of a typeface CSS cannot deliver: a custom
 * property can name a family, but only a `<link>` (or an `@import`) can load
 * it. That is why fonts keep a payload seam that colours do not need — see
 * `googleFontUrls`.
 */
export interface ThemeFont {
  /** Human label, e.g. `Inter`. */
  name: string;
  /** CSS font-family stack to apply, e.g. `"Inter", sans-serif`. */
  fontFamily: string;
  /** Google Fonts stylesheet URL if the theme loads one, else null. */
  googleFontUrl?: string | null;
}

/** Typefaces by role. A role a theme omits falls through to the host's own CSS. */
export type ThemeFonts = Partial<Record<FontRole, ThemeFont>>;

/** Numeric CSS weights by step, e.g. `{ bold: 700 }`. */
export type ThemeFontWeights = Partial<Record<FontWeightStep, number>>;

/**
 * The typeface half of a theme — what `resolveFontsToCssVars` consumes.
 *
 * Both halves optional, and both default to empty: a theme that says nothing
 * about type is a theme that leaves type to the host, which is what every
 * theme did before NEH-277 and must keep doing.
 */
export interface ThemeFontSettings {
  fonts?: ThemeFonts;
  weights?: ThemeFontWeights;
}

/** Flat map of CSS variable name to resolved hex value */
export type FlatCssVariableMap = Record<string, string>;

/** Payload returned by the consumption API (/api/theme/css-vars) */
export interface ThemeConsumptionPayload {
  themeId: string;
  themeName: string;
  cssVariables: FlatCssVariableMap;
  legacyVariables: FlatCssVariableMap;
  paletteFallbacks: FlatCssVariableMap;
  /**
   * The theme's typefaces, in role order, for the `<link>` a stylesheet cannot
   * write itself. Structurally unchanged by NEH-277 — the inline shape it used
   * to declare is now the named `ThemeFont`, and the resolved
   * `--hopper-font-family-*` properties belong in `cssVariables` alongside the
   * colours, not here.
   */
  fonts: ThemeFont[];
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
