import { buildDefaultTokenRecords } from "./resolver";
import { getTokenGroup } from "./token-registry";
import type { ColorMode, ComponentTokenRecord, TokenSlot } from "./types";

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

export interface JsonTheme {
  name: string;
  tokens: Record<string, JsonThemeToken>;
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
