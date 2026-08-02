/** @jest-environment node */

import {
  hexToRgb,
  rgbToHex,
  getLuminance,
  getContrastRatio,
  getWCAGLevel,
  analyzeContrast,
  findAAACompliantShade,
  suggestContrastFix,
  adjustForContrast,
  validateComponentTokenContrast,
  formatContrastRatio,
} from "../contrast";

describe("contrast", () => {
  describe("hexToRgb", () => {
    it("converts 6-digit hex with #", () => {
      expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
    });

    it("converts 6-digit hex without #", () => {
      expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("000000")).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("converts 3-digit hex", () => {
      expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    });

    it("returns null for invalid hex", () => {
      expect(hexToRgb("invalid")).toBeNull();
      expect(hexToRgb("#gg0000")).toBeNull();
      expect(hexToRgb("#12345")).toBeNull();
    });
  });

  describe("rgbToHex", () => {
    it("converts RGB to hex", () => {
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
      expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe("#00ff00");
      expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe("#0000ff");
    });

    it("pads single-digit hex values", () => {
      expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
      expect(rgbToHex({ r: 15, g: 15, b: 15 })).toBe("#0f0f0f");
    });

    it("clamps values to 0-255", () => {
      expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe("#ff0080");
    });
  });

  describe("getLuminance", () => {
    it("returns 1 for white", () => {
      expect(getLuminance("#ffffff")).toBeCloseTo(1.0, 2);
    });

    it("returns 0 for black", () => {
      expect(getLuminance("#000000")).toBeCloseTo(0.0, 2);
    });

    it("returns intermediate luminance for gray", () => {
      const lum = getLuminance("#808080");
      expect(lum).toBeGreaterThan(0.1);
      expect(lum).toBeLessThan(0.5);
    });

    it("returns 0 for invalid hex", () => {
      expect(getLuminance("invalid")).toBe(0);
    });
  });

  describe("getContrastRatio", () => {
    it("returns 21:1 for black on white", () => {
      expect(getContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    });

    it("returns 1:1 for same colors", () => {
      expect(getContrastRatio("#ff0000", "#ff0000")).toBeCloseTo(1, 0);
    });

    it("is symmetric (order does not matter)", () => {
      const r1 = getContrastRatio("#333333", "#cccccc");
      const r2 = getContrastRatio("#cccccc", "#333333");
      expect(r1).toBeCloseTo(r2, 5);
    });

    it("returns a value between 1 and 21", () => {
      const ratio = getContrastRatio("#3a5ba0", "#f0f0f0");
      expect(ratio).toBeGreaterThanOrEqual(1);
      expect(ratio).toBeLessThanOrEqual(21);
    });
  });

  describe("getWCAGLevel", () => {
    it("returns AAA for ratio >= 7 (normal text)", () => {
      expect(getWCAGLevel(7)).toBe("AAA");
      expect(getWCAGLevel(10)).toBe("AAA");
      expect(getWCAGLevel(21)).toBe("AAA");
    });

    it("returns AA for ratio >= 4.5 but < 7 (normal text)", () => {
      expect(getWCAGLevel(4.5)).toBe("AA");
      expect(getWCAGLevel(6.9)).toBe("AA");
    });

    it("returns Fail for ratio < 4.5 (normal text)", () => {
      expect(getWCAGLevel(4.4)).toBe("Fail");
      expect(getWCAGLevel(1)).toBe("Fail");
    });

    it("uses lower thresholds for large text", () => {
      expect(getWCAGLevel(4.5, true)).toBe("AAA"); // AAA threshold for large = 4.5
      expect(getWCAGLevel(3, true)).toBe("AA"); // AA threshold for large = 3
      expect(getWCAGLevel(2.9, true)).toBe("Fail");
    });
  });

  describe("analyzeContrast", () => {
    it("returns full analysis for black on white", () => {
      const result = analyzeContrast("#000000", "#ffffff");
      expect(result.ratio).toBeCloseTo(21, 0);
      expect(result.level).toBe("AAA");
      expect(result.largeTextLevel).toBe("AAA");
      expect(result.passes.aaaNormalText).toBe(true);
      expect(result.passes.aaaLargeText).toBe(true);
      expect(result.passes.aaNormalText).toBe(true);
      expect(result.passes.aaLargeText).toBe(true);
    });

    it("returns Fail for low contrast pair", () => {
      const result = analyzeContrast("#cccccc", "#dddddd");
      expect(result.level).toBe("Fail");
      expect(result.passes.aaNormalText).toBe(false);
    });

    it("correctly identifies AA-only level", () => {
      // Find a pair that gives ratio ~5 (AA but not AAA for normal text)
      const result = analyzeContrast("#767676", "#ffffff");
      expect(result.ratio).toBeGreaterThanOrEqual(4.5);
      expect(result.ratio).toBeLessThan(7);
      expect(result.level).toBe("AA");
      expect(result.passes.aaNormalText).toBe(true);
      expect(result.passes.aaaNormalText).toBe(false);
    });
  });

  describe("validateComponentTokenContrast", () => {
    it("returns contrast result for valid hex pair", () => {
      const result = validateComponentTokenContrast("#000000", "#ffffff");
      expect(result).not.toBeNull();
      expect(result!.bg).toBe("#000000");
      expect(result!.text).toBe("#ffffff");
      expect(result!.ratio).toBeCloseTo(21, 0);
      expect(result!.wcagLevel).toBe("AAA");
    });

    it("returns null when bg is transparent", () => {
      expect(validateComponentTokenContrast("transparent", "#ffffff")).toBeNull();
    });

    it("returns null when text is transparent", () => {
      expect(validateComponentTokenContrast("#000000", "transparent")).toBeNull();
    });

    it("returns Fail for low contrast pair", () => {
      const result = validateComponentTokenContrast("#cccccc", "#dddddd");
      expect(result).not.toBeNull();
      expect(result!.wcagLevel).toBe("Fail");
    });
  });

  describe("formatContrastRatio", () => {
    it("formats ratio with one decimal place", () => {
      expect(formatContrastRatio(7)).toBe("7.0:1");
      expect(formatContrastRatio(4.56)).toBe("4.6:1");
      expect(formatContrastRatio(21)).toBe("21.0:1");
    });
  });

  describe("findAAACompliantShade", () => {
    const palette = [
      { shade: "50", hexValue: "#f5f5f5" },
      { shade: "100", hexValue: "#e0e0e0" },
      { shade: "300", hexValue: "#999999" },
      { shade: "500", hexValue: "#666666" },
      { shade: "700", hexValue: "#333333" },
      { shade: "900", hexValue: "#111111" },
    ];

    it("finds AAA-compliant shade against white background", () => {
      const result = findAAACompliantShade("#ffffff", palette);
      expect(result).not.toBeNull();
      // Should pick the shade with ratio >= 7 closest to threshold
      const ratio = getContrastRatio("#ffffff", result!.hexValue);
      expect(ratio).toBeGreaterThanOrEqual(7);
    });

    it("finds AAA-compliant shade against dark background", () => {
      const result = findAAACompliantShade("#000000", palette);
      expect(result).not.toBeNull();
      const ratio = getContrastRatio("#000000", result!.hexValue);
      expect(ratio).toBeGreaterThanOrEqual(7);
    });

    it("returns null when no shade meets AAA threshold", () => {
      const lowContrastPalette = [
        { shade: "100", hexValue: "#f0f0f0" },
        { shade: "200", hexValue: "#e0e0e0" },
      ];
      // Against a very similar background, none should pass
      const result = findAAACompliantShade("#f5f5f5", lowContrastPalette);
      expect(result).toBeNull();
    });

    it("uses lower threshold for large text", () => {
      const result = findAAACompliantShade("#ffffff", palette, true);
      expect(result).not.toBeNull();
      const ratio = getContrastRatio("#ffffff", result!.hexValue);
      expect(ratio).toBeGreaterThanOrEqual(4.5); // AAA for large text
    });
  });

  describe("suggestContrastFix", () => {
    const palette = [
      { shade: "50", hexValue: "#f5f5f5" },
      { shade: "500", hexValue: "#666666" },
      { shade: "900", hexValue: "#111111" },
    ];

    it("suggests a compliant shade with direction", () => {
      const result = suggestContrastFix("#cccccc", "#ffffff", palette);
      expect(result).not.toBeNull();
      expect(result!.shade).toBeDefined();
      expect(["lighter", "darker"]).toContain(result!.direction);
    });

    it("returns null when no shade meets AAA", () => {
      const badPalette = [
        { shade: "100", hexValue: "#f0f0f0" },
      ];
      const result = suggestContrastFix("#e0e0e0", "#f0f0f0", badPalette);
      expect(result).toBeNull();
    });
  });

  describe("adjustForContrast", () => {
    it("returns foreground unchanged if already meets target", () => {
      const result = adjustForContrast("#000000", "#ffffff", 7);
      expect(result).toBe("#000000");
    });

    it("adjusts low contrast foreground to meet target", () => {
      const adjusted = adjustForContrast("#cccccc", "#ffffff", 7);
      const ratio = getContrastRatio(adjusted, "#ffffff");
      expect(ratio).toBeGreaterThanOrEqual(7);
    });

    it("lightens foreground on dark background", () => {
      const adjusted = adjustForContrast("#333333", "#000000", 7);
      const ratio = getContrastRatio(adjusted, "#000000");
      expect(ratio).toBeGreaterThanOrEqual(7);
    });

    it("returns original for invalid hex", () => {
      expect(adjustForContrast("invalid", "#ffffff")).toBe("invalid");
    });

    it("returns black or white when max adjustment is not enough", () => {
      // Very low contrast pair where adjustment hits the limit
      const result = adjustForContrast("#fefefe", "#ffffff", 21);
      expect(["#000000", "#ffffff"]).toContain(result);
    });
  });
});
