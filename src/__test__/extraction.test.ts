import { extractColorsFromCss, categorizeColors, extractFonts } from "../extraction";

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
    expect(fonts[0].name).toBe("Open Sans");
    expect(fonts[0].googleFontUrl).toContain("fonts.googleapis.com");
    expect(fonts[0].fontFamily).toContain("Open Sans");
  });

  it("falls back to the CSS font-family when there is no Google font", () => {
    const fonts = extractFonts("", `:root{} body { font-family: Georgia, serif; }`);
    expect(fonts[0].name).toBe("Georgia");
    expect(fonts[0].fontFamily).toContain("serif");
  });

  it("decodes &amp; in Google font link URLs", () => {
    const html = `<link href="https://fonts.googleapis.com/css?family=Lato&amp;display=swap">`;
    const fonts = extractFonts(html, "");
    expect(fonts[0].name).toBe("Lato");
    expect(fonts[0].googleFontUrl).not.toContain("&amp;");
  });

  it("returns nothing when no font information exists", () => {
    expect(extractFonts("", "a{color:red}")).toEqual([]);
  });

  it("ignores icon fonts and picks the real body font", () => {
    const css = `.fa { font-family: "FontAwesome"; } body { font-family: "Merriweather", serif; }`;
    const fonts = extractFonts("", css);
    expect(fonts[0].name).toBe("Merriweather");
  });

  it("does not return an icon font even when it is the only declaration", () => {
    expect(extractFonts("", `.fa{font-family:FontAwesome}`)).toEqual([]);
  });
});
