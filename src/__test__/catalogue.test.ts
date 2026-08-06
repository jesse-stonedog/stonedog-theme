/** @jest-environment node */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertValidThemeSlug,
  catalogueThemePath,
  catalogueThemeSlugs,
  readCatalogueTheme,
  readCatalogueThemeRecords,
  slugifyThemeName,
  toJsonTheme,
  writeCatalogueTheme,
} from "../catalogue";
import { JsonThemeError } from "../json-theme";
import { diffResolvedThemes, themesResolveIdentically } from "../theme-diff";
import { populatedTheme } from "../../test/fixtures/populated-theme";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "stonedog-catalogue-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("theme slugs", () => {
  it.each(["ocean-breeze", "zen", "midnight", "brand-two", "a1"])("accepts %s", (slug) => {
    expect(() => assertValidThemeSlug(slug)).not.toThrow();
  });

  it.each([
    ["", "empty"],
    ["Ocean-Breeze", "uppercase — round-trips on Linux, collides on macOS"],
    ["ocean breeze", "a space"],
    ["ocean--breeze", "a doubled hyphen"],
    ["-ocean", "a leading hyphen"],
    ["ocean-", "a trailing hyphen"],
    ["../escape", "a traversal — this becomes a path"],
    ["nested/theme", "a separator — this becomes a path"],
  ])("rejects %j (%s)", (slug) => {
    expect(() => assertValidThemeSlug(slug)).toThrow(/invalid theme slug/);
  });

  it("refuses to build a path from an unsafe slug", () => {
    // The guard has to be on the path builder, not only on the caller. This is
    // what stops a push writing outside the catalogue directory.
    expect(() => catalogueThemePath(dir, "../../etc/passwd")).toThrow(/invalid theme slug/);
  });

  it("slugifies a human name, losslessly enough to read", () => {
    expect(slugifyThemeName("Ocean Breeze")).toBe("ocean-breeze");
    expect(slugifyThemeName("Supergirl — Woman of Tomorrow")).toBe(
      "supergirl-woman-of-tomorrow",
    );
    // Combining marks are stripped rather than dropping the word entirely.
    expect(slugifyThemeName("Café Noir")).toBe("cafe-noir");
  });

  it("throws rather than returning an empty slug", () => {
    // "!!!" slugifies to "" — returning that would write a file called
    // ".theme.json", which `catalogueThemeSlugs` would then read back as a
    // theme with no name.
    expect(() => slugifyThemeName("!!!")).toThrow(/invalid theme slug/);
  });
});

describe("listing a catalogue", () => {
  it("returns slugs sorted, ignoring non-theme files", () => {
    writeCatalogueTheme(dir, "zen", toJsonTheme(populatedTheme(), "Zen"));
    writeCatalogueTheme(dir, "midnight", toJsonTheme(populatedTheme(), "Midnight"));
    // The README the catalogue directory carries must not read as a theme.
    writeFileSync(join(dir, "README.md"), "# not a theme\n");

    expect(catalogueThemeSlugs(dir)).toEqual(["midnight", "zen"]);
  });

  it("fails on a theme file whose name is not a valid slug", () => {
    // Skipping it silently would leave a theme in the directory that no `pull`
    // can ever name, looking for all the world like it had been published.
    writeFileSync(join(dir, "Not A Slug.theme.json"), "{}");

    expect(() => catalogueThemeSlugs(dir)).toThrow(/invalid theme slug/);
  });
});

describe("reading a catalogue theme", () => {
  it("round-trips a populated theme through the file", () => {
    writeCatalogueTheme(dir, "zen", toJsonTheme(populatedTheme(), "Zen"));

    expect(readCatalogueTheme(dir, "zen").name).toBe("Zen");
    expect(readCatalogueThemeRecords(dir, "zen").length).toBeGreaterThan(0);
  });

  it("validates on read, not merely parses", () => {
    // A catalogue is written by one repo and read by another, so an invalid
    // file otherwise arrives as an unstyled page rather than an error.
    writeFileSync(
      join(dir, "broken.theme.json"),
      JSON.stringify({ name: "Broken", tokens: { boxMain: { bg: { light: "not-a-colour", dark: "#000000" } } } }),
    );

    expect(() => readCatalogueTheme(dir, "broken")).toThrow(JsonThemeError);
  });

  it("names the file when it cannot be read", () => {
    expect(() => readCatalogueTheme(dir, "absent")).toThrow(/absent\.theme\.json/);
  });
});

describe("writing a catalogue theme", () => {
  it("reports no change on a second identical write", () => {
    // This is what makes a push idempotent in the way that matters: re-running
    // it produces no commit, so "is this product in sync?" is answerable by
    // looking at git rather than by reasoning about it.
    const theme = toJsonTheme(populatedTheme(), "Zen");

    expect(writeCatalogueTheme(dir, "zen", theme).changed).toBe(true);
    expect(writeCatalogueTheme(dir, "zen", theme).changed).toBe(false);
  });

  it("reports a change when a colour actually moves", () => {
    const tokens = populatedTheme();
    writeCatalogueTheme(dir, "zen", toJsonTheme(tokens, "Zen"));

    const moved = tokens.map((t) =>
      t.name === "boxMain" ? { ...t, bgLight: "#123456" } : t,
    );

    expect(writeCatalogueTheme(dir, "zen", toJsonTheme(moved, "Zen")).changed).toBe(true);
  });

  it("emits tokens in registry order, not arrival order", () => {
    // A push that reordered keys would produce a diff on every run, which makes
    // "did anything change?" unanswerable from the file.
    const forward = toJsonTheme(populatedTheme(), "Zen");
    const reversed = toJsonTheme([...populatedTheme()].reverse(), "Zen");

    expect(Object.keys(reversed.tokens)).toEqual(Object.keys(forward.tokens));
  });

  it("writes stable, reviewable formatting", () => {
    writeCatalogueTheme(dir, "zen", toJsonTheme(populatedTheme(), "Zen"));
    const raw = readFileSync(join(dir, "zen.theme.json"), "utf8");

    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain('\n  "name"');
  });

  it("refuses to write an invalid theme", () => {
    // Validated before writing. A catalogue that has already been corrupted is
    // somebody else's problem to notice; refusing is the only cheap moment.
    expect(() =>
      writeCatalogueTheme(dir, "zen", {
        name: "Bad",
        tokens: { boxMain: { bg: { light: "nope", dark: "#000000" } } },
      }),
    ).toThrow(JsonThemeError);

    expect(catalogueThemeSlugs(dir)).toEqual([]);
  });

  it("omits slots that are transparent on both sides, and keeps asymmetric ones", () => {
    const [first, ...rest] = populatedTheme();
    const asymmetric = {
      ...first!,
      borderLight: "transparent",
      borderDark: "transparent",
      textLight: "transparent",
      textDark: "#ffffff",
    };

    const json = toJsonTheme([asymmetric, ...rest], "Zen");

    expect(json.tokens[asymmetric.name]?.border).toBeUndefined();
    // A surface that exists in dark and not in light is a real theme decision
    // and has to survive the round trip.
    expect(json.tokens[asymmetric.name]?.text).toEqual({
      light: "transparent",
      dark: "#ffffff",
    });
  });
});

describe("a full push/pull round trip", () => {
  it("changes nothing that renders", () => {
    // The property NEH-333 asks for, and the one that makes the catalogue
    // trustworthy: export a theme, write it, read it back, and the resolved
    // custom properties are identical. Asserted on RESOLVED PROPERTIES rather
    // than on records, because two token sets can match field-by-field and
    // still paint differently — and can differ while painting the same.
    const source = populatedTheme();
    writeCatalogueTheme(dir, "zen", toJsonTheme(source, "Zen"));
    const pulled = readCatalogueThemeRecords(dir, "zen");

    expect(diffResolvedThemes({ tokens: source }, { tokens: pulled })).toEqual([]);
    expect(themesResolveIdentically({ tokens: source }, { tokens: pulled })).toBe(true);
  });

  it("holds under a non-default prefix too", () => {
    // Optima runs `--optima-*`. A round trip that only survives under the
    // default would pass here and break there, silently.
    const source = populatedTheme();
    writeCatalogueTheme(dir, "zen", toJsonTheme(source, "Zen"));
    const pulled = readCatalogueThemeRecords(dir, "zen");

    expect(diffResolvedThemes({ tokens: source }, { tokens: pulled }, "optima")).toEqual([]);
  });
});
