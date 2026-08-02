import { requiredCssCustomProperties } from "stonedog-style/contract";

import { resolveTokensToCssVars } from "../../src";
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
