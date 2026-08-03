import { extractColorsFromCss, categorizeColors, extractFonts } from "../extraction";
import type { ExtractedFont } from "../extraction";

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

describe("extractColorsFromCss", () => {
  it("collects hex and rgb colors", () => {
    const colors = extractColorsFromCss("a{color:#1A2B3C} b{background:rgb(255, 0, 0)} c{color:#fff}");
    expect(colors).toEqual(expect.arrayContaining(["#1a2b3c", "#ff0000", "#fff"]));
  });
});

describe("categorizeColors", () => {
  it("picks the most saturated color as primary", () => {
    const result = categorizeColors(["#1e6f3a", "#cccccc", "#222222", "#ffffff"]);
    expect(result.primary[0]).toBe("#1e6f3a");
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
