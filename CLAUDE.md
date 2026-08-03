# stonedog-theme — the theme layer for stonedog-style

**Repo tier.** Machine-wide conventions (branching, PR rules, the Linear
protocol, Node/nvm) live in `~/.claude/CLAUDE.md` and apply here as written.

**This repo is public and Apache-2.0**, like `stonedog-style`. Never commit a
credential, a customer name, or real theme data from a live product.

## What this is

`stonedog-style` owns *shape* — recipes, components, spacing, the type scale.
It knows **no colours at all**: every colour is a Panda token whose value is a
bare CSS custom property (`boxBgPrimary` → `var(--hopper-box-primary-bg)`).

This package owns the other half: turning a theme definition into those
properties, and checking the result is legible.

```
theme definition ──► ComponentTokenRecord[] ──► resolveTokensToCssVars ──► --<prefix>-* properties
   (DB or JSON)         source-agnostic              pure                    what the host writes
```

**`ComponentTokenRecord` is the seam.** It is described in `types.ts` as "the DB
row shape", and it is — but it is also just a plain object, which is what lets a
JSON file and a Postgres row arrive at the same resolver. Loaders differ; the
resolution, contrast maths and migration logic do not.

## Zero runtime dependencies, deliberately

This is arithmetic over plain objects. Every dependency added here is imposed
simultaneously on a **public Apache-2.0** consumer, a **proprietary SaaS**, and
an **AGPLv3** one — so the bar is not "is it useful", it is "is it worth
constraining three differently-licensed products".

Extracted from HopperGuard's `packages/hopper-theme`, which declared
`@prisma/client`, `hopper-dal`, `hopper-logger` and `hopper-types`. Three of
those were never imported by the source at all. The fourth, `hopper-logger`, was
imported at three call sites in `resolver.ts` and is now the injectable seam in
`src/logger.ts` — the same pattern `stonedog-style` uses, and for the same
reason: a dependency on a private package is what made the design system
unshareable in the first place.

## State — this is a partial extraction

Landed: the pure core (types, token registry, contrast, resolver, migrator,
recipe-contrast map, extraction) with its full test suite, building clean and
depending on nothing.

Since landed as well:

1. **The bridge to `stonedog-style`'s contract** (NEH-263).
   `test/integration/token-contract.test.ts` imports
   `requiredCssCustomProperties` from `stonedog-style/contract` and asserts a
   resolved theme produces every one of them. This matters because **a token
   with no matching property renders as nothing, silently** — no build error, no
   console warning.
2. **The JSON loader** — `src/json-theme.ts` (`validateJsonTheme`,
   `parseJsonTheme`), for RozCards and Optima, which have one theme each and
   want it in a file.

**Still not built, and the package does not do its whole job without it:**

3. **The database loader** — HopperGuard has many themes, edited through a
   theme editor UI, and they must keep working. Tracked in NEH-264.

Note `buildDefaultTokenRecords()` returns 32 records whose every slot is
`"transparent"`, and `resolveTokensToCssVars` on them yields **zero**
properties. That is correct — placeholders are not a theme — but it means a
naive "does it produce the 44?" check passes vacuously against defaults. Any
completeness test has to run against a *populated* theme.

## Things that will bite

- **Property names are not derivable from token names.** `textPrimary` is
  `--hopper-box-primary-text`, not `--hopper-text-primary`. Read
  `token-registry.ts`; guessing has already cost one full red test run.
- **The prefix is `hopper`, still.** `DEFAULT_CSS_VAR_PREFIX` in
  `stonedog-style` has not moved, because HopperGuard's theme data lives in a
  database keyed on `--hopper-*` and flipping it is a data migration, not a
  rename. Tracked separately; do not "tidy" it.
- **`TEXT_BACKGROUND_PAIRS`** in `stonedog-style`'s `semantic-variables.ts`
  encodes which text token is legible against which surface. Components already
  choose colours from it rather than by eye — read it before changing how pairs
  resolve.
- **Strictness is looser here than in `stonedog-style`.**
  `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are off; turning
  them on surfaces 57 real errors, mostly unguarded index access in
  `extraction.ts` and `contrast.ts`. Worth fixing, deliberately not mixed into
  the extraction.

## Testing

`npm run gate` — typecheck, lint, jest. One tier only: there is nothing to
render, so there is no Playwright tier here (unlike `stonedog-style`, where
jsdom's lack of a layout engine makes one mandatory).

`test/` is in the tsconfig `include`. That is not decoration — HopperGuard's
version included only `src/**`, so its integration tests ran green while never
being type-checked, and the extraction immediately surfaced a
`ThemeConsumptionPayload` missing a required field.
