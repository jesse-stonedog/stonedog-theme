#!/usr/bin/env bash
# Copyright (C) 2026 StoneDogCode L.L.C.
# SPDX-License-Identifier: Apache-2.0
#
# Publish stonedog-theme to npm, end to end.
#
#   npm run publish:stonedog-theme
#
# Run it from a terminal, interactively. npm prompts for the 2FA one-time
# password itself (account `stonedogcode`) and the browser login flow needs a
# human — neither works unattended, which is why this is a script you run
# rather than a step in CI.
#
# Modelled on stonedog-style's script of the same name, and the verification
# half is deliberately identical: it exists because a publish that printed no
# error had already turned out not to have published anything, and during the
# propagation window every obvious check disagrees with every other one.
#
#   * **`npm view pkg@version` is the reliable probe** — it exits 1 when the
#     version is absent and 0 when present. The bare `npm view pkg` form 404s
#     mid-propagation and would report a successful publish as a failure.
#   * **Nothing short of an install proves it.** This ends by installing from
#     the registry into a temp directory, because that is the question a user
#     actually asks and it is the last one to start answering "yes".
#
# ## The trap here is the INVERSE of stonedog-style's
#
# That package ships TypeScript **source**, so its tarball cannot be empty for
# want of a build — its hazard is publishing from a stale checkout, which once
# shipped a package missing the very component it was published for.
#
# This package ships a built **`dist/`** (tsup), and `dist/` is gitignored. So
# the failure that package is structurally immune to is the one this package is
# most exposed to: **a tarball built from nothing, or from a previous
# version's output.** A clean checkout has no `dist/` at all, and `files` names
# it — so without a build, `npm pack` produces a package whose every export
# resolves to a file that is not there. It installs fine and fails at the
# consumer's first import.
#
# Hence step 5: this script **builds**, every time, rather than trusting
# whatever `dist/` happens to be on disk. Both hazards then have a guard — the
# stale-source one (step 1) and the stale-artifact one (step 5).
#
# ## Note if you are running this from inside a consumer
#
# HopperGuard vendors this package as a git submodule, and a submodule checkout
# sits **detached at whatever gitlink the consumer pins** — exactly the stale
# state above. The first guard refuses that and tells you how to fix it.
# Publishing is this repo's own concern, so the script lives here rather than
# in any consumer: every consumer can then run it, and none has to know how it
# works.
set -euo pipefail

PACKAGE_NAME="stonedog-theme"
# Sanity floor for the tarball. The real count is ~20 (dist ESM + CJS + both
# .d.ts flavours + maps, themes/, README, LICENSE, package.json). Set well
# below that so ordinary growth does not trip it, and far above what a package
# with a broken `files` or an unbuilt `dist/` would produce (3–4).
MIN_FILES=12
# Every path `exports` names, in both module formats. A tarball missing one of
# these installs cleanly and fails at the consumer's first import — which is
# precisely the shape an unbuilt `dist/` takes.
REQUIRED_PATHS=(
  "dist/index.js"
  "dist/index.cjs"
  "dist/index.d.ts"
  "dist/catalogue.js"
  "dist/catalogue.cjs"
  "dist/catalogue.d.ts"
)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mREFUSING: %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Publish from a clean, current `main`.
# ---------------------------------------------------------------------------
say "Checking the working tree"
BRANCH="$(git branch --show-current)"
if [ -z "$BRANCH" ]; then
  fail "this checkout is in detached HEAD — the state a submodule sits in by default, pinned to whatever gitlink the consumer records. That is how a stale publish happens. Run: git checkout main && git pull"
fi
[ "$BRANCH" = "main" ] || fail "on branch '$BRANCH'. Publish from main, never a feature branch."
[ -z "$(git status --porcelain | grep -v '^??')" ] || fail "the working tree has uncommitted changes."

git fetch --quiet origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  BEHIND="$(git rev-list --count HEAD..origin/main)"
  fail "HEAD is not origin/main ($BEHIND commit(s) behind). A checkout one commit behind publishes a tarball missing the very thing you are publishing for, and it looks like a success. Run: git pull"
fi
echo "  clean, on main, at $(git rev-parse --short HEAD)"

# ---------------------------------------------------------------------------
# 2. Authenticate.
#
# `npm whoami` is the honest check. A 404 from `npm publish` means AUTH far
# more often than a missing package — npm answers 404 rather than 403 so it
# cannot leak whether a name exists — so establishing identity here turns that
# confusing failure into a clear one. An `_authToken` in ~/.npmrc can also be
# present but expired, which only whoami reveals.
# ---------------------------------------------------------------------------
say "Checking npm authentication"
if ! NPM_USER="$(npm whoami 2>/dev/null)"; then
  echo "  not logged in — starting the browser login flow"
  npm login
  NPM_USER="$(npm whoami)"
fi
echo "  authenticated as $NPM_USER"

if npm view "$PACKAGE_NAME" version >/dev/null 2>&1; then
  npm owner ls "$PACKAGE_NAME" 2>/dev/null | grep -q "^$NPM_USER " \
    || fail "'$NPM_USER' is not an owner of $PACKAGE_NAME, so publishing will fail with a misleading 404. Owners: $(npm owner ls "$PACKAGE_NAME" 2>/dev/null | tr '\n' ' ')"
  echo "  $NPM_USER is an owner of $PACKAGE_NAME"
fi

# ---------------------------------------------------------------------------
# 3. A version may be published at most once, ever.
# ---------------------------------------------------------------------------
VERSION="$(node -p "require('./package.json').version")"
say "Preparing $PACKAGE_NAME@$VERSION"

if npm view "$PACKAGE_NAME@$VERSION" version >/dev/null 2>&1; then
  fail "$PACKAGE_NAME@$VERSION is already published. A version can never be reused — bump it (npm run version:bump:minor), land that, then re-run."
fi

# ---------------------------------------------------------------------------
# 4. The gate: typecheck, lint, unit tier.
#
# Publishing is irreversible on a version number, so the gate runs here rather
# than being assumed from a green PR — this checkout may carry commits that
# merged after the last CI run, and CI is not always available.
# ---------------------------------------------------------------------------
say "Running the gate"
npm run gate

# ---------------------------------------------------------------------------
# 5. BUILD. The step this package needs and stonedog-style does not.
#
# `dist/` is gitignored, so a clean checkout has none — and `files` names it.
# Skipping this produces a tarball whose every export points at a file that is
# not in it: installs fine, fails at the consumer's first import, on a version
# number that can never be reused.
#
# Rebuilt rather than reused, because a `dist/` left over from another branch
# or another version is indistinguishable from a correct one by looking at it.
# ---------------------------------------------------------------------------
say "Building dist/"
npm run build

# ---------------------------------------------------------------------------
# 6. Read the tarball before trusting it.
# ---------------------------------------------------------------------------
say "Verifying the tarball"
PACK_OUTPUT="$(npm pack --dry-run 2>&1)"
FILE_COUNT="$(printf '%s' "$PACK_OUTPUT" | sed -n 's/.*total files:[[:space:]]*\([0-9]*\).*/\1/p' | tail -1)"

[ -n "$FILE_COUNT" ] || fail "could not read a file count from npm pack."
[ "$FILE_COUNT" -ge "$MIN_FILES" ] \
  || fail "the tarball has only $FILE_COUNT files (expected >= $MIN_FILES). That is what an unbuilt or mis-configured package looks like, and publishing it burns a version number forever."

for path in "${REQUIRED_PATHS[@]}"; do
  printf '%s' "$PACK_OUTPUT" | grep -q "$path" \
    || fail "'$path' is not in the tarball, but package.json's \"exports\" names it. Every consumer import would fail. Did the build run?"
done

# The catalogue. It is data rather than code, so nothing above would notice its
# absence — the package would import cleanly and simply have no themes in it.
printf '%s' "$PACK_OUTPUT" | grep -q 'themes/' \
  || fail "no themes/ in the tarball. The catalogue ships with this package; without it every consumer's theme sync reads an empty directory and reports success."

printf '%s' "$PACK_OUTPUT" | grep -q 'README.md' \
  || fail "no README.md in the tarball — npmjs.com would show 'This package does not have a README'."
printf '%s' "$PACK_OUTPUT" | grep -q 'LICENSE' \
  || fail "no LICENSE in the tarball. This package is Apache-2.0 and the licence text ships with it."

echo "  $FILE_COUNT files; entry points, themes/, README and LICENSE all present"

say "Tarball contents — read this before confirming"
printf '%s\n' "$PACK_OUTPUT" | sed -n 's/^npm notice[[:space:]]*[0-9.]*[kMG]*B*[[:space:]]*\(dist\/.*\|themes\/.*\)/  \1/p' | sort
echo "  ($FILE_COUNT files total)"

# ---------------------------------------------------------------------------
# 7. Publish. npm prompts for the OTP here.
#
# `--access public` is explicit: this package has no `publishConfig`, and being
# wrong about it is not recoverable on that version number.
# ---------------------------------------------------------------------------
say "Publishing $PACKAGE_NAME@$VERSION — npm will ask for your 2FA code"
npm publish --access public

# ---------------------------------------------------------------------------
# 8. PROVE IT. The step whose absence is the reason this script exists.
# ---------------------------------------------------------------------------
say "Verifying it is actually installable"
PROBE_DIR="$(mktemp -d)"
trap 'rm -rf "$PROBE_DIR"' EXIT

for attempt in $(seq 1 20); do
  if npm view "$PACKAGE_NAME@$VERSION" version >/dev/null 2>&1; then break; fi
  [ "$attempt" -lt 20 ] || fail "$PACKAGE_NAME@$VERSION is still not on the registry after publishing. The publish did NOT succeed, whatever it printed."
  sleep 3
done

printf '{"name":"probe","version":"1.0.0"}' > "$PROBE_DIR/package.json"
(cd "$PROBE_DIR" && npm install --silent "$PACKAGE_NAME@$VERSION" >/dev/null 2>&1) \
  || fail "$PACKAGE_NAME@$VERSION resolves but cannot be installed."

INSTALLED="$(node -p "require('$PROBE_DIR/node_modules/$PACKAGE_NAME/package.json').version")"
[ "$INSTALLED" = "$VERSION" ] || fail "installed $INSTALLED but published $VERSION."

# The entry points again, this time in what a consumer actually receives.
for path in "${REQUIRED_PATHS[@]}"; do
  [ -f "$PROBE_DIR/node_modules/$PACKAGE_NAME/$path" ] \
    || fail "$path is missing from the INSTALLED package, though it was in the tarball."
done

# And that the package can actually be loaded, not merely unpacked. A dist
# built from a broken source tree unpacks perfectly and throws on require.
(cd "$PROBE_DIR" && node -e "require('$PACKAGE_NAME')" >/dev/null 2>&1) \
  || fail "$PACKAGE_NAME@$VERSION installs but cannot be required. The published dist/ is not loadable."

printf '\n\033[32m✓ %s@%s is published and installable.\033[0m\n' "$PACKAGE_NAME" "$VERSION"
echo "  https://www.npmjs.com/package/$PACKAGE_NAME"
printf '\n\033[1mNext:\033[0m each consumer picks this up by bumping its dependency. Consumers that\n'
printf '  vendor this as a submodule also have a gitlink, which this script does NOT move.\n'
