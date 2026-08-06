/** @jest-environment node */

import {
  buildDefaultTokenRecords,
  googleFontUrls,
  resolveFontsToCssVars,
  resolveTokensToCssVars,
} from "../resolver";
import {
  COMPONENT_TOKEN_GROUPS,
  FONT_ROLES,
  FONT_WEIGHT_STEPS,
  getCssVarName,
  getFontFamilyCssVarName,
  getFontWeightCssVarName,
} from "../token-registry";
import { JsonThemeError, parseJsonThemeFonts, validateJsonTheme } from "../json-theme";
import { setThemeLogger, type ThemeLogger } from "../logger";
import type { ThemeFont, ThemeFontSettings, TokenSlot } from "../types";

/**
 * Typeface resolution (NEH-277).
 *
 * Before this, fonts entered the package in two places and left through
 * neither: `ThemeConsumptionPayload.fonts` carried them *past* the resolver for
 * the host to apply by hand, and `extraction.ts` detected them as input to
 * authoring. A JSON theme could not express a typeface at all, and `fontWeight`
 * did not appear in the package in any form.
 *
 * The failure these tests guard is the one the whole package is shaped around:
 * a property nothing defines renders as nothing, and a property no one reads is
 * invisible in the other direction. So the names are pinned literally rather
 * than derived — a test that computes the expected name the same way the source
 * does would agree with any rename, including a breaking one.
 */

const INTER = {
  name: "Inter",
  fontFamily: '"Inter", sans-serif',
  googleFontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700",
} as const;

function captureLogger(): { logger: ThemeLogger; warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    logger: { info: () => {}, warn: (message) => warnings.push(message) },
  };
}

afterEach(() => setThemeLogger());

describe("the font property names", () => {
  // Public API from the moment they publish. Adding a role is
  // backwards-compatible; renaming one silently un-styles whatever read it,
  // with no build error anywhere — CSS has no import errors.
  it("spells out font-family and font-weight", () => {
    expect(getFontFamilyCssVarName("body")).toBe("--hopper-font-family-body");
    expect(getFontFamilyCssVarName("heading")).toBe("--hopper-font-family-heading");
    expect(getFontFamilyCssVarName("mono")).toBe("--hopper-font-family-mono");

    expect(getFontWeightCssVarName("normal")).toBe("--hopper-font-weight-normal");
    expect(getFontWeightCssVarName("medium")).toBe("--hopper-font-weight-medium");
    expect(getFontWeightCssVarName("semibold")).toBe("--hopper-font-weight-semibold");
    expect(getFontWeightCssVarName("bold")).toBe("--hopper-font-weight-bold");
  });

  it("keeps families and weights in namespaces that cannot collide", () => {
    // The reason `--hopper-font-family-body` rather than `--hopper-font-body`.
    // A role called `weight` would otherwise shadow the weight namespace, and
    // the collision would present as one theme value overwriting another.
    // Wrapped rather than passed point-free: these take an optional prefix
    // second (NEH-423) and `map` supplies the index there, so the bare form
    // asks for `--0-font-family-body`. The compiler rejects it — this shape is
    // what satisfies it, not a workaround for a false positive.
    const families = FONT_ROLES.map((role) => getFontFamilyCssVarName(role));
    const weights = FONT_WEIGHT_STEPS.map((step) => getFontWeightCssVarName(step));

    expect(new Set([...families, ...weights]).size).toBe(families.length + weights.length);
  });

  it("cannot collide with a colour token's property either", () => {
    // Both namespaces are `--hopper-*`, and the colour ones are generated from
    // token names that a future token could plausibly spell `font...`.
    const SLOTS: TokenSlot[] = ["bg", "text", "border"];
    const colours = new Set(
      COMPONENT_TOKEN_GROUPS.flatMap((group) => SLOTS.map((slot) => getCssVarName(group.key, slot))),
    );

    for (const property of [
      ...FONT_ROLES.map((role) => getFontFamilyCssVarName(role)),
      ...FONT_WEIGHT_STEPS.map((step) => getFontWeightCssVarName(step)),
    ]) {
      expect(colours.has(property)).toBe(false);
    }
  });
});

describe("resolveFontsToCssVars", () => {
  it("resolves a family and a weight into custom properties", () => {
    const vars = resolveFontsToCssVars({
      fonts: { body: INTER },
      weights: { bold: 700 },
    });

    expect(vars["--hopper-font-family-body"]).toBe('"Inter", sans-serif');
    expect(vars["--hopper-font-weight-bold"]).toBe("700");
  });

  it("emits nothing for a theme with no opinion about type", () => {
    // Every theme written before NEH-277 is this theme. Emitting a default here
    // would impose a typeface on hosts that never asked for one, and — worse —
    // do it silently.
    expect(resolveFontsToCssVars({})).toEqual({});
    expect(resolveFontsToCssVars({ fonts: {}, weights: {} })).toEqual({});
  });

  it("omits the roles and steps a theme leaves out", () => {
    const vars = resolveFontsToCssVars({
      fonts: { body: INTER },
      weights: { bold: 700 },
    });

    expect(Object.keys(vars)).toEqual(["--hopper-font-family-body", "--hopper-font-weight-bold"]);
  });

  it("resolves every role and every step when a theme sets them all", () => {
    const settings: ThemeFontSettings = {
      fonts: {
        body: INTER,
        heading: { name: "Fraunces", fontFamily: '"Fraunces", serif' },
        mono: { name: "JetBrains Mono", fontFamily: '"JetBrains Mono", monospace' },
      },
      weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
    };
    const vars = resolveFontsToCssVars(settings);

    for (const role of FONT_ROLES) {
      expect(vars[getFontFamilyCssVarName(role)]).toBeDefined();
    }
    for (const step of FONT_WEIGHT_STEPS) {
      expect(vars[getFontWeightCssVarName(step)]).toBeDefined();
    }
  });

  it("skips a font whose stack is blank, and says so", () => {
    const { logger, warnings } = captureLogger();
    setThemeLogger(logger);

    const vars = resolveFontsToCssVars({
      fonts: { body: { name: "Inter", fontFamily: "   " } },
    });

    // `font-family:   ` is an invalid declaration the browser discards, so the
    // property would exist and still do nothing.
    expect(vars).toEqual({});
    expect(warnings).toHaveLength(1);
  });

  it("trims the stack it does emit", () => {
    const vars = resolveFontsToCssVars({
      fonts: { body: { name: "Inter", fontFamily: '  "Inter", sans-serif  ' } },
    });

    expect(vars["--hopper-font-family-body"]).toBe('"Inter", sans-serif');
  });

  it.each([0, -400, 1001, 400.5, Number.NaN])(
    "skips the unusable weight %p, and says so",
    (weight) => {
      const { logger, warnings } = captureLogger();
      setThemeLogger(logger);

      // CSS Fonts 4 accepts 1–1000. Anything else is a declaration the browser
      // throws away, which is indistinguishable from the theme not setting it —
      // except that it looks set to whoever wrote the file.
      const vars = resolveFontsToCssVars({ weights: { bold: weight } });

      expect(vars).toEqual({});
      expect(warnings).toHaveLength(1);
    },
  );

  it.each([1, 400, 1000])("accepts the in-range weight %p", (weight) => {
    expect(resolveFontsToCssVars({ weights: { normal: weight } })).toEqual({
      "--hopper-font-weight-normal": String(weight),
    });
  });

  it("ignores a role the registry does not know", () => {
    // A database row can carry anything; the JSON loader rejects an unknown
    // role outright, but the resolver is source-agnostic and must not copy an
    // unrecognised key through into a variable nothing reads.
    const rogue: Record<string, ThemeFont> = { display: INTER };

    expect(resolveFontsToCssVars({ fonts: rogue })).toEqual({});
  });

  it("merges with the colour map without either overwriting the other", () => {
    // They are properties on the same element; the host writes one map.
    const colours = resolveTokensToCssVars(
      buildDefaultTokenRecords("t").map((r) => ({ ...r, bgLight: "#111111" })),
      "light",
    );
    const fonts = resolveFontsToCssVars({ fonts: { body: INTER }, weights: { bold: 700 } });
    const merged = { ...colours, ...fonts };

    expect(Object.keys(merged)).toHaveLength(
      Object.keys(colours).length + Object.keys(fonts).length,
    );
  });
});

describe("googleFontUrls", () => {
  it("returns the stylesheets a theme needs loaded, in role order", () => {
    const urls = googleFontUrls({
      fonts: {
        mono: { name: "JetBrains Mono", fontFamily: "monospace", googleFontUrl: "https://x/mono" },
        body: INTER,
      },
    });

    expect(urls).toEqual([INTER.googleFontUrl, "https://x/mono"]);
  });

  it("deduplicates one stylesheet serving several roles", () => {
    // The commonest real case: one Google Fonts URL requesting two families.
    const urls = googleFontUrls({
      fonts: {
        body: INTER,
        heading: { name: "Inter Tight", fontFamily: "sans-serif", googleFontUrl: INTER.googleFontUrl },
      },
    });

    expect(urls).toEqual([INTER.googleFontUrl]);
  });

  it("is empty for self-hosted or unset faces", () => {
    expect(googleFontUrls({})).toEqual([]);
    expect(
      googleFontUrls({ fonts: { body: { name: "Inter", fontFamily: "Inter", googleFontUrl: null } } }),
    ).toEqual([]);
    expect(googleFontUrls({ fonts: { body: { name: "Inter", fontFamily: "Inter" } } })).toEqual([]);
  });
});

describe("the JSON theme format", () => {
  const VALID = {
    name: "Supergirl",
    fonts: { body: INTER },
    fontWeights: { bold: 700 },
    tokens: {},
  };

  it("accepts a file with fonts and weights", () => {
    expect(validateJsonTheme(VALID)).toEqual([]);
  });

  it("accepts a file with neither, as every theme before NEH-277 was", () => {
    expect(validateJsonTheme({ name: "Plain", tokens: {} })).toEqual([]);
    expect(parseJsonThemeFonts({ name: "Plain", tokens: {} })).toEqual({ fonts: {}, weights: {} });
  });

  it("parses into exactly what the resolver takes", () => {
    const settings = parseJsonThemeFonts(VALID);

    expect(settings).toEqual({ fonts: { body: INTER }, weights: { bold: 700 } });
    expect(resolveFontsToCssVars(settings)).toEqual({
      "--hopper-font-family-body": '"Inter", sans-serif',
      "--hopper-font-weight-bold": "700",
    });
  });

  it("rejects an unknown role, rather than ignoring it", () => {
    // A typo here is invisible at runtime: the property never appears and the
    // page renders in the browser's default face with nothing to explain why.
    const problems = validateJsonTheme({ ...VALID, fonts: { ...VALID.fonts, dispaly: INTER } });

    expect(problems).toEqual(["unknown font role `dispaly` (expected body, heading, mono)"]);
  });

  it("rejects an unknown weight step", () => {
    const problems = validateJsonTheme({ ...VALID, fontWeights: { extrabold: 800 } });

    expect(problems).toEqual([
      "unknown font weight `extrabold` (expected normal, medium, semibold, bold)",
    ]);
  });

  it("rejects a keyword weight, which cannot work", () => {
    const problems = validateJsonTheme({ ...VALID, fontWeights: { bold: "bold" } });

    expect(problems).toEqual(["`fontWeights.bold` must be an integer 1–1000"]);
  });

  it.each([0, 1001, 700.5])("rejects the out-of-range weight %p", (weight) => {
    expect(validateJsonTheme({ ...VALID, fontWeights: { bold: weight } })).toHaveLength(1);
  });

  it("requires a name and a stack", () => {
    const problems = validateJsonTheme({ ...VALID, fonts: { body: { name: "", fontFamily: "  " } } });

    expect(problems).toEqual([
      "`fonts.body.name` must be a non-empty string",
      "`fonts.body.fontFamily` must be a non-empty string",
    ]);
  });

  it.each(["/fonts.css", "http://fonts.googleapis.com/css2", "javascript:alert(1)"])(
    "rejects the googleFontUrl %p",
    (googleFontUrl) => {
      // This ends up as the `href` of a <link> the host injects into its own
      // document — the one string in a theme file that reaches the DOM.
      const problems = validateJsonTheme({
        ...VALID,
        fonts: { body: { ...INTER, googleFontUrl } },
      });

      expect(problems).toEqual([
        "`fonts.body.googleFontUrl` must be an absolute https:// URL or null",
      ]);
    },
  );

  it("allows a self-hosted face to say so with null, or by omission", () => {
    expect(
      validateJsonTheme({ ...VALID, fonts: { body: { ...INTER, googleFontUrl: null } } }),
    ).toEqual([]);
    expect(
      validateJsonTheme({
        ...VALID,
        fonts: { body: { name: INTER.name, fontFamily: INTER.fontFamily } },
      }),
    ).toEqual([]);
  });

  it("does not carry an omitted googleFontUrl through as present-and-undefined", () => {
    const settings = parseJsonThemeFonts({
      ...VALID,
      fonts: { body: { name: INTER.name, fontFamily: INTER.fontFamily } },
    });

    expect(settings.fonts?.body).not.toHaveProperty("googleFontUrl");
  });

  it("reports font and token problems in the same pass", () => {
    // The file's whole premise: fixing eight typos one failed build at a time
    // is eight builds. A broken `tokens` block must not swallow the font ones.
    const problems = validateJsonTheme({
      name: "Broken",
      fonts: { dispaly: INTER },
      fontWeights: { bold: 0 },
      tokens: "nope",
    });

    expect(problems).toEqual([
      "unknown font role `dispaly` (expected body, heading, mono)",
      "`fontWeights.bold` must be an integer 1–1000",
      "`tokens` must be an object",
    ]);
  });

  it("rejects a fonts block that is not an object", () => {
    expect(validateJsonTheme({ ...VALID, fonts: "Inter" })).toEqual(["`fonts` must be an object"]);
    expect(validateJsonTheme({ ...VALID, fontWeights: 700 })).toEqual([
      "`fontWeights` must be an object",
    ]);
    // An array is `typeof "object"`, so it reaches the role check and is
    // rejected there — its indices are not roles. Rejected either way.
    expect(validateJsonTheme({ ...VALID, fonts: [INTER] })).toHaveLength(1);
  });

  it("throws every problem at once rather than the first", () => {
    expect(() => parseJsonThemeFonts({ ...VALID, fonts: { dispaly: INTER } })).toThrow(
      JsonThemeError,
    );
  });
});
