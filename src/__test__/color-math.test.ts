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
