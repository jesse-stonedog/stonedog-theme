import { extractColorsFromCss, categorizeColors, extractFonts } from "../extraction";
import type { ExtractedFont } from "../extraction";
import { getLuminance, rgbToHex } from "../contrast";

/**
 * `extractFonts` legitimately returns an empty array, so `fonts[0]` is
 * `ExtractedFont | undefined`. Fail the test loudly on the empty case rather
 * than asserting it away — a silently-undefined font would make every
 * assertion below vacuous.
 */
function firstFont(fonts: ExtractedFont[]): ExtractedFont {
  const [font] = fonts;
  if (!font) throw new Error("expected extractFonts to return at least one font");
  return font;
}

/** "#ccc" → "#cccccc"; anything else is returned unchanged. */
function expandShorthandHex(hex: string): string {
  const body = hex.replace(/^#/, "");
  if (body.length !== 3) return hex;
  return (
    "#" +
    body
      .split("")
      .map((c) => c + c)
      .join("")
  );
}

describe("extractColorsFromCss", () => {
  it("collects hex and rgb colors", () => {
    const colors = extractColorsFromCss("a{color:#1A2B3C} b{background:rgb(255, 0, 0)} c{color:#fff}");
    expect(colors).toEqual(expect.arrayContaining(["#1a2b3c", "#ff0000", "#fff"]));
  });

  // NEH-285 bug 2: an unclamped channel produced 3 hex digits, so
  // rgb(300,0,0) became "#12c0000" — 7 digits, not a CSS colour, and offered
  // to the UI in ExtractedTheme.rawColors for manual selection.
  it("clamps an out-of-range rgb() channel instead of emitting 7-digit hex", () => {
    const colors = extractColorsFromCss("a{color:rgb(300, 0, 0)} b{color:rgb(12,34,56)}");
    expect(colors).toEqual(["#ff0000", "#0c2238"]);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("categorizeColors", () => {
  it("picks the most saturated color as primary", () => {
    const result = categorizeColors(["#1e6f3a", "#cccccc", "#222222", "#ffffff"]);
    expect(result.primary[0]).toBe("#1e6f3a");
  });

  // NEH-285 bug 1: extraction.ts's private hexToRgb accepted only 6-char hex,
  // so every shorthand colour scored luminance 0 and was dropped by the
  // `luminance > 0.01` filter meant for pure black — leaving a site written in
  // shorthand with no neutrals and the default black text, silently.
  it("categorizes shorthand hex the same as its 6-char equivalent", () => {
    const shorthand = categorizeColors(["#1e6f3a", "#ccc", "#333", "#fff"]);
    const sixChar = categorizeColors(["#1e6f3a", "#cccccc", "#333333", "#ffffff"]);

    expect(shorthand).toEqual({
      primary: ["#1e6f3a"],
      secondary: [],
      accent: [],
      neutral: ["#ccc", "#333"],
      background: "#ffffff",
      text: "#333",
    });

    // Same categories, same order — the only difference left is the hex form
    // each colour was written in, which categorizeColors passes through.
    expect({
      ...shorthand,
      primary: shorthand.primary.map(expandShorthandHex),
      secondary: shorthand.secondary.map(expandShorthandHex),
      accent: shorthand.accent.map(expandShorthandHex),
      neutral: shorthand.neutral.map(expandShorthandHex),
      background: expandShorthandHex(shorthand.background),
      text: expandShorthandHex(shorthand.text),
    }).toEqual(sixChar);
  });
});

/**
 * NEH-285's root cause: `extraction.ts` carried its own hex parser that had
 * drifted from `contrast.ts`'s. Both now call `color-math.ts`, and these
 * table-driven tests are what would go red if a third copy ever appeared —
 * they compare extraction's public entry points against contrast's exported
 * helpers over the exact inputs the two used to disagree on.
 */
describe("extraction parses colors the same way contrast does", () => {
  it.each([
    "#ccc",
    "#cccccc",
    "#333",
    "#333333",
    "#1e6f3a",
    "#fff",
    "#ffffff",
    "#000",
    "#000000",
    "#0a0a0a",
  ])("categorizeColors keeps %s exactly when contrast's luminance is in range", (hex) => {
    const inRange = getLuminance(hex) > 0.01 && getLuminance(hex) < 0.99;
    const result = categorizeColors([hex]);
    const kept = [...result.primary, ...result.secondary, ...result.accent, ...result.neutral];
    expect(kept.includes(hex)).toBe(inRange);
  });

  it.each([
    [300, 0, 0],
    [12, 34, 56],
    [255, 255, 255],
    [0, 0, 0],
    [999, 42, 256],
  ])("extractColorsFromCss renders rgb(%i,%i,%i) as contrast's rgbToHex does", (r, g, b) => {
    expect(extractColorsFromCss(`a{color:rgb(${r},${g},${b})}`)).toEqual([rgbToHex({ r, g, b })]);
  });
});

describe("extractFonts", () => {
  it("reads a Google font from a <link> and matches it to the CSS stack", () => {
    const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&display=swap">`;
    const css = `body { font-family: "Open Sans", Helvetica, sans-serif; }`;
    const fonts = extractFonts(html, css);
    expect(fonts).toHaveLength(1);
    const font = firstFont(fonts);
    expect(font.name).toBe("Open Sans");
    expect(font.googleFontUrl).toContain("fonts.googleapis.com");
    expect(font.fontFamily).toContain("Open Sans");
  });

  it("falls back to the CSS font-family when there is no Google font", () => {
    const font = firstFont(extractFonts("", `:root{} body { font-family: Georgia, serif; }`));
    expect(font.name).toBe("Georgia");
    expect(font.fontFamily).toContain("serif");
  });

  it("decodes &amp; in Google font link URLs", () => {
    const html = `<link href="https://fonts.googleapis.com/css?family=Lato&amp;display=swap">`;
    const font = firstFont(extractFonts(html, ""));
    expect(font.name).toBe("Lato");
    expect(font.googleFontUrl).not.toContain("&amp;");
  });

  it("returns nothing when no font information exists", () => {
    expect(extractFonts("", "a{color:red}")).toEqual([]);
  });

  it("ignores icon fonts and picks the real body font", () => {
    const css = `.fa { font-family: "FontAwesome"; } body { font-family: "Merriweather", serif; }`;
    expect(firstFont(extractFonts("", css)).name).toBe("Merriweather");
  });

  it("does not return an icon font even when it is the only declaration", () => {
    expect(extractFonts("", `.fa{font-family:FontAwesome}`)).toEqual([]);
  });
});
