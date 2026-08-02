/** @jest-environment node */

import {
  resolveCssVarToHex,
  mapLegacyToComponentTokens,
} from "../migrator";
import type { LegacyOverride, LegacySemanticTokenValue, PaletteData } from "../migrator";
import { COMPONENT_TOKEN_GROUPS } from "../token-registry";

const mockPalettes: PaletteData[] = [
  {
    key: "primary",
    shades: [
      { shade: "50", hexValue: "#e3f2fd" },
      { shade: "100", hexValue: "#bbdefb" },
      { shade: "500", hexValue: "#2196f3" },
      { shade: "700", hexValue: "#1976d2" },
      { shade: "900", hexValue: "#0d47a1" },
      { shade: "solid", hexValue: "#1565c0" },
      { shade: "contrast", hexValue: "#ffffff" },
      { shade: "border", hexValue: "#0d47a1" },
    ],
  },
  {
    key: "secondary",
    shades: [
      { shade: "50", hexValue: "#fce4ec" },
      { shade: "500", hexValue: "#e91e63" },
      { shade: "900", hexValue: "#880e4f" },
      { shade: "solid", hexValue: "#c2185b" },
      { shade: "contrast", hexValue: "#ffffff" },
      { shade: "border", hexValue: "#880e4f" },
    ],
  },
  {
    key: "accent",
    shades: [
      { shade: "50", hexValue: "#e8f5e9" },
      { shade: "500", hexValue: "#4caf50" },
      { shade: "600", hexValue: "#43a047" },
      { shade: "900", hexValue: "#1b5e20" },
      { shade: "solid", hexValue: "#388e3c" },
      { shade: "contrast", hexValue: "#ffffff" },
      { shade: "border", hexValue: "#1b5e20" },
      { shade: "subtle", hexValue: "#a5d6a7" },
      { shade: "focusRing", hexValue: "#66bb6a" },
    ],
  },
];

describe("migrator", () => {
  describe("resolveCssVarToHex", () => {
    it("resolves var(--colors-primary-solid) to hex", () => {
      expect(resolveCssVarToHex("var(--colors-primary-solid)", mockPalettes)).toBe("#1565c0");
    });

    it("resolves var(--colors-accent-500) to hex", () => {
      expect(resolveCssVarToHex("var(--colors-accent-500)", mockPalettes)).toBe("#4caf50");
    });

    it("resolves dotted notation colors.primary.900", () => {
      expect(resolveCssVarToHex("colors.primary.900", mockPalettes)).toBe("#0d47a1");
    });

    it("returns bare hex values as-is", () => {
      expect(resolveCssVarToHex("#ff0000", mockPalettes)).toBe("#ff0000");
      expect(resolveCssVarToHex("#abc", mockPalettes)).toBe("#abc");
    });

    it("returns null for unknown palette", () => {
      expect(resolveCssVarToHex("var(--colors-unknown-500)", mockPalettes)).toBeNull();
    });

    it("returns null for unknown shade", () => {
      expect(resolveCssVarToHex("var(--colors-primary-9999)", mockPalettes)).toBeNull();
    });

    it("returns null for unrecognized format", () => {
      expect(resolveCssVarToHex("something-random", mockPalettes)).toBeNull();
    });
  });

  describe("mapLegacyToComponentTokens", () => {
    const themeId = "test-theme-uuid";

    const defaultValues: Record<string, string> = {
      boxBgPrimary: "var(--colors-primary-solid)",
      textPrimary: "var(--colors-primary-contrast)",
      borderBgPrimary: "var(--colors-primary-border)",
      boxBgSecondary: "var(--colors-secondary-solid)",
      textSecondary: "var(--colors-secondary-contrast)",
      borderBgSecondary: "var(--colors-secondary-border)",
      boxBgAccent: "var(--colors-accent-solid)",
      textAccent: "var(--colors-accent-contrast)",
      borderBgAccent: "var(--colors-accent-border)",
      buttonBgPrimary: "var(--colors-primary-900)",
      buttonTextPrimary: "var(--colors-primary-contrast)",
    };

    it("creates records for all 28 token groups", () => {
      const records = mapLegacyToComponentTokens(
        themeId, [], [], mockPalettes, defaultValues,
      );
      expect(records.length).toBe(COMPONENT_TOKEN_GROUPS.length);
    });

    it("applies default values correctly", () => {
      const records = mapLegacyToComponentTokens(
        themeId, [], [], mockPalettes, defaultValues,
      );

      const boxPrimary = records.find((r) => r.name === "boxPrimary");
      expect(boxPrimary).toBeDefined();
      expect(boxPrimary!.bgLight).toBe("#1565c0"); // primary-solid
      expect(boxPrimary!.textLight).toBe("#ffffff"); // primary-contrast
      // Note: borderBgPrimary maps to buttonPrimary (not boxPrimary) in the
      // LEGACY_TO_TOKEN_MAP because both box and button share the same legacy
      // border name, and button is defined later so it wins.
      const buttonPrimary = records.find((r) => r.name === "buttonPrimary");
      expect(buttonPrimary).toBeDefined();
      expect(buttonPrimary!.borderLight).toBe("#0d47a1"); // primary-border
    });

    it("applies defaults to both light and dark when no dark override", () => {
      const records = mapLegacyToComponentTokens(
        themeId, [], [], mockPalettes, defaultValues,
      );
      const boxPrimary = records.find((r) => r.name === "boxPrimary");
      expect(boxPrimary!.bgLight).toBe(boxPrimary!.bgDark);
    });

    it("applies ColorPaletteShadeOverride for light mode", () => {
      const overrides: LegacyOverride[] = [
        { semanticVariable: "boxBgPrimary", overrideValue: "#ff0000", isDark: false },
      ];

      const records = mapLegacyToComponentTokens(
        themeId, overrides, [], mockPalettes, defaultValues,
      );

      const boxPrimary = records.find((r) => r.name === "boxPrimary");
      expect(boxPrimary!.bgLight).toBe("#ff0000");
      // Dark should still have the default
      expect(boxPrimary!.bgDark).toBe("#1565c0");
    });

    it("applies ColorPaletteShadeOverride for dark mode", () => {
      const overrides: LegacyOverride[] = [
        { semanticVariable: "boxBgPrimary", overrideValue: "#00ff00", isDark: true },
      ];

      const records = mapLegacyToComponentTokens(
        themeId, overrides, [], mockPalettes, defaultValues,
      );

      const boxPrimary = records.find((r) => r.name === "boxPrimary");
      expect(boxPrimary!.bgLight).toBe("#1565c0"); // default
      expect(boxPrimary!.bgDark).toBe("#00ff00"); // overridden
    });

    it("applies SemanticTokenColorValue for default mode (light)", () => {
      const semanticTokenValues: LegacySemanticTokenValue[] = [
        {
          colorMode: "default",
          cssValue: "primary.50",
          semanticTokenDefinition: { name: "boxBgPrimary" },
        },
      ];

      const records = mapLegacyToComponentTokens(
        themeId, [], semanticTokenValues, mockPalettes, defaultValues,
      );

      const boxPrimary = records.find((r) => r.name === "boxPrimary");
      expect(boxPrimary!.bgLight).toBe("#e3f2fd"); // primary-50
    });

    it("applies SemanticTokenColorValue for _dark mode", () => {
      const semanticTokenValues: LegacySemanticTokenValue[] = [
        {
          colorMode: "_dark",
          cssValue: "primary.900",
          semanticTokenDefinition: { name: "boxBgPrimary" },
        },
      ];

      const records = mapLegacyToComponentTokens(
        themeId, [], semanticTokenValues, mockPalettes, defaultValues,
      );

      const boxPrimary = records.find((r) => r.name === "boxPrimary");
      expect(boxPrimary!.bgDark).toBe("#0d47a1"); // primary-900
    });

    it("applies SemanticTokenColorValue for system/value mode to both", () => {
      const semanticTokenValues: LegacySemanticTokenValue[] = [
        {
          colorMode: "system",
          cssValue: "accent.500",
          semanticTokenDefinition: { name: "boxBgAccent" },
        },
      ];

      const records = mapLegacyToComponentTokens(
        themeId, [], semanticTokenValues, mockPalettes, defaultValues,
      );

      const boxAccent = records.find((r) => r.name === "boxAccent");
      expect(boxAccent!.bgLight).toBe("#4caf50");
      expect(boxAccent!.bgDark).toBe("#4caf50");
    });

    it("overrides take precedence over semantic token values", () => {
      const semanticTokenValues: LegacySemanticTokenValue[] = [
        {
          colorMode: "default",
          cssValue: "primary.500",
          semanticTokenDefinition: { name: "boxBgPrimary" },
        },
      ];
      const overrides: LegacyOverride[] = [
        { semanticVariable: "boxBgPrimary", overrideValue: "#abcdef", isDark: false },
      ];

      const records = mapLegacyToComponentTokens(
        themeId, overrides, semanticTokenValues, mockPalettes, defaultValues,
      );

      const boxPrimary = records.find((r) => r.name === "boxPrimary");
      // Override is applied after semantic token values, so it wins
      expect(boxPrimary!.bgLight).toBe("#abcdef");
    });

    it("ignores unknown legacy variable names", () => {
      const overrides: LegacyOverride[] = [
        { semanticVariable: "unknownVariable", overrideValue: "#ff0000", isDark: false },
      ];

      const records = mapLegacyToComponentTokens(
        themeId, overrides, [], mockPalettes, defaultValues,
      );

      // Should still produce 28 records, no errors
      expect(records.length).toBe(COMPONENT_TOKEN_GROUPS.length);
    });

    it("resolves CSS var references in overrides", () => {
      const overrides: LegacyOverride[] = [
        {
          semanticVariable: "boxBgPrimary",
          overrideValue: "var(--colors-accent-500)",
          isDark: false,
        },
      ];

      const records = mapLegacyToComponentTokens(
        themeId, overrides, [], mockPalettes, defaultValues,
      );

      const boxPrimary = records.find((r) => r.name === "boxPrimary");
      expect(boxPrimary!.bgLight).toBe("#4caf50"); // accent-500
    });

    it("sets themeId on all output records", () => {
      const records = mapLegacyToComponentTokens(
        themeId, [], [], mockPalettes, {},
      );
      for (const record of records) {
        expect(record.themeId).toBe(themeId);
      }
    });

    it("groups without defaults or overrides remain transparent", () => {
      const records = mapLegacyToComponentTokens(
        themeId, [], [], mockPalettes, {},
      );

      // Every slot should be transparent when no defaults given
      for (const record of records) {
        expect(record.bgLight).toBe("transparent");
        expect(record.bgDark).toBe("transparent");
        expect(record.textLight).toBe("transparent");
        expect(record.textDark).toBe("transparent");
        expect(record.borderLight).toBe("transparent");
        expect(record.borderDark).toBe("transparent");
      }
    });
  });
});
