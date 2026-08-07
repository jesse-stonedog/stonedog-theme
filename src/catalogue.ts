/**
 * The public theme catalogue: reading and writing `<slug>.theme.json` files.
 *
 * ## Why this is a separate entry point
 *
 * This module touches `node:fs` and `node:path`. The main entry deliberately
 * does not — RozCards imports `parseJsonTheme` from a Next.js server component
 * that sits in the same module graph as client code, and pulling `fs` into that
 * graph is a bundler error rather than a runtime one. So the catalogue ships as
 * `@stonedogcode/theme/catalogue` and the resolver half stays isomorphic.
 *
 * ## Why every function takes a directory
 *
 * There is no "find my own themes directory" helper here, on purpose. This
 * package is built by tsup into **both** CJS and ESM, and the two disagree
 * about how a module locates itself — `__dirname` does not exist in ESM,
 * `import.meta.url` is a syntax error in CJS. A self-locating helper works in
 * whichever format the author tested and fails in the other, at the consumer's
 * build, with an error about neither themes nor formats.
 *
 * Taking a path is also what makes this usable for the thing it is actually
 * for. Each product's own copy of its theme is the **source of truth**, and the
 * catalogue is a published mirror — so the same list/load/write functions have
 * to work against a product's own directory and against the package's, without
 * knowing which is which.
 *
 * Consumers resolve the package's directory themselves:
 *
 * ```ts
 * import { dirname, join } from "node:path";
 * import { createRequire } from "node:module";
 *
 * const require = createRequire(import.meta.url);
 * const catalogueDir = join(dirname(require.resolve("@stonedogcode/theme/package.json")), "themes");
 * ```
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseJsonTheme, validateJsonTheme, JsonThemeError } from "./json-theme";
import type { JsonTheme, JsonThemeToken } from "./json-theme";
import type { ComponentTokenRecord } from "./types";
import { COMPONENT_TOKEN_GROUPS } from "./token-registry";

/** The directory name the catalogue lives under, inside the package. */
export const CATALOGUE_DIR_NAME = "themes";

/** The suffix every catalogue file carries. Matches what RozCards already writes. */
export const THEME_FILE_SUFFIX = ".theme.json";

/**
 * A catalogue slug: lowercase, hyphen-separated, no leading or trailing hyphen.
 *
 * The slug is the file name and the identity of a theme across products, which
 * makes it the one thing a push and a pull must agree about. Constrained rather
 * than free-form because it becomes a path: a slug containing `/` or `..` would
 * make `join(dir, slug)` write outside the catalogue, and a slug differing only
 * by case round-trips on Linux and collides on macOS.
 */
const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Reject a slug that is not safe to use as a file name.
 *
 * Throws rather than sanitising. Silently rewriting `My Theme` to `my-theme`
 * means a push and a pull can disagree about which file they mean while both
 * appear to succeed — and the symptom is a product that keeps re-pulling a
 * theme it thinks it already has.
 */
export function assertValidThemeSlug(slug: string): void {
  if (!VALID_SLUG.test(slug)) {
    throw new Error(
      `[@stonedogcode/theme] invalid theme slug ${JSON.stringify(slug)}: ` +
        'expected lowercase words joined by single hyphens, e.g. "ocean-breeze".',
    );
  }
}

/**
 * Turn a human theme name into a slug.
 *
 * Deliberately lossy and deliberately NOT called automatically anywhere. A
 * catalogue file's slug is chosen once and then referenced forever; deriving it
 * on every push means renaming a theme silently orphans its file and writes a
 * second one. Use this when first adding a theme, look at the result, and then
 * treat it as fixed.
 */
export function slugifyThemeName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    // Strip combining marks, so "Café" slugs as "cafe" rather than losing the word.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  assertValidThemeSlug(slug);
  return slug;
}

/** The path a slug's file occupies inside a catalogue directory. */
export function catalogueThemePath(dir: string, slug: string): string {
  assertValidThemeSlug(slug);
  return join(dir, `${slug}${THEME_FILE_SUFFIX}`);
}

/**
 * Every theme slug in a catalogue directory, sorted.
 *
 * Sorted so a caller diffing two catalogues, or printing a list, gets a stable
 * order — `readdirSync` does not promise one.
 *
 * A file that does not end in `.theme.json` is ignored, which is what lets the
 * directory also hold a README. A file that DOES end in it but is not a valid
 * slug is an error, not a skip: it is a theme somebody added that no `pull`
 * will ever find, and skipping it silently is how it stays broken.
 */
export function catalogueThemeSlugs(dir: string): string[] {
  const slugs = readdirSync(dir)
    .filter((file) => file.endsWith(THEME_FILE_SUFFIX))
    .map((file) => file.slice(0, -THEME_FILE_SUFFIX.length));

  for (const slug of slugs) assertValidThemeSlug(slug);

  return slugs.sort();
}

/**
 * Read and validate one catalogue theme.
 *
 * Validated on read, not merely parsed. A catalogue is written by one repo and
 * read by another, so a malformed file reaches its consumer as a runtime
 * surprise otherwise — and the surprise a theme produces is an unstyled page
 * rather than an exception.
 */
export function readCatalogueTheme(dir: string, slug: string): JsonTheme {
  const path = catalogueThemePath(dir, slug);

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(
      `[@stonedogcode/theme] could not read ${path}: ${(error as Error).message}`,
    );
  }

  const problems = validateJsonTheme(parsed);
  if (problems.length > 0) {
    throw new JsonThemeError(
      `[@stonedogcode/theme] ${path} is not a valid theme`,
      problems,
    );
  }

  return parsed as JsonTheme;
}

/** Read a catalogue theme straight into records, ready for the resolver. */
export function readCatalogueThemeRecords(
  dir: string,
  slug: string,
  themeId = slug,
): ComponentTokenRecord[] {
  return parseJsonTheme(readCatalogueTheme(dir, slug), themeId);
}

/**
 * Serialise records back into the file format.
 *
 * The inverse of `parseJsonTheme`, and the half a **push** needs: a product
 * whose source of truth is a database (HopperGuard) or a TypeScript module
 * (Optima) reaches `ComponentTokenRecord[]` first and needs to get from there
 * to a file.
 *
 * Slots are omitted rather than written as `"transparent"`. The registry
 * already knows which slots each token has, and a file that restates it invites
 * the two disagreeing — the same reason `parseJsonTheme` does not require them.
 *
 * Tokens are emitted in **registry order**, not in the order the records
 * arrived. A push that reordered keys on every run would produce a diff every
 * time and make "did anything change?" unanswerable by looking at git.
 */
export function toJsonTheme(
  tokens: ComponentTokenRecord[],
  name: string,
  extras: Pick<JsonTheme, "fonts" | "fontWeights"> = {},
): JsonTheme {
  const byName = new Map(tokens.map((token) => [token.name, token]));
  const themeTokens: JsonTheme["tokens"] = {};

  for (const group of COMPONENT_TOKEN_GROUPS) {
    const token = byName.get(group.key);
    if (!token) continue;

    const slots: JsonThemeToken = {};
    const pairs = [
      ["bg", token.bgLight, token.bgDark],
      ["text", token.textLight, token.textDark],
      ["border", token.borderLight, token.borderDark],
    ] as const;

    for (const [slot, light, dark] of pairs) {
      // Both sides transparent means the slot is unset. One side set is a real
      // asymmetry — a surface that exists in dark and not in light — and must
      // survive the round trip.
      if (light === "transparent" && dark === "transparent") continue;
      slots[slot] = { light, dark };
    }

    if (Object.keys(slots).length > 0) themeTokens[group.key] = slots;
  }

  const theme: JsonTheme = { name, tokens: themeTokens };
  if (extras.fonts) theme.fonts = extras.fonts;
  if (extras.fontWeights) theme.fontWeights = extras.fontWeights;

  return theme;
}

/**
 * Write a theme into a catalogue directory.
 *
 * Formatting is fixed — two-space indent, trailing newline — because these
 * files are committed and reviewed. A push whose only change is whitespace
 * costs a reviewer the same attention as a real one.
 *
 * Returns whether the file's contents actually changed, so a caller can say
 * "already up to date" rather than reporting a write that wrote the same bytes.
 * That is what makes a push idempotent in the way that matters: re-running it
 * produces no commit.
 */
export function writeCatalogueTheme(
  dir: string,
  slug: string,
  theme: JsonTheme,
): { path: string; changed: boolean } {
  const path = catalogueThemePath(dir, slug);
  const problems = validateJsonTheme(theme);
  if (problems.length > 0) {
    // Validated before writing, not after. A catalogue that has already been
    // corrupted is a bad file somebody has to notice; refusing to write one is
    // the only point at which it is cheap.
    throw new JsonThemeError(
      `[@stonedogcode/theme] refusing to write an invalid theme to ${path}`,
      problems,
    );
  }

  const next = JSON.stringify(theme, null, 2) + "\n";

  let current: string | null = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    // Absent is not an error here — this is the first push of a new theme.
    current = null;
  }

  if (current === next) return { path, changed: false };

  writeFileSync(path, next);
  return { path, changed: true };
}
