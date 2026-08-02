import { buildDefaultTokenRecords, type ComponentTokenRecord } from "../../src";

/**
 * A theme with every slot filled — the only kind that proves anything.
 *
 * `buildDefaultTokenRecords()` returns 32 records whose every slot is
 * `"transparent"`, and the resolver correctly skips those, so resolving the
 * defaults produces **zero** custom properties. A completeness test written
 * against them passes while asserting nothing at all, which is a worse outcome
 * than having no test: it reads as coverage.
 *
 * Hence this. Distinct values per slot so a test can tell *which* slot a
 * property came from — if `bg` and `text` were both `#000` a resolver that
 * emitted the wrong one would still look right.
 */
const SLOT_COLOURS = {
  bgLight: "#111111",
  bgDark: "#222222",
  textLight: "#333333",
  textDark: "#444444",
  borderLight: "#555555",
  borderDark: "#666666",
} as const;

export const FIXTURE_SLOT_COLOURS = SLOT_COLOURS;

/**
 * Every registered token, every slot populated.
 *
 * Built from `buildDefaultTokenRecords` rather than hand-listed so that a token
 * added to the registry is automatically covered here. A hand-written fixture
 * would silently stop covering the new one, which is exactly the hole the
 * completeness assertion is meant to close.
 */
export function populatedTheme(themeId = "fixture"): ComponentTokenRecord[] {
  return buildDefaultTokenRecords(themeId).map((record) => ({
    ...record,
    ...SLOT_COLOURS,
  }));
}
