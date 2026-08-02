/**
 * The injectable logger.
 *
 * This package was extracted from HopperGuard, where it imported `hopper-logger`
 * directly. That is a **private** package, and a dependency on one is the single
 * thing that made the design system unshareable before — `stonedog-style` hit
 * exactly this at 195 import sites and solved it the same way.
 *
 * So: three call sites in `resolver.ts` route through here instead. A host that
 * wants theme resolution in its logs calls `setThemeLogger` once at startup;
 * one that does not gets silence rather than `console` noise it never asked for.
 *
 * No-op by default on purpose. A library that writes to stdout uninvited is a
 * library that has to be silenced before it can be adopted, and the silencing
 * always happens after someone has already been annoyed by it.
 */

export interface ThemeLogger {
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
}

const noop: ThemeLogger = {
  info: () => {},
  warn: () => {},
};

let current: ThemeLogger = noop;

/**
 * Route this package's logging into the host's logger.
 *
 * Call once, near startup, before any theme is resolved. Passing `undefined`
 * restores silence, which is what test teardown wants.
 */
export function setThemeLogger(logger?: ThemeLogger): void {
  current = logger ?? noop;
}

/**
 * The current logger.
 *
 * Read through a function rather than exported as a binding so that a call site
 * picks up a logger installed *after* the module was first imported — module
 * evaluation order is not something a host should have to reason about.
 */
export function themeLog(): ThemeLogger {
  return current;
}
