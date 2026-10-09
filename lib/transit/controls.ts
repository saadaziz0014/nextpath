const SHORTCUTS = new Set(['w', 's', 'o', 't', 'h', ' ']);
export function isTransitShortcut(key: string): boolean { return SHORTCUTS.has(key.toLowerCase()); }

/** Holding a key is represented by the controller's Set, not browser repeats.
 * After T clears traction, a still-held W/S must not cancel the chosen mode. */
export function transitCommand(event: { key: string; repeat: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean }): string | null {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null;
  const key = event.key.toLowerCase();
  return isTransitShortcut(key) ? key : null;
}
