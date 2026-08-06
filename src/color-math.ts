/**
 * The one hex ⇄ rgb parser in this package, and the luminance built on it.
 *
 * These lived twice — once exported from `contrast.ts`, once private in
 * `extraction.ts` — and the copies had drifted (NEH-285): extraction's
 * `hexToRgb` rejected 3-char shorthand, so every `#ccc` scored luminance 0 and
 * was dropped as if it were pure black; extraction's `rgbToHex` never clamped,
 * so `rgb(300,0,0)` became the 7-digit `#12c0000`.
 *
 * They live in a third module rather than in either of them because neither is
 * their owner: `contrast.ts` is WCAG, `extraction.ts` is scraping remote CSS,
 * and hex arithmetic is neither. A module both import has no "local copy" for
 * the next edit to drift, which is the actual bug being fixed here — the two
 * symptoms above are only what the drift happened to produce. `contrast.ts`
 * re-exports all three, so the public API is unchanged.
 */

import type { RgbColor } from "./types";

/**
 * Convert hex color string to RGB object.
 * Supports 3-, 6- and 8-char hex with or without #.
 *
 * **8-char hex carries alpha, and this drops it** (NEH-424). The channels are
 * what luminance is computed from, and alpha is not one of them — but a caller
 * deciding whether a contrast ratio is *meaningful* needs to know it was there,
 * which is what `hexAlpha` below is for.
 *
 * The 8-char case was not merely unsupported, it was actively wrong: the length
 * check rejected it, `getLuminance` returned its `0` fallback, and every
 * translucent colour therefore scored **identically to pure black** — a 10%
 * black overlay reported a perfect 21:1 against white. Meanwhile
 * `validateJsonTheme` accepted 8-char hex all along, so a theme could carry one,
 * validate clean, and silently poison every contrast check it appeared in.
 *
 * That is the same defect as NEH-285, which the header above describes: a colour
 * one half of the package accepts and the other half misreads as black. Adding
 * a length to the regex is the fix; noticing that acceptance and parsing must
 * agree is the lesson.
 */
export function hexToRgb(hex: string): RgbColor | null {
  const cleanHex = hex.replace(/^#/, "");

  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : // 8-char is 6 channels plus 2 of alpha. Slicing rather than widening the
        // regex below keeps that pattern describing exactly three channels.
        cleanHex.length === 8
        ? cleanHex.slice(0, 6)
        : cleanHex;

  if (fullHex.length !== 6) {
    return null;
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  if (!result) {
    return null;
  }

  const [, r, g, b] = result;
  // All three groups are required by the pattern, so a match always fills
  // them — but "not a colour we can read" is already this function's answer
  // for anything it cannot parse, and that is the honest answer here too.
  if (r === undefined || g === undefined || b === undefined) {
    return null;
  }

  return {
    r: parseInt(r, 16),
    g: parseInt(g, 16),
    b: parseInt(b, 16),
  };
}

/**
 * A colour's alpha channel, 0–1. Opaque notations return 1; unreadable input
 * returns null, matching `hexToRgb`'s answer for the same.
 *
 * Exists so contrast code can tell "this is opaque" from "this is 10% of a
 * colour over something I cannot see" (NEH-424). Those are not the same
 * question and only one of them has a WCAG answer.
 */
export function hexAlpha(hex: string): number | null {
  const cleanHex = hex.replace(/^#/, "");

  if (/^[a-f\d]{3}$/i.test(cleanHex) || /^[a-f\d]{6}$/i.test(cleanHex)) return 1;
  if (/^[a-f\d]{8}$/i.test(cleanHex)) return parseInt(cleanHex.slice(6, 8), 16) / 255;

  return null;
}

/**
 * Whether a colour is anything less than fully opaque.
 *
 * **A contrast ratio involving a translucent colour is not defined** — the
 * rendered colour depends on whatever is painted behind it, which nothing in
 * this package can see. Callers use this to decline to answer rather than to
 * answer wrongly; `getContrastRatio` treats such a colour as if it were opaque,
 * which is a useful approximation and a bad basis for changing anyone's colour.
 *
 * `"transparent"` counts, and deliberately so. It is the resolver's sentinel
 * for an unset slot, and an unset slot has no colour to score either.
 */
export function isTranslucent(colour: string): boolean {
  if (colour === "transparent") return true;

  const alpha = hexAlpha(colour);
  return alpha !== null && alpha < 1;
}

/**
 * Convert RGB object to hex string (with #).
 *
 * Channels are clamped to 0–255: CSS in the wild carries out-of-range values,
 * and an unclamped channel silently yields a hex string of the wrong length
 * rather than a colour.
 */
export function rgbToHex(rgb: RgbColor): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Calculate relative luminance per WCAG 2.1.
 * Accepts a hex string (e.g. "#3a5ba0").
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getLuminance(hexColor: string): number {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 0;

  // Per-channel rather than map-then-destructure: a three-element array read
  // back by index is three chances to silently multiply by undefined.
  const toLinear = (c: number): number => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b)
  );
}
