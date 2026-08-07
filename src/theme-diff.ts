/**
 * Comparing two themes by what they actually paint.
 *
 * A push and a pull both need to answer one question — *would applying this
 * change anything?* — and both need the same answer, or the two directions
 * disagree about whether a product is in sync.
 *
 * **The comparison is over resolved CSS custom properties, not over records.**
 * Two token sets can match field-by-field and still paint differently, and can
 * differ field-by-field and paint identically. Both directions happen here:
 *
 * - The resolver holds every text/background pair to a WCAG AA floor, so a
 *   stored `#777777` on `#888888` and a stored `#3a3a3a` on `#888888` can
 *   resolve to the same emitted colour. Records differ; nothing on screen does.
 * - A `"transparent"` slot emits **no property at all**, so a token that gains
 *   one goes from absent to present rather than from one value to another. A
 *   record-level diff sees a changed string; the page sees an element appear.
 *
 * Pure, no filesystem — this lives in the main entry so a consumer can use it
 * without pulling `node:fs` into a bundler's graph. The catalogue's own
 * read/write half is `@stonedogcode/theme/catalogue`.
 */

import { resolveTokensToCssVars, resolveFontsToCssVars } from "./resolver";
import { DEFAULT_CSS_VAR_PREFIX } from "./token-registry";
import type { ColorMode, ComponentTokenRecord, ThemeFontSettings } from "./types";

/** One property that differs, and what each side has for it. */
export interface ThemePropertyDifference {
  /** The custom property, e.g. `--hopper-box-primary-bg`. */
  property: string;
  /** Which colour mode it was resolved in, or `null` for a font property. */
  colorMode: ColorMode | null;
  /** `undefined` where a side does not emit the property at all. */
  before: string | undefined;
  after: string | undefined;
}

/** Both halves of a theme, as the resolver wants them. */
export interface ResolvableTheme {
  tokens: ComponentTokenRecord[];
  fonts?: ThemeFontSettings;
}

const MODES: readonly ColorMode[] = ["light", "dark"];

/**
 * Every custom property on which two themes disagree, in both colour modes.
 *
 * An empty array means applying `after` in place of `before` would change
 * nothing on screen — which is the definition of "already in sync" that both
 * push and pull should use, and the property NEH-333 asks the tests to assert.
 *
 * Both modes are always compared. A theme is two palettes, and one of them
 * being right says nothing about the other: a light-mode-only comparison passes
 * happily on a theme whose dark half was never updated.
 *
 * Differences are returned rather than counted. "3 properties differ" sends
 * someone diffing two files by hand; the names are the whole content of the
 * answer, and for a theme they point straight at the surface that moved.
 */
export function diffResolvedThemes(
  before: ResolvableTheme,
  after: ResolvableTheme,
  cssVarPrefix: string = DEFAULT_CSS_VAR_PREFIX,
): ThemePropertyDifference[] {
  const differences: ThemePropertyDifference[] = [];

  for (const colorMode of MODES) {
    const a = resolveTokensToCssVars(before.tokens, colorMode, cssVarPrefix);
    const b = resolveTokensToCssVars(after.tokens, colorMode, cssVarPrefix);

    // The union of both key sets, not just one side's. Iterating only `a` misses
    // every property `b` adds, so a theme that gained a surface would report as
    // unchanged — the exact case where a slot went from "transparent" (emitting
    // nothing) to a real colour.
    for (const property of unionOfKeys(a, b)) {
      if (a[property] !== b[property]) {
        differences.push({ property, colorMode, before: a[property], after: b[property] });
      }
    }
  }

  const fontsA = before.fonts ? resolveFontsToCssVars(before.fonts, cssVarPrefix) : {};
  const fontsB = after.fonts ? resolveFontsToCssVars(after.fonts, cssVarPrefix) : {};

  for (const property of unionOfKeys(fontsA, fontsB)) {
    if (fontsA[property] !== fontsB[property]) {
      // Fonts do not vary by colour mode, so reporting one here would imply a
      // distinction that does not exist.
      differences.push({
        property,
        colorMode: null,
        before: fontsA[property],
        after: fontsB[property],
      });
    }
  }

  return differences;
}

/** Whether applying `after` in place of `before` would change anything rendered. */
export function themesResolveIdentically(
  before: ResolvableTheme,
  after: ResolvableTheme,
  cssVarPrefix: string = DEFAULT_CSS_VAR_PREFIX,
): boolean {
  return diffResolvedThemes(before, after, cssVarPrefix).length === 0;
}

function unionOfKeys(a: Record<string, string>, b: Record<string, string>): string[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
}
