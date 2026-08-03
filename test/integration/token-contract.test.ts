import { colorTokenNames, requiredCssCustomProperties } from "stonedog-style/contract";

import {
  FONT_ROLES,
  FONT_WEIGHT_STEPS,
  getFontFamilyCssVarName,
  getFontWeightCssVarName,
  resolveFontsToCssVars,
  resolveTokensToCssVars,
} from "../../src";
import { populatedTheme } from "../fixtures/populated-theme";

/**
 * The contract between this package and stonedog-style (NEH-263).
 *
 * stonedog-style knows no colours. Every colour is a Panda token whose value is
 * a bare CSS custom property, and `requiredCssCustomProperties()` is the list of
 * properties a host must define for the components to render at all.
 *
 * This package's job is to produce them. Nothing checked that it did.
 *
 * **The failure mode is why this matters more than a normal missing test.** A
 * token whose property is undefined renders as *nothing* — no build error, no
 * console warning, no type error. An invisible element still has a bounding
 * box, so even a layout assertion passes. Three bugs of exactly this shape were
 * found during the original extraction (NEH-165/166/171).
 *
 * The list is imported from the sibling checkout rather than copied here. Two
 * copies of a contract drift, and this test exists precisely because that drift
 * is undetectable at runtime.
 */

const MODES = ["light", "dark"] as const;

describe("the stonedog-style token contract", () => {
  describe.each(MODES)("in %s mode", (mode) => {
    it("produces every required custom property", () => {
      const produced = new Set(
        Object.keys(resolveTokensToCssVars(populatedTheme(), mode)),
      );
      const missing = requiredCssCustomProperties().filter(
        (property) => !produced.has(property),
      );

      // Named, not counted. "3 missing" sends someone diffing two lists by
      // hand; the names are the entire content of the failure.
      expect(missing).toEqual([]);
    });
  });

  it("honours a custom cssVarPrefix, which both Optima products use", () => {
    // The prefix re-points every property (NEH-170). A resolver that hardcoded
    // `hopper` would satisfy the default case above and fail every Optima
    // build — with invisible components rather than an error.
    const required = requiredCssCustomProperties("optima");

    expect(required.length).toBeGreaterThan(0);
    expect(required.every((p) => p.startsWith("--optima-"))).toBe(true);
    expect(required).toHaveLength(requiredCssCustomProperties().length);
  });

  it("is not satisfied vacuously by an unpopulated theme", () => {
    // Guards the test above against its own worst failure. `buildDefaultTokenRecords`
    // yields all-"transparent" slots, and the resolver rightly skips them — so a
    // fixture that forgot to fill anything would resolve to nothing, and a
    // subset check against nothing would... still be a subset of nothing only if
    // the required list were empty. Assert the fixture is doing real work, so
    // this suite cannot quietly degrade into testing an empty set.
    const resolved = resolveTokensToCssVars(populatedTheme(), "light");

    expect(Object.keys(resolved).length).toBeGreaterThanOrEqual(
      requiredCssCustomProperties().length,
    );
    expect(Object.values(resolved).every((v) => v !== "transparent")).toBe(true);
  });

  it("does not make the font properties a host's problem", () => {
    // The answer to "must hosts now define new custom properties?" — no
    // (NEH-277).
    //
    // `requiredCssCustomProperties()` is the list a host MUST define or render
    // nothing, and it is one property per colour token: that identity is pinned
    // on stonedog-style's side too, and the issue is explicit that it may only
    // change deliberately. Typefaces do not belong in it. An undefined colour
    // paints an invisible element; an undefined font falls back to the
    // browser's own face and the page stays readable — so when stonedog-style
    // does consume these, it must be through a token carrying a fallback (the
    // `SIZE_TOKENS` pattern), not by joining this list.
    //
    // The consequence, and the reason this assertion is here rather than in a
    // comment: everything NEH-277 adds is inert until something reads it. That
    // is what makes it safe to land alone, and what a follow-up in
    // stonedog-style has to finish.
    const required = requiredCssCustomProperties();

    expect(required).toHaveLength(colorTokenNames().length);
    for (const property of [
      ...FONT_ROLES.map(getFontFamilyCssVarName),
      ...FONT_WEIGHT_STEPS.map(getFontWeightCssVarName),
    ]) {
      expect(required).not.toContain(property);
    }
  });

  it("adds font properties to a resolved theme without disturbing the colours", () => {
    const colours = resolveTokensToCssVars(populatedTheme(), "light");
    const merged = {
      ...colours,
      ...resolveFontsToCssVars({
        fonts: { body: { name: "Inter", fontFamily: '"Inter", sans-serif' } },
        weights: { bold: 700 },
      }),
    };
    const missing = requiredCssCustomProperties().filter((property) => !(property in merged));

    expect(missing).toEqual([]);
    expect(merged["--hopper-font-family-body"]).toBe('"Inter", sans-serif');
  });

  it("resolves light and dark to different values", () => {
    // Both modes satisfying the contract is necessary but not sufficient: a
    // resolver that ignored `mode` would pass every assertion above while
    // shipping one palette for both schemes.
    const light = resolveTokensToCssVars(populatedTheme(), "light");
    const dark = resolveTokensToCssVars(populatedTheme(), "dark");

    const shared = Object.keys(light).filter((k) => k in dark);
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.some((k) => light[k] !== dark[k])).toBe(true);
  });
});
