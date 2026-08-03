/**
 * WCAG Contrast Utilities (consolidated from apps/web/lib/contrast.ts
 * and apps/web/lib/utils/contrast.ts).
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */

import type { RgbColor, ContrastResult, ContrastPairResult } from "./types";

/**
 * Convert hex color string to RGB object.
 * Supports 3-char and 6-char hex with or without #.
 */
export function hexToRgb(hex: string): RgbColor | null {
  const cleanHex = hex.replace(/^#/, "");

  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
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
 * Convert RGB object to hex string (with #).
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

/**
 * Calculate contrast ratio between two hex colors.
 * Returns a value between 1 and 21.
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get WCAG compliance level for a given contrast ratio.
 */
export function getWCAGLevel(
  ratio: number,
  isLargeText: boolean = false,
): "AAA" | "AA" | "Fail" {
  const aaaThreshold = isLargeText ? 4.5 : 7;
  const aaThreshold = isLargeText ? 3 : 4.5;

  if (ratio >= aaaThreshold) return "AAA";
  if (ratio >= aaThreshold) return "AA";
  return "Fail";
}

/**
 * Comprehensive contrast analysis for a foreground/background pair.
 */
export function analyzeContrast(
  foreground: string,
  background: string,
): ContrastResult {
  const ratio = getContrastRatio(foreground, background);

  return {
    ratio,
    level: getWCAGLevel(ratio, false),
    largeTextLevel: getWCAGLevel(ratio, true),
    passes: {
      aaaLargeText: ratio >= 4.5,
      aaaNormalText: ratio >= 7,
      aaLargeText: ratio >= 3,
      aaNormalText: ratio >= 4.5,
    },
  };
}

/**
 * Find the closest shade in a palette that meets AAA contrast
 * against a given background color.
 */
export function findAAACompliantShade(
  backgroundColor: string,
  palette: Array<{ shade: string | number; hexValue: string }>,
  isLargeText: boolean = false,
): { shade: string | number; hexValue: string } | null {
  const aaaThreshold = isLargeText ? 4.5 : 7;

  const compliantShades = palette
    .map((shade) => ({
      shade,
      ratio: getContrastRatio(backgroundColor, shade.hexValue),
    }))
    .filter((item) => item.ratio >= aaaThreshold)
    .sort((a, b) => a.ratio - b.ratio);

  const closest = compliantShades[0];
  return closest ? closest.shade : null;
}

/**
 * Suggest a contrast fix by finding the best compliant shade.
 */
export function suggestContrastFix(
  foreground: string,
  background: string,
  palette: Array<{ shade: string | number; hexValue: string }>,
): { shade: { shade: string | number; hexValue: string }; direction: "lighter" | "darker" } | null {
  const fgLuminance = getLuminance(foreground);
  const aaaThreshold = 7;

  const compliantShades = palette
    .map((shade) => ({
      shade,
      ratio: getContrastRatio(background, shade.hexValue),
      luminance: getLuminance(shade.hexValue),
    }))
    .filter((item) => item.ratio >= aaaThreshold);

  compliantShades.sort(
    (a, b) =>
      Math.abs(a.luminance - fgLuminance) - Math.abs(b.luminance - fgLuminance),
  );

  // One guard instead of a length check plus an unchecked [0]: an empty
  // palette and a palette with nothing compliant are the same answer.
  const best = compliantShades[0];
  if (!best) return null;

  const direction: "lighter" | "darker" =
    best.luminance > fgLuminance ? "lighter" : "darker";

  return { shade: best.shade, direction };
}

/**
 * Adjust a foreground color to achieve a target contrast ratio against a background.
 */
export function adjustForContrast(
  foreground: string,
  background: string,
  targetRatio: number = 7,
): string {
  const bgRgb = hexToRgb(background);
  const fgRgb = hexToRgb(foreground);

  if (!bgRgb || !fgRgb) {
    return foreground;
  }

  const bgLuminance = getLuminance(background);
  let currentRatio = getContrastRatio(foreground, background);

  if (currentRatio >= targetRatio) {
    return foreground;
  }

  const shouldLighten = bgLuminance < 0.5;
  let adjustedRgb = { ...fgRgb };
  const step = shouldLighten ? 5 : -5;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    adjustedRgb = {
      r: Math.max(0, Math.min(255, adjustedRgb.r + step)),
      g: Math.max(0, Math.min(255, adjustedRgb.g + step)),
      b: Math.max(0, Math.min(255, adjustedRgb.b + step)),
    };

    const newHex = rgbToHex(adjustedRgb);
    currentRatio = getContrastRatio(newHex, background);

    if (currentRatio >= targetRatio) {
      return newHex;
    }

    if (
      shouldLighten &&
      adjustedRgb.r >= 255 &&
      adjustedRgb.g >= 255 &&
      adjustedRgb.b >= 255
    ) {
      return "#ffffff";
    }
    if (
      !shouldLighten &&
      adjustedRgb.r <= 0 &&
      adjustedRgb.g <= 0 &&
      adjustedRgb.b <= 0
    ) {
      return "#000000";
    }
  }

  return shouldLighten ? "#ffffff" : "#000000";
}

/**
 * Validate contrast for a ComponentToken's bg/text pair in a given color mode.
 * Returns null if the token has no text slot (i.e. text is "transparent").
 */
export function validateComponentTokenContrast(
  bgColor: string,
  textColor: string,
): ContrastPairResult | null {
  if (bgColor === "transparent" || textColor === "transparent") {
    return null;
  }

  const ratio = getContrastRatio(bgColor, textColor);
  return {
    bg: bgColor,
    text: textColor,
    ratio,
    wcagLevel: getWCAGLevel(ratio),
  };
}

/**
 * Format contrast ratio for display (e.g. "7.2:1").
 */
export function formatContrastRatio(ratio: number): string {
  return `${ratio.toFixed(1)}:1`;
}
