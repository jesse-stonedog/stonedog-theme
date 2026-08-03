import { buildDefaultTokenRecords } from "./resolver";
import {
  FONT_ROLES,
  FONT_WEIGHT_STEPS,
  MIN_FONT_WEIGHT,
  MAX_FONT_WEIGHT,
  getTokenGroup,
} from "./token-registry";
import type {
  ColorMode,
  ComponentTokenRecord,
  FontRole,
  FontWeightStep,
  ThemeFont,
  ThemeFontSettings,
  ThemeFonts,
  ThemeFontWeights,
  TokenSlot,
} from "./types";

/**
 * The JSON theme format — for hosts with one theme, not a theme editor.
 *
 * HopperGuard keeps many themes in a database and edits them through a UI.
 * RozCards and both Optima products have exactly one theme each, and a database
 * table for a single row of colours is machinery nobody benefits from. Same
 * resolver either way: both paths produce `ComponentTokenRecord[]`, which is
 * what makes the source an implementation detail rather than an architecture.
 *
 * ```jsonc
 * {
 *   "name": "Supergirl",
 *   "fonts": {
 *     "body": {
 *       "name": "Inter",
 *       "fontFamily": "\"Inter\", sans-serif",
 *       "googleFontUrl": "https://fonts.googleapis.com/css2?family=Inter"
 *     }
 *   },
 *   "fontWeights": { "normal": 400, "bold": 700 },
 *   "tokens": {
 *     "boxPrimary": {
 *       "bg":     { "light": "#1e293b", "dark": "#0f172a" },
 *       "text":   { "light": "#f8fafc", "dark": "#f8fafc" },
 *       "border": { "light": "#475569", "dark": "#334155" }
 *     }
 *   }
 * }
 * ```
 *
 * `fonts` and `fontWeights` are both optional and both new in NEH-277 — before
 * it a JSON theme could not express a typeface at all, so a file-based host had
 * no way to brand its type short of writing the CSS by hand. Omit them and
 * nothing is emitted, which is what every theme written before this did.
 *
 * Slots a token does not use are omitted, not set to `"transparent"` — the
 * registry already knows which slots each token has (`activeSlots`), and making
 * a file restate that invites the two disagreeing.
 */

/** A colour in both schemes. A theme carries light and dark together (NEH-251). */
export interface JsonThemeColor {
  light: string;
  dark: string;
}

export interface JsonThemeToken {
  bg?: JsonThemeColor;
  text?: JsonThemeColor;
  border?: JsonThemeColor;
}

/**
 * One typeface in a theme file.
 *
 * `name` is required rather than derived from the head of `fontFamily`. Pulling
 * the first concrete family out of a stack is real parsing — `extraction.ts`
 * already does it, for scraped CSS — and a second copy of that logic here is
 * how this package got NEH-285. One extra word in a hand-written file is the
 * cheaper trade.
 */
export interface JsonThemeFont {
  name: string;
  fontFamily: string;
  googleFontUrl?: string | null;
}

export interface JsonTheme {
  name: string;
  tokens: Record<string, JsonThemeToken>;
  fonts?: Record<string, JsonThemeFont>;
  fontWeights?: Record<string, number>;
}

/** What went wrong, in terms a person can act on. */
export class JsonThemeError extends Error {
  constructor(
    message: string,
    readonly problems: readonly string[],
  ) {
    super(`${message}\n  - ${problems.join("\n  - ")}`);
    this.name = "JsonThemeError";
  }
}

const SLOTS: readonly TokenSlot[] = ["bg", "text", "border"];
const MODES: readonly ColorMode[] = ["light", "dark"];

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, or the explicit opt-out. */
const COLOR = /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|transparent)$/;

function isFontRole(key: string): key is FontRole {
  return (FONT_ROLES as readonly string[]).includes(key);
}

function isFontWeightStep(key: string): key is FontWeightStep {
  return (FONT_WEIGHT_STEPS as readonly string[]).includes(key);
}

/**
 * Everything wrong with a `fonts` block.
 *
 * An unknown role is rejected rather than ignored, for the reason an unknown
 * token name is: the property it should have defined simply never appears, and
 * the page renders in the browser's default face with nothing to explain why.
 */
function fontProblems(fonts: unknown): string[] {
  if (fonts === undefined) return [];
  if (typeof fonts !== "object" || fonts === null) {
    return ["`fonts` must be an object"];
  }

  const problems: string[] = [];

  for (const [role, font] of Object.entries(fonts)) {
    if (!isFontRole(role)) {
      problems.push(`unknown font role \`${role}\` (expected ${FONT_ROLES.join(", ")})`);
      continue;
    }
    if (typeof font !== "object" || font === null) {
      problems.push(`\`fonts.${role}\` must be an object`);
      continue;
    }

    const candidate = font as Record<string, unknown>;

    for (const field of ["name", "fontFamily"] as const) {
      const value = candidate[field];
      if (typeof value !== "string" || value.trim() === "") {
        problems.push(`\`fonts.${role}.${field}\` must be a non-empty string`);
      }
    }

    const url = candidate["googleFontUrl"];
    if (url !== undefined && url !== null) {
      // Absolute https only. This value ends up as the `href` of a `<link>` the
      // host injects into its own document, and a theme file is the one place a
      // hand-authored string gets that far — a relative path silently resolves
      // against the wrong origin, and a `javascript:` URL is a scripting bug
      // wearing a stylesheet's clothes.
      if (typeof url !== "string" || !url.startsWith("https://")) {
        problems.push(
          `\`fonts.${role}.googleFontUrl\` must be an absolute https:// URL or null`,
        );
      }
    }
  }

  return problems;
}

/** Everything wrong with a `fontWeights` block. */
function fontWeightProblems(weights: unknown): string[] {
  if (weights === undefined) return [];
  if (typeof weights !== "object" || weights === null) {
    return ["`fontWeights` must be an object"];
  }

  const problems: string[] = [];

  for (const [step, weight] of Object.entries(weights)) {
    if (!isFontWeightStep(step)) {
      problems.push(
        `unknown font weight \`${step}\` (expected ${FONT_WEIGHT_STEPS.join(", ")})`,
      );
      continue;
    }
    if (
      typeof weight !== "number" ||
      !Number.isInteger(weight) ||
      weight < MIN_FONT_WEIGHT ||
      weight > MAX_FONT_WEIGHT
    ) {
      // `"bold"` is the tempting thing to write here and it cannot work: the
      // property feeds a `font-weight` declaration, and a keyword there would
      // be re-resolved against the *host's* faces rather than the theme's.
      problems.push(
        `\`fontWeights.${step}\` must be an integer ${MIN_FONT_WEIGHT}–${MAX_FONT_WEIGHT}`,
      );
    }
  }

  return problems;
}

/**
 * Everything wrong with a theme file, in one pass.
 *
 * Collected rather than thrown on the first problem, because a theme is
 * authored by hand and fixing eight typos one failed build at a time is eight
 * builds. Returns the list; `parseJsonTheme` is the throwing wrapper.
 */
export function validateJsonTheme(theme: unknown): string[] {
  const problems: string[] = [];

  if (typeof theme !== "object" || theme === null) {
    return ["theme must be an object"];
  }
  const candidate = theme as Partial<JsonTheme>;

  if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
    problems.push("`name` must be a non-empty string");
  }

  // Before the `tokens` early return below, so a file with a broken `tokens`
  // block still reports its font problems in the same pass.
  problems.push(...fontProblems(candidate.fonts));
  problems.push(...fontWeightProblems(candidate.fontWeights));

  if (typeof candidate.tokens !== "object" || candidate.tokens === null) {
    problems.push("`tokens` must be an object");
    return problems;
  }

  for (const [tokenName, token] of Object.entries(candidate.tokens)) {
    // An unknown token name is almost always a typo, and a typo here is
    // invisible: the property it should have defined simply never appears, and
    // the component paints nothing. Rejecting is much kinder than ignoring.
    if (!getTokenGroup(tokenName)) {
      problems.push(`unknown token \`${tokenName}\` (not in the token registry)`);
      continue;
    }
    if (typeof token !== "object" || token === null) {
      problems.push(`\`${tokenName}\` must be an object`);
      continue;
    }

    for (const slot of SLOTS) {
      const value = (token as Record<string, unknown>)[slot];
      if (value === undefined) continue;
      if (typeof value !== "object" || value === null) {
        problems.push(`\`${tokenName}.${slot}\` must be { light, dark }`);
        continue;
      }
      for (const mode of MODES) {
        const colour = (value as Record<string, unknown>)[mode];
        if (typeof colour !== "string") {
          // Both modes required whenever a slot is present. A theme with only
          // light is a theme that renders nothing in dark, silently.
          problems.push(`\`${tokenName}.${slot}.${mode}\` is missing`);
        } else if (!COLOR.test(colour)) {
          problems.push(
            `\`${tokenName}.${slot}.${mode}\` is not a hex colour or "transparent": ${colour}`,
          );
        }
      }
    }
  }

  return problems;
}

/**
 * What an author writes vs what the resolver can be told.
 *
 * `"transparent"` is the resolver's sentinel for "this slot is unset", and that
 * is deliberate rather than accidental: emitting `--x: transparent` would
 * override the `var()` palette-fallback chain in semantic-variables.ts, so a
 * slot a theme does not speak to has to emit *nothing at all*.
 *
 * But `"transparent"` is also a colour someone legitimately means — a plain
 * button's background is transparent, and that is what makes it plain. Written
 * literally in a theme file it produced no property, failed the contract check,
 * and gave no clue why (NEH-267). It cost a real debugging session on RozCards'
 * theme.
 *
 * So the loader translates: an author writes the obvious thing, and it becomes
 * `#00000000` — the same pixel, but a *value*, which overrides the fallback the
 * way an explicit choice should. The sentinel keeps its meaning; only slots the
 * file omits are left unset.
 *
 * Not fixed in the resolver on purpose. Making it emit `transparent` would
 * break that fallback chain for every existing HopperGuard theme, whose slots
 * are stored with exactly this sentinel.
 */
const EXPLICIT_TRANSPARENT = "#00000000";

function asValue(colour: string): string {
  return colour === "transparent" ? EXPLICIT_TRANSPARENT : colour;
}

/**
 * A validated theme file as records the resolver understands.
 *
 * Starts from `buildDefaultTokenRecords`, so every registered token exists even
 * if the file mentions none of them — the resolver skips `"transparent"` slots,
 * and a token the file omits should render as nothing *deliberately* rather
 * than crash the lookup.
 *
 * @throws {JsonThemeError} with every problem found, not just the first.
 */
export function parseJsonTheme(
  theme: unknown,
  themeId = "json",
): ComponentTokenRecord[] {
  const problems = validateJsonTheme(theme);
  if (problems.length > 0) {
    throw new JsonThemeError("invalid theme", problems);
  }

  const { tokens } = theme as JsonTheme;
  return buildDefaultTokenRecords(themeId).map((record) => {
    const source = tokens[record.name];
    if (!source) return record;

    return {
      ...record,
      ...(source.bg && {
        bgLight: asValue(source.bg.light),
        bgDark: asValue(source.bg.dark),
      }),
      ...(source.text && {
        textLight: asValue(source.text.light),
        textDark: asValue(source.text.dark),
      }),
      ...(source.border && {
        borderLight: asValue(source.border.light),
        borderDark: asValue(source.border.dark),
      }),
    };
  });
}

/**
 * The typeface half of a validated theme file, ready for `resolveFontsToCssVars`.
 *
 * Separate from `parseJsonTheme` rather than bolted onto its return value,
 * because that function's contract is `ComponentTokenRecord[]` — the seam every
 * loader meets the resolver at — and widening it would make the DB loader
 * (NEH-264) return a shape it has no rows for. Colours and type resolve
 * independently and merge into one map at the end.
 *
 * A file with no `fonts`/`fontWeights` yields empty records, not a throw: type
 * is optional in a theme, and always has been.
 *
 * @throws {JsonThemeError} with every problem found, not just the first.
 */
export function parseJsonThemeFonts(theme: unknown): ThemeFontSettings {
  const problems = validateJsonTheme(theme);
  if (problems.length > 0) {
    throw new JsonThemeError("invalid theme", problems);
  }

  const { fonts = {}, fontWeights = {} } = theme as JsonTheme;

  const resolvedFonts: ThemeFonts = {};
  for (const role of FONT_ROLES) {
    const source = fonts[role];
    if (!source) continue;

    // Built field by field rather than spread, so an unrecognised key in the
    // file cannot ride into the payload — and so `exactOptionalPropertyTypes`
    // sees `googleFontUrl` omitted rather than present-and-undefined.
    const font: ThemeFont = { name: source.name, fontFamily: source.fontFamily };
    resolvedFonts[role] =
      source.googleFontUrl === undefined
        ? font
        : { ...font, googleFontUrl: source.googleFontUrl };
  }

  const resolvedWeights: ThemeFontWeights = {};
  for (const step of FONT_WEIGHT_STEPS) {
    const weight = fontWeights[step];
    if (weight !== undefined) resolvedWeights[step] = weight;
  }

  return { fonts: resolvedFonts, weights: resolvedWeights };
}
