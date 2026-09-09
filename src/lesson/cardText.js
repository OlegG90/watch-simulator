import { t, tf } from '../i18n.js';

/**
 * One formula line → finished text.
 *
 * Shared between the panel and the tests on purpose: when the test kept its own
 * copy of this logic it passed while the card showed a raw «%1» — the intent was
 * being checked, not the same code path.
 */
export function lineText(line) {
  const key = line.note ?? line.key;
  return line.vals ? tf(key, ...line.vals) : t(key);
}

/** Text with an optional substitution (station prose and hint). */
export const maybe = (key, vals) => (vals ? tf(key, ...vals) : t(key));
