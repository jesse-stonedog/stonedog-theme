import * as colorMath from "../color-math";
import * as contrast from "../contrast";

/**
 * NEH-285: this package had two hex parsers — one exported from `contrast.ts`,
 * one private in `extraction.ts` — and they disagreed about 3-char shorthand
 * and about out-of-range rgb() channels. `color-math.ts` is now the single
 * implementation both import.
 */
describe("color-math is the single hex parser", () => {
  it("is the very implementation contrast.ts exports", () => {
    // Identity, not equivalence: a re-declared copy in contrast.ts would be a
    // different function object and fail here even if it behaved the same
    // today — which is exactly how the last divergence started.
    expect(contrast.hexToRgb).toBe(colorMath.hexToRgb);
    expect(contrast.rgbToHex).toBe(colorMath.rgbToHex);
    expect(contrast.getLuminance).toBe(colorMath.getLuminance);
  });
});

describe("hexToRgb", () => {
  it.each([
    ["#ccc", { r: 204, g: 204, b: 204 }],
    ["ccc", { r: 204, g: 204, b: 204 }],
    ["#cccccc", { r: 204, g: 204, b: 204 }],
    ["#333", { r: 51, g: 51, b: 51 }],
    ["#1e6f3a", { r: 30, g: 111, b: 58 }],
  ])("reads %s", (hex, expected) => {
    expect(colorMath.hexToRgb(hex)).toEqual(expected);
  });

  it("expands shorthand to exactly the 6-char form", () => {
    expect(colorMath.hexToRgb("#ccc")).toEqual(colorMath.hexToRgb("#cccccc"));
  });

  it.each(["", "#", "#cc", "#ccccc", "#ccccccc", "#gggggg", "rebeccapurple"])(
    "returns null for %s",
    (hex) => {
      expect(colorMath.hexToRgb(hex)).toBeNull();
    },
  );
});

describe("rgbToHex", () => {
  it.each([
    [{ r: 12, g: 34, b: 56 }, "#0c2238"],
    [{ r: 0, g: 0, b: 0 }, "#000000"],
    [{ r: 255, g: 255, b: 255 }, "#ffffff"],
    // Clamped, not wrapped or widened: an out-of-range channel must still
    // produce a 6-digit colour.
    [{ r: 300, g: 0, b: 0 }, "#ff0000"],
    [{ r: -20, g: 42, b: 256 }, "#002aff"],
  ])("renders %j as %s", (rgb, expected) => {
    expect(colorMath.rgbToHex(rgb)).toBe(expected);
  });

  it("always emits 6 hex digits, whatever the input range", () => {
    for (const n of [-1000, -1, 0, 1, 127.5, 255, 256, 1e6]) {
      expect(colorMath.rgbToHex({ r: n, g: n, b: n })).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("getLuminance", () => {
  it("scores shorthand and 6-char forms of one color identically", () => {
    expect(colorMath.getLuminance("#ccc")).toBe(colorMath.getLuminance("#cccccc"));
    expect(colorMath.getLuminance("#333")).toBe(colorMath.getLuminance("#333333"));
  });

  it("returns 0 for an unparseable color", () => {
    expect(colorMath.getLuminance("not-a-color")).toBe(0);
  });

  it("puts black at 0 and white at 1", () => {
    expect(colorMath.getLuminance("#000")).toBe(0);
    expect(colorMath.getLuminance("#fff")).toBeCloseTo(1, 10);
  });
});

/**
 * NEH-424: 8-char hex carries alpha, and `validateJsonTheme` has accepted it
 * all along — but `hexToRgb` rejected it on length, so `getLuminance` fell back
 * to 0 and every translucent colour scored EXACTLY as pure black.
 *
 * The shape is NEH-285's, one layer along: a colour one half of the package
 * accepts and the other half silently misreads. It is worse here, because the
 * wrong answer is not "no colour" but a confident, plausible number — a 10%
 * black overlay reported a flawless 21:1 against white, and a contrast gate
 * reading that would pass it and say so.
 */
describe("8-char hex (alpha)", () => {
  it("parses the colour channels instead of returning null", () => {
    expect(colorMath.hexToRgb("#14181c1a")).toEqual({ r: 0x14, g: 0x18, b: 0x1c });
  });

  it("scores by its channels, not as black", () => {
    // The regression. Both of these were 0 before, so the ratio below was 21.
    expect(colorMath.getLuminance("#14181c1a")).toBe(colorMath.getLuminance("#14181c"));
    expect(colorMath.getLuminance("#14181c1a")).not.toBe(colorMath.getLuminance("#000000"));
  });

  it("no longer reports a translucent overlay as a perfect contrast", () => {
    expect(contrast.getContrastRatio("#ffffff", "#14181c1a")).toBeLessThan(21);
    expect(contrast.getContrastRatio("#ffffff", "#14181c1a")).toBe(
      contrast.getContrastRatio("#ffffff", "#14181c"),
    );
  });

  it("reads the alpha channel back as 0–1", () => {
    expect(colorMath.hexAlpha("#14181c00")).toBe(0);
    expect(colorMath.hexAlpha("#14181cff")).toBe(1);
    expect(colorMath.hexAlpha("#14181c1a")).toBeCloseTo(0x1a / 255, 10);
  });

  it("calls opaque notations opaque and unreadable ones null", () => {
    expect(colorMath.hexAlpha("#fff")).toBe(1);
    expect(colorMath.hexAlpha("#14181c")).toBe(1);
    expect(colorMath.hexAlpha("not-a-color")).toBeNull();
    expect(colorMath.hexAlpha("rgba(20, 24, 28, 0.10)")).toBeNull();
  });

  it("knows which colours have no defined contrast ratio", () => {
    expect(colorMath.isTranslucent("#14181c1a")).toBe(true);
    expect(colorMath.isTranslucent("#14181cff")).toBe(false);
    expect(colorMath.isTranslucent("#14181c")).toBe(false);
    // The resolver's sentinel for an unset slot — no colour to score either.
    expect(colorMath.isTranslucent("transparent")).toBe(true);
    // Unreadable is not the same as translucent; `hexToRgb` already answers
    // "cannot read this", and conflating the two would silently exempt every
    // typo from the contrast floor.
    expect(colorMath.isTranslucent("not-a-color")).toBe(false);
  });
});
