# stonedog-theme — the theme layer for stonedog-style

**Repo tier.** Machine-wide conventions (branching, PR rules, the Linear
protocol, Node/nvm) live in `~/.claude/CLAUDE.md` and apply here as written.

**This repo is public and Apache-2.0**, like `stonedog-style`. Never commit a
credential, a customer name, or real theme data from a live product.

## Published on npm

`npm install stonedog-theme` — **0.1.0, published 2026-08-03** under the npm
account `stonedogcode`, alongside `stonedog-style` at the same version.

Unlike `stonedog-style`, this package ships a **built `dist/`**, so a consumer
needs no Panda `include` glob and no `transpilePackages` entry — Panda never
parses it. It emits no CSS and defines no components; it produces a
`Record<string, string>` of custom properties at runtime.

Releasing: `npm run gate`, then `npm run build` (tsup), then `npm publish
--access public` from a clean `main` checkout. Needs a 2FA OTP or a granular
token with bypass-2FA. A published version can never be reused.

**Publishing 0.1.0 does not mean the package is finished** — the database theme
loader (NEH-264) is still missing, so an app whose themes live in a database is
not yet served. The README says so plainly; keep it that way rather than letting
the npm listing imply more than is built.

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
3. **Typeface resolution** (NEH-277) — `resolveFontsToCssVars` emits
   `--hopper-font-family-{body,heading,mono}` and
   `--hopper-font-weight-{normal,medium,semibold,bold}`, and the JSON format
   grew optional `fonts` / `fontWeights` blocks. Before it, type entered the
   package twice (`ThemeConsumptionPayload.fonts`, `extraction.ts`) and left
   through neither, and `fontWeight` did not appear here in any form.

**Still not built, and the package does not do its whole job without it:**

4. **The database loader** — HopperGuard has many themes, edited through a
   theme editor UI, and they must keep working. Tracked in NEH-264.
5. **`stonedog-style` reading the font properties.** NEH-277 built the emitting
   half only; no recipe reads a `--hopper-font-*` property yet, so a themed
   typeface still stops at this package's edge. When that lands it must be
   through a token carrying a **fallback** (the `SIZE_TOKENS` pattern in
   `semantic-variables.ts`), *not* by joining `requiredCssCustomProperties()` —
   an undefined colour paints an invisible element, but an undefined font falls
   back to the browser's face and the page stays readable. Putting type in the
   must-define list would break every existing host for no safety gain, and it
   would change the `requiredCssCustomProperties().length ===
   colorTokenNames().length` identity that both repos pin.

Note `buildDefaultTokenRecords()` returns 32 records whose every slot is
`"transparent"`, and `resolveTokensToCssVars` on them yields **zero**
properties. That is correct — placeholders are not a theme — but it means a
naive "does it produce the 44?" check passes vacuously against defaults. Any
completeness test has to run against a *populated* theme.

## Things that will bite

- **Property names are not derivable from token names.** `textPrimary` is
  `--hopper-box-primary-text`, not `--hopper-text-primary`. Read
  `token-registry.ts`; guessing has already cost one full red test run.
- **Font property names are spelled out: `--hopper-font-family-body`, not
  `--hopper-font-body`.** Families and weights share the `--hopper-font-*`
  namespace, and the longer form is what keeps a future role from shadowing a
  weight step. Both are public API the moment they publish — adding a role is
  backwards-compatible, renaming one silently un-styles whatever read it.
- **The prefix is a resolver ARGUMENT; only the DEFAULT is still `hopper`**
  (NEH-423). `resolveTokensToCssVars`, `resolveFontsToCssVars`,
  `semanticTokenToCssVar` and the three name builders all take an optional
  trailing `cssVarPrefix`, matching how `stonedog-style` spells the same idea
  (`requiredCssCustomProperties(prefix)`) — one concept, one shape, both halves.
  `DEFAULT_CSS_VAR_PREFIX` itself has not moved, because HopperGuard's theme
  data lives in a database keyed on `--hopper-*` and flipping the default is a
  data migration, not a rename (NEH-256). Do not "tidy" the default; do not
  reintroduce a hardcoded literal.

  Three things about it that are load-bearing:

  - **It is an argument, never module state.** A global would make the emitted
    namespace depend on import order and on whoever set it last, and in a
    process serving two prefixes — a suite covering both, a server rendering
    for two brands — that is a race whose only symptom is a page with no
    colour on it.
  - **The host's two halves must agree.** The preset's `cssVarPrefix` decides
    what components *read*; the resolver's decides what the host *writes*.
    Nothing checks that they match, and when they do not, every property is
    defined and every component looks elsewhere.
  - **An invalid prefix throws** (`assertValidCssVarPrefix`, called inside the
    name builders so every caller inherits it). Falling back to the default
    would emit a valid theme in a namespace nothing reads — the same invisible
    failure this package exists to prevent, wearing a disguise.

  **Do not pass the font name builders to `Array.map`.** They take the prefix
  second, which is where `map` puts the index, so `FONT_ROLES.map(getFontFamilyCssVarName)`
  asks for `--0-font-family-body`. The compiler rejects it (number vs string) —
  that is why the prefix is typed rather than left loose — but the fix is an
  arrow wrapper, not a cast.
- **`emitLegacyAliases` deliberately takes NO prefix.** `--colors-*` is Panda's
  own generated namespace, read by HopperGuard's pre-token-layer CSS and by
  nothing else. Prefixing it would produce `--optima-colors-*`, which nothing
  anywhere reads. It is a HopperGuard migration seam that happens to live here,
  not part of the portable surface.
- **`TEXT_BACKGROUND_PAIRS`** in `stonedog-style`'s `semantic-variables.ts`
  encodes which text token is legible against which surface. Components already
  choose colours from it rather than by eye — read it before changing how pairs
  resolve.
- **Strictness now matches `stonedog-style`.** `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` are both on (NEH-266). Every index read and
  regex capture group is therefore `T | undefined`: handle the missing case —
  `null`/skip/throw, whatever that function already does for input it cannot
  read — rather than reaching for `!`, `as`, or a widened type.
- **Whatever the format ACCEPTS, the maths must PARSE** (NEH-424). `json-theme.ts`'s
  `COLOR` regex has always allowed 8-char hex, and `hexToRgb` rejected it on
  length — so `getLuminance` hit its `0` fallback and every translucent colour
  scored **identically to pure black**. A 10% black overlay reported a flawless
  21:1 against white, and a contrast gate reading that would pass it and say so.
  Worse than NEH-285's version of the same bug, because the wrong answer was not
  "no colour" but a confident, plausible number. When adding a notation to that
  regex, add it to `color-math.ts` in the same PR, and assert the two agree.
- **A translucent colour has no contrast ratio, and the resolver declines to
  invent one.** What it renders as depends on the backdrop, which nothing here
  can see. `isTranslucent` gates the AA floor in `resolveTokenSlots`: the pair is
  skipped with a warning rather than the text being rewritten from a number
  describing an opaque shade nobody is looking at. `getContrastRatio` still
  returns a number for such a pair — as-if-opaque, useful as an approximation,
  never a basis for changing anyone's colour. The guard keys on **alpha, not on
  string length**: `#rrggbbff` is an ordinary opaque colour and gets no
  exemption, or writing one would be a way to opt out of the contrast floor.
- **There is exactly one hex parser: `src/color-math.ts`.** `contrast.ts`
  re-exports `hexToRgb` / `rgbToHex` / `getLuminance` from it and `extraction.ts`
  imports them; do not add a local copy to a third module. `extraction.ts` used
  to carry its own, and the two drifted into a pair of silent bugs (NEH-285):
  the private `hexToRgb` rejected 3-char hex, so a site written in `#fff`
  shorthand scored every colour at luminance 0 and extracted **no neutrals and
  default black text**; and the private `rgbToHex` never clamped, so
  `rgb(300,0,0)` became the malformed `#12c0000` and was offered to the UI as a
  selectable colour. Neither was a type error, which is why strictness never
  caught them — only one implementation can.

## Testing

`npm run gate` — typecheck, lint, jest. One tier only: there is nothing to
render, so there is no Playwright tier here (unlike `stonedog-style`, where
jsdom's lack of a layout engine makes one mandatory).

`test/` is in the tsconfig `include`. That is not decoration — HopperGuard's
version included only `src/**`, so its integration tests ran green while never
being type-checked, and the extraction immediately surfaced a
`ThemeConsumptionPayload` missing a required field.
