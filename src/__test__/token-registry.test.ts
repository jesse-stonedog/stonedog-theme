/** @jest-environment node */

import {
  toKebabCase,
  assertValidCssVarPrefix,
  getCssVarName,
  getFontFamilyCssVarName,
  getFontWeightCssVarName,
  COMPONENT_TOKEN_GROUPS,
  DEFAULT_CSS_VAR_PREFIX,
  LEGACY_TO_TOKEN_MAP,
  getTokenGroup,
  getTokenGroupsByCategory,
} from "../token-registry";
import type { TokenSlot } from "../types";

describe("token-registry", () => {
  describe("toKebabCase", () => {
    it("converts camelCase to kebab-case", () => {
      expect(toKebabCase("boxPrimary")).toBe("box-primary");
      expect(toKebabCase("buttonSecondaryHover")).toBe("button-secondary-hover");
      expect(toKebabCase("textPop")).toBe("text-pop");
    });

    it("handles single-word strings", () => {
      expect(toKebabCase("box")).toBe("box");
    });

    it("handles strings with consecutive capitals", () => {
      expect(toKebabCase("boxAIProviders")).toBe("box-aiproviders");
    });

    it("handles already kebab-case strings", () => {
      expect(toKebabCase("already-kebab")).toBe("already-kebab");
    });
  });

  describe("getCssVarName", () => {
    it("produces correct CSS variable name for bg slot", () => {
      expect(getCssVarName("boxPrimary", "bg")).toBe("--hopper-box-primary-bg");
    });

    it("produces correct CSS variable name for text slot", () => {
      expect(getCssVarName("boxPrimary", "text")).toBe("--hopper-box-primary-text");
    });

    it("produces correct CSS variable name for border slot", () => {
      expect(getCssVarName("boxSecondary", "border")).toBe("--hopper-box-secondary-border");
    });

    it("handles multi-segment token names", () => {
      expect(getCssVarName("buttonPrimaryHover", "bg")).toBe("--hopper-button-primary-hover-bg");
    });

    it("defaults to the hopper namespace", () => {
      // Pinned rather than assumed. The default is what every existing host
      // gets for saying nothing, and HopperGuard's stored theme data is keyed
      // on it — moving it is a data migration (NEH-256), not a rename, so a
      // change here must be deliberate enough to edit this line.
      expect(DEFAULT_CSS_VAR_PREFIX).toBe("hopper");
      expect(getCssVarName("boxPrimary", "bg")).toBe(
        getCssVarName("boxPrimary", "bg", DEFAULT_CSS_VAR_PREFIX),
      );
    });

    it("re-points every slot under a custom prefix", () => {
      expect(getCssVarName("boxPrimary", "bg", "optima")).toBe("--optima-box-primary-bg");
      expect(getCssVarName("boxPrimary", "text", "optima")).toBe("--optima-box-primary-text");
      expect(getCssVarName("boxSecondary", "border", "optima")).toBe(
        "--optima-box-secondary-border",
      );
    });
  });

  describe("assertValidCssVarPrefix", () => {
    // A malformed prefix is the one input that fails ENTIRELY silently: the
    // properties are written, no browser parses them, every component renders
    // with no colour, and nothing anywhere reports a problem. So this throws,
    // and these cases are the ones a host realistically gets wrong.
    it.each(["hopper", "optima", "acme", "_private", "brand-two", "a1"])(
      "accepts %s",
      (prefix) => {
        expect(() => assertValidCssVarPrefix(prefix)).not.toThrow();
      },
    );

    it.each([
      ["", "an empty string, e.g. an unset env var"],
      ["--hopper", "the leading dashes already included"],
      ["my theme", "a space"],
      ["1brand", "a leading digit — not a valid CSS ident"],
      ["brand.two", "a dot"],
      ["brand:two", "a colon"],
    ])("rejects %j (%s)", (prefix) => {
      expect(() => assertValidCssVarPrefix(prefix)).toThrow(/invalid cssVarPrefix/);
    });

    it("rejects through the name builders too, not only when called directly", () => {
      // The assertion lives inside the builders so every caller inherits it —
      // including `semanticTokenToCssVar` and both resolvers, which is what
      // makes one guard cover the whole surface.
      expect(() => getCssVarName("boxPrimary", "bg", "--optima")).toThrow(
        /invalid cssVarPrefix/,
      );
      expect(() => getFontFamilyCssVarName("body", "my theme")).toThrow(
        /invalid cssVarPrefix/,
      );
      expect(() => getFontWeightCssVarName("bold", "")).toThrow(/invalid cssVarPrefix/);
    });
  });

  describe("COMPONENT_TOKEN_GROUPS", () => {
    it("contains 32 token groups", () => {
      expect(COMPONENT_TOKEN_GROUPS.length).toBe(32);
    });

    it("all groups have required fields", () => {
      for (const group of COMPONENT_TOKEN_GROUPS) {
        expect(group.key).toBeTruthy();
        expect(group.displayName).toBeTruthy();
        expect(group.category).toBeTruthy();
        expect(Array.isArray(group.activeSlots)).toBe(true);
        expect(group.activeSlots.length).toBeGreaterThan(0);
        expect(typeof group.sortOrder).toBe("number");
        expect(group.legacyVariables).toBeDefined();
      }
    });

    it("has unique keys", () => {
      const keys = COMPONENT_TOKEN_GROUPS.map((g) => g.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("has unique sort orders", () => {
      const orders = COMPONENT_TOKEN_GROUPS.map((g) => g.sortOrder);
      expect(new Set(orders).size).toBe(orders.length);
    });

    it("covers all expected categories", () => {
      const categories = new Set(COMPONENT_TOKEN_GROUPS.map((g) => g.category));
      expect(categories).toEqual(new Set(["box", "button", "arrow", "icon", "shadow", "text", "title", "special"]));
    });

    it("every active slot has a legacy variable mapping", () => {
      for (const group of COMPONENT_TOKEN_GROUPS) {
        for (const slot of group.activeSlots) {
          expect(group.legacyVariables[slot]).toBeTruthy();
        }
      }
    });
  });

  describe("LEGACY_TO_TOKEN_MAP", () => {
    it("maps boxBgPrimary to boxPrimary bg slot", () => {
      expect(LEGACY_TO_TOKEN_MAP["boxBgPrimary"]).toEqual({
        tokenName: "boxPrimary",
        slot: "bg",
      });
    });

    it("maps textPrimary to boxPrimary text slot", () => {
      expect(LEGACY_TO_TOKEN_MAP["textPrimary"]).toEqual({
        tokenName: "boxPrimary",
        slot: "text",
      });
    });

    it("maps buttonTextAccent to buttonAccent text slot", () => {
      expect(LEGACY_TO_TOKEN_MAP["buttonTextAccent"]).toEqual({
        tokenName: "buttonAccent",
        slot: "text",
      });
    });

    it("has entries for all unique legacy variable names", () => {
      // Some groups share the same legacy border name (e.g. boxPrimary and
      // buttonPrimary both map border -> "borderBgPrimary"), so the map
      // deduplicates to 44 unique entries instead of the raw 47 total.
      const uniqueNames = new Set<string>();
      for (const group of COMPONENT_TOKEN_GROUPS) {
        for (const legacyName of Object.values(group.legacyVariables)) {
          if (legacyName) uniqueNames.add(legacyName);
        }
      }
      expect(Object.keys(LEGACY_TO_TOKEN_MAP).length).toBe(uniqueNames.size);
    });

    it("all entries point to valid token names", () => {
      const validKeys = new Set(COMPONENT_TOKEN_GROUPS.map((g) => g.key));
      for (const entry of Object.values(LEGACY_TO_TOKEN_MAP)) {
        expect(validKeys.has(entry.tokenName)).toBe(true);
      }
    });

    it("all entries have valid slot types", () => {
      const validSlots: TokenSlot[] = ["bg", "text", "border"];
      for (const entry of Object.values(LEGACY_TO_TOKEN_MAP)) {
        expect(validSlots).toContain(entry.slot);
      }
    });
  });

  describe("getTokenGroup", () => {
    it("returns the correct group for a valid key", () => {
      const group = getTokenGroup("boxPrimary");
      expect(group).toBeDefined();
      expect(group!.key).toBe("boxPrimary");
      expect(group!.displayName).toBe("Box Primary");
      expect(group!.category).toBe("box");
    });

    it("returns undefined for an invalid key", () => {
      expect(getTokenGroup("nonExistent")).toBeUndefined();
    });
  });

  describe("getTokenGroupsByCategory", () => {
    it("returns box groups", () => {
      const groups = getTokenGroupsByCategory("box");
      expect(groups.length).toBe(4);
      for (const g of groups) {
        expect(g.category).toBe("box");
      }
    });

    it("returns button groups", () => {
      const groups = getTokenGroupsByCategory("button");
      expect(groups.length).toBe(7);
      for (const g of groups) {
        expect(g.category).toBe("button");
      }
    });

    it("returns icon groups", () => {
      const groups = getTokenGroupsByCategory("icon");
      expect(groups.length).toBe(6);
    });

    it("returns empty array for unknown category", () => {
      expect(getTokenGroupsByCategory("unknown")).toEqual([]);
    });
  });
});
