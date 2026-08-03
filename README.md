# stonedog-theme

The theme layer for [`stonedog-style`](https://github.com/jesse-stonedog/stonedog-style).

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
- **The custom-property prefix is still `hopper`.** `DEFAULT_CSS_VAR_PREFIX` in
  `stonedog-style` has not moved, because there is theme data in a database
  keyed on `--hopper-*` and flipping it is a data migration, not a rename.
  Tracked separately.
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
migrator, recipe-contrast map, extraction, and the JSON theme loader.

The **database loader is not built yet**. If your themes live in a database
rather than a file, this package does not yet cover you.

## Development

```bash
npm run gate     # typecheck + lint + jest
npm run build    # tsup -> dist/
```

One test tier only: there is nothing to render, so unlike `stonedog-style`
there is no Playwright tier here.

## License

Apache-2.0
