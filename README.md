# stonedog-theme

The theme layer for [`stonedog-style`](https://github.com/stonedog-code/stonedog-style).

`stonedog-style` owns *shape* — recipes, components, spacing, the type scale —
and knows **no colours at all**. Every colour there is a Panda token whose value
is a bare CSS custom property (`boxBgPrimary` → `var(--hopper-box-primary-bg)`),
so the host application owns the palette and the whole component set re-skins at
runtime.

This package owns the other half: turning a theme definition into those
properties, and checking the result is legible.

```
theme definition ──► ComponentTokenRecord[] ──► resolveTokensToCssVars ──► --<prefix>-* properties
   (JSON or DB)          source-agnostic              pure                    what the host writes
```

`ComponentTokenRecord` is the seam. It is shaped like a database row, but it is
also just a plain object — which is what lets a JSON file and a Postgres row
arrive at the same resolver. Loaders differ; the resolution, contrast maths and
migration logic do not.

## Install

```bash
npm install stonedog-theme
```

Unlike `stonedog-style`, which ships TypeScript source so a consumer's Panda
`codegen` can parse it, this package ships a built `dist/`. Panda never parses
it: it emits no CSS and defines no components, it produces a
`Record<string, string>` of custom properties at runtime.

## Usage

```ts
import { parseJsonTheme, resolveTokensToCssVars } from "stonedog-theme"

const tokens = parseJsonTheme(myThemeJson)          // -> ComponentTokenRecord[]
const vars = resolveTokensToCssVars(tokens, "light") // -> { "--hopper-box-primary-bg": "#3a5ba0", ... }

// The host writes them wherever it owns the document:
for (const [name, value] of Object.entries(vars)) {
  document.documentElement.style.setProperty(name, value)
}
```

A theme carries both light and dark modes; `resolveTokensToCssVars` takes the
mode you want, so switching schemes is re-resolving the same records.

### Choosing a custom-property namespace

Properties are written under `--hopper-*` by default. A host that gave
`stonedog-style` a different one passes the same value here:

```ts
// panda.config.ts
stonedogStylePreset({ cssVarPrefix: "optima" })   // decides what components READ

// at runtime
resolveTokensToCssVars(tokens, "light", "optima") // decides what the host WRITES
resolveFontsToCssVars(fontSettings, "optima")     // same value, same element
```

**These two must agree**, and nothing checks it for you. If they disagree the
properties are all defined and the components all look somewhere else, so every
surface renders with no colour — no build error, no console warning, nothing in
the network tab. Pass the prefix from one constant in your app rather than
typing it twice.

An unusable prefix (empty, containing a space, or with the `--` already on the
front) **throws** rather than falling back to the default. A fallback would emit
a perfectly valid theme in a namespace nothing reads, which is the same
invisible failure wearing a disguise.

## The theme catalogue

`themes/` holds published themes as `<slug>.theme.json`, and ships with the
package — so anything installing `stonedog-theme` gets them.

**Each theme's owning product is the source of truth; this is a mirror.** Two
commands keep them in step, and both are idempotent:

```ts
import {
  catalogueThemeSlugs, readCatalogueThemeRecords, toJsonTheme, writeCatalogueTheme,
} from "stonedog-theme/catalogue";
import { diffResolvedThemes } from "stonedog-theme";

// pull — replace the product's copy with the published one
const published = readCatalogueThemeRecords(catalogueDir, "ocean-breeze");

// push — publish the product's current theme
const { changed } = writeCatalogueTheme(catalogueDir, "ocean-breeze", toJsonTheme(mine, "Ocean Breeze"));

// "would this change anything?" — by resolved properties, not by file bytes
const differences = diffResolvedThemes({ tokens: published }, { tokens: mine });
```

`diffResolvedThemes` is the one to reach for when deciding whether a sync is
needed. Comparing records or files answers a different question: two token sets
can differ textually and paint identically (the AA contrast floor re-resolves
text against its background), and a slot moving to `transparent` removes a
property rather than changing its value, so a whole surface can appear or vanish
without any single value looking different.

**`stonedog-theme/catalogue` is a separate entry point** because it imports
`node:fs`. The main entry stays free of it, so importing the resolver into a
bundled or client-adjacent module graph does not drag the filesystem in.

Every function takes a directory rather than locating the package's own. That is
partly so the same functions work against a product's private theme directory,
and partly because a self-locating helper cannot be written once for a package
built as both ESM and CJS — `import.meta.url` and `__dirname` each exist in only
one of them. Resolve it yourself:

```ts
const catalogueDir = join(dirname(require.resolve("stonedog-theme/package.json")), "themes");
```

## Typefaces

A theme's brand is its colours **and** its type, so families and weights resolve
through the same seam rather than being applied by hand alongside it:

```ts
import { parseJsonThemeFonts, resolveFontsToCssVars, googleFontUrls } from "stonedog-theme"

const fonts = parseJsonThemeFonts(myThemeJson)
resolveFontsToCssVars(fonts)
// -> { "--hopper-font-family-body": "\"Inter\", sans-serif", "--hopper-font-weight-bold": "700" }

googleFontUrls(fonts)   // -> the stylesheets a <link> still has to load
```

Three roles — `body`, `heading`, `mono` — and four weight steps — `normal`,
`medium`, `semibold`, `bold`, the ones `stonedog-style`'s recipes actually name.
Fonts do not vary by colour mode, so unlike the colours this takes no mode;
merge its output into the same map and write both together.

Two things to be clear about:

- **A role or step a theme omits emits nothing**, exactly as a `"transparent"`
  colour slot does. Read them with a fallback —
  `var(--hopper-font-family-body, inherit)` — and a theme with no opinion about
  type leaves yours alone.
- **`stonedog-style` does not consume these yet.** They are not in
  `requiredCssCustomProperties()` and no recipe reads them, so today they are
  inert unless *your* CSS reads them. That is deliberate: an undefined colour
  paints an invisible element, but an undefined font falls back to the browser's
  own face, so type belongs behind a fallback rather than in the list of
  properties a host must define. Nothing you already ship has to change.

`googleFontUrls` exists because a custom property can *name* a family but
nothing in CSS can *fetch* one — that part stays a payload seam, and
`ThemeConsumptionPayload.fonts` still carries it for database-backed hosts.

## Contrast validation

Because the point of a themeable system is that someone *else* picks the
colours, the package checks the result rather than trusting it:

```ts
import { getContrastRatio, getWCAGLevel, validateComponentTokenContrast } from "stonedog-theme"

getContrastRatio("#3a5ba0", "#ffffff")   // 7.02
getWCAGLevel(7.02)                        // "AAA"
validateComponentTokenContrast(tokens)    // per-token pass/fail
```

`suggestContrastFix` and `adjustForContrast` will propose a corrected shade
rather than only reporting the failure.

## Zero runtime dependencies, deliberately

This is arithmetic over plain objects. Every dependency added here is imposed
simultaneously on a public Apache-2.0 consumer, a proprietary SaaS, and an
AGPLv3 one — so the bar is not "is it useful", it is "is it worth constraining
three differently-licensed products".

Logging is an injectable seam (`src/logger.ts`) for the same reason: a hard
dependency on a private logger is what made the original design system
unshareable in the first place.

## Things worth knowing

- **Property names are not derivable from token names.** `textPrimary` is
  `--hopper-box-primary-text`, not `--hopper-text-primary`. Read
  `token-registry.ts` rather than guessing.
- **The DEFAULT prefix is still `hopper`, but it is no longer the only one.**
  Any host can pass its own to the resolvers (see above). What has not moved is
  `DEFAULT_CSS_VAR_PREFIX` — there is theme data in a database keyed on
  `--hopper-*`, and flipping the default is a data migration, not a rename.
  Tracked separately. Choosing a prefix and changing the default are different
  questions; only the second one is parked.
- **Colours may be 3-, 6- or 8-char hex, or `transparent`.** 8-char carries
  alpha. A translucent colour is emitted as written, but it is **exempt from the
  AA contrast floor** — what it renders as depends on whatever is painted behind
  it, which this package cannot see, so there is no ratio to hold it to. The
  resolver logs when it skips one. `rgba()` is not accepted; write `#rrggbbaa`.
- **A token with no matching property renders as nothing, silently** — no build
  error, no console warning. That is the failure mode this package exists to
  make impossible, and it is why the completeness assertion against
  `stonedog-style`'s 44 required properties is part of the test suite.
- **`buildDefaultTokenRecords()` is not a theme.** It returns 32 records whose
  every slot is `"transparent"`, and resolving them yields zero properties —
  correct, but it means any completeness check has to run against a *populated*
  theme or it passes vacuously.

## Status

The pure core is landed and tested: types, token registry, contrast, resolver,
migrator, recipe-contrast map, extraction, the JSON theme loader, and typeface
resolution.

The **database loader is not built yet**. If your themes live in a database
rather than a file, this package does not yet cover you.

**Typeface resolution is only this half of the job.** The properties resolve,
but `stonedog-style` does not read them yet — a themed typeface reaches its
components only once that lands, or once your own CSS reads the properties.

## Development

```bash
npm run gate     # typecheck + lint + jest
npm run build    # tsup -> dist/
```

One test tier only: there is nothing to render, so unlike `stonedog-style`
there is no Playwright tier here.

## License

Apache-2.0
