/**
 * Extract a theme (colors + fonts) from a public web page.
 *
 * This is the shared core behind both the `/api/themes/extract-colors` route
 * and the seed script that derives a facility theme from a brand's marketing
 * site. It fetches the page HTML + a few linked stylesheets and pulls out a
 * categorized color palette and the primary font (incl. a Google Fonts URL
 * when the site loads one).
 *
 * No external dependencies — uses the global fetch and regex parsing so it
 * runs unchanged in a Next route handler and a standalone tsx script.
 */

export interface ExtractedColors {
  primary: string[];
  secondary: string[];
  accent: string[];
  neutral: string[];
  background: string;
  text: string;
}

export interface ExtractedFont {
  /** Human label, e.g. "Inter". */
  name: string;
  /** CSS font-family stack to apply, e.g. `"Inter", sans-serif`. */
  fontFamily: string;
  /** Google Fonts stylesheet URL if the page loads one, else null. */
  googleFontUrl: string | null;
}

export interface ExtractedTheme {
  url: string;
  colors: ExtractedColors;
  /** First 50 raw hex colors found, for manual selection in the UI. */
  rawColors: string[];
  /** Primary fonts detected (0–2), most significant first. */
  fonts: ExtractedFont[];
}

// ── Color parsing ─────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const [, r, g, b] = result;
  // Unparseable is already this function's null case; a match missing a group
  // belongs there rather than becoming NaN channels downstream.
  if (r === undefined || g === undefined || b === undefined) return null;

  return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16) };
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (channel: number): number => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return (
    toLinear(rgb.r) * 0.2126 + toLinear(rgb.g) * 0.7152 + toLinear(rgb.b) * 0.0722
  );
}

function getSaturation(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

export function extractColorsFromCss(css: string): string[] {
  const colors: Set<string> = new Set();

  const hexRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let match: RegExpExecArray | null;
  while ((match = hexRegex.exec(css)) !== null) {
    colors.add(match[0].toLowerCase());
  }

  const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
  while ((match = rgbRegex.exec(css)) !== null) {
    const [, r, g, b] = match;
    // A declaration we cannot read all three channels of contributes no
    // colour, the same as one that never matched.
    if (r === undefined || g === undefined || b === undefined) continue;
    colors.add(rgbToHex(parseInt(r), parseInt(g), parseInt(b)));
  }

  return Array.from(colors);
}

export function categorizeColors(colors: string[]): ExtractedColors {
  const result: ExtractedColors = {
    primary: [],
    secondary: [],
    accent: [],
    neutral: [],
    background: "#ffffff",
    text: "#000000",
  };

  const colorData = colors
    .map((color) => ({ hex: color, luminance: getLuminance(color), saturation: getSaturation(color) }))
    .filter((c) => c.luminance > 0.01 && c.luminance < 0.99); // drop pure black/white

  const saturatedColors = [...colorData].sort((a, b) => b.saturation - a.saturation);
  const highSaturation = saturatedColors.filter((c) => c.saturation > 0.3);
  const lowSaturation = saturatedColors.filter((c) => c.saturation <= 0.3);

  const [mostSaturated, nextSaturated] = highSaturation;
  if (mostSaturated) {
    result.primary.push(mostSaturated.hex);
    if (nextSaturated) result.secondary.push(nextSaturated.hex);
    if (highSaturation.length > 2) result.accent = highSaturation.slice(2, 5).map((c) => c.hex);
  }

  result.neutral = lowSaturation.slice(0, 5).map((c) => c.hex);

  const lightestNeutral = colorData
    .filter((c) => c.saturation < 0.1 && c.luminance > 0.9)
    .sort((a, b) => b.luminance - a.luminance)[0];
  if (lightestNeutral) result.background = lightestNeutral.hex;

  const darkestNeutral = colorData
    .filter((c) => c.saturation < 0.2 && c.luminance < 0.3)
    .sort((a, b) => a.luminance - b.luminance)[0];
  if (darkestNeutral) result.text = darkestNeutral.hex;

  return result;
}

// ── Font parsing ──────────────────────────────────────────

const GENERIC_FAMILIES = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "inherit",
  "initial",
  "unset",
]);

// Icon / utility fonts must never become the body font — they'd render text as
// glyphs. Sites commonly declare these in CSS (e.g. `.fa{font-family:FontAwesome}`).
const ICON_FONT_RE =
  /font[\s-]?awesome|fontawesome|material[\s-]?icons|glyphicon|icomoon|ionicons|feather|dashicons|themify|simple-line|bootstrap-icons|^fa$/i;

function isIconFont(name: string): boolean {
  return ICON_FONT_RE.test(name.trim());
}

/** Collect Google Fonts stylesheet URLs from <link> tags and CSS @imports. */
function extractGoogleFontUrls(html: string, css: string): string[] {
  const urls = new Set<string>();
  const linkRegex = /<link[^>]+href=["']([^"']*fonts\.googleapis\.com[^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1];
    if (href !== undefined) urls.add(href.replace(/&amp;/g, "&"));
  }
  const importRegex = /@import\s+(?:url\()?["']?([^"')]*fonts\.googleapis\.com[^"')]*)["']?\)?/gi;
  while ((m = importRegex.exec(css)) !== null) {
    const href = m[1];
    if (href !== undefined) urls.add(href.replace(/&amp;/g, "&"));
  }
  return Array.from(urls);
}

/** Pull the `family=` names out of a Google Fonts URL (css or css2). */
function familiesFromGoogleUrl(url: string): string[] {
  const families: string[] = [];
  const familyRegex = /[?&]family=([^&]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = familyRegex.exec(url)) !== null) {
    const value = m[1];
    if (value === undefined) continue;
    // "Open+Sans:wght@400;700" → "Open Sans"
    const [family] = decodeURIComponent(value).split(":");
    if (family === undefined) continue;
    const name = family.replace(/\+/g, " ").trim();
    if (name) families.push(name);
  }
  return families;
}

/** The first concrete (non-generic, non-icon) family from a font-family stack. */
function firstConcreteFamily(stack: string): string | null {
  for (const raw of stack.split(",")) {
    const family = raw.trim().replace(/^["']|["']$/g, "");
    if (!family) continue;
    if (GENERIC_FAMILIES.has(family.toLowerCase())) continue;
    if (family.startsWith("var(")) continue;
    if (isIconFont(family)) continue;
    return family;
  }
  return null;
}

/**
 * Prefer the body/html/:root font-family declaration; otherwise the first
 * declaration that yields a usable (non-icon, non-generic) family — so icon
 * fonts like FontAwesome never get mistaken for the body font.
 */
function primaryFontStack(css: string): string | null {
  const scoped =
    /(?:^|[},])\s*(?:body|html|:root)[^{]*\{[^}]*?font-family\s*:\s*([^;}]+)/i.exec(css);
  const scopedStack = scoped?.[1];
  if (scopedStack !== undefined && firstConcreteFamily(scopedStack)) return scopedStack.trim();
  const re = /font-family\s*:\s*([^;}]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const stack = m[1];
    if (stack !== undefined && firstConcreteFamily(stack)) return stack.trim();
  }
  return null;
}

export function extractFonts(html: string, css: string): ExtractedFont[] {
  const googleUrls = extractGoogleFontUrls(html, css);
  const googleFamilies = googleUrls.flatMap(familiesFromGoogleUrl).filter((f) => !isIconFont(f));
  const cssStack = primaryFontStack(css);
  const cssFamily = cssStack ? firstConcreteFamily(cssStack) : null;

  // Pick the headline family: a Google family that also appears in the CSS
  // stack wins; else the first Google family; else the CSS family.
  const name =
    (cssFamily && googleFamilies.find((g) => g.toLowerCase() === cssFamily.toLowerCase())) ||
    googleFamilies[0] ||
    cssFamily ||
    null;

  if (!name) return [];

  const matchingUrl =
    googleUrls.find((u) => familiesFromGoogleUrl(u).some((g) => g.toLowerCase() === name.toLowerCase())) ||
    googleUrls[0] ||
    null;

  // Build a sane stack: prefer the page's own stack if it leads with our font,
  // else wrap the family with a sensible generic fallback.
  const generic = cssStack && /serif/i.test(cssStack) && !/sans-serif/i.test(cssStack) ? "serif" : "sans-serif";
  const fontFamily =
    cssFamily && cssFamily.toLowerCase() === name.toLowerCase() && cssStack
      ? cssStack
      : `"${name}", ${generic}`;

  return [{ name, fontFamily, googleFontUrl: matchingUrl }];
}

// ── Fetch + orchestrate ───────────────────────────────────

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

/** Fetch a page's HTML and concatenate inline + linked CSS (up to 3 files). */
export async function fetchPageStyles(url: string): Promise<{ html: string; css: string }> {
  const parsedUrl = new URL(url);
  const response = await fetch(parsedUrl.toString(), { headers: BROWSER_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} — the site may be blocking automated requests`);
  }
  const html = await response.text();

  let css = "";
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const inlineStyleRegex = /style=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = styleRegex.exec(html)) !== null) css += match[1] + " ";
  while ((match = inlineStyleRegex.exec(html)) !== null) css += match[1] + " ";

  const linkRegex = /<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*>/gi;
  const cssLinks: string[] = [];
  while ((match = linkRegex.exec(html)) !== null && cssLinks.length < 3) {
    const href = match[1];
    if (href === undefined) continue;
    try {
      cssLinks.push(new URL(href, parsedUrl.origin).toString());
    } catch {
      /* invalid URL, skip */
    }
  }
  for (const cssUrl of cssLinks) {
    try {
      const cssResponse = await fetch(cssUrl, {
        headers: { ...BROWSER_HEADERS, Accept: "text/css,*/*;q=0.1", Referer: parsedUrl.origin },
      });
      if (cssResponse.ok) css += (await cssResponse.text()) + " ";
    } catch {
      /* failed to fetch CSS, continue */
    }
  }

  return { html, css };
}

/** Fetch a page and extract its colors + primary font. */
export async function extractThemeFromUrl(url: string): Promise<ExtractedTheme> {
  const { html, css } = await fetchPageStyles(url);
  const rawColors = extractColorsFromCss(css);
  return {
    url,
    colors: categorizeColors(rawColors),
    rawColors: rawColors.slice(0, 50),
    fonts: extractFonts(html, css),
  };
}
