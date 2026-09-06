import { t, tf } from '../i18n.js';

/**
 * Один рядок формули → готовий текст.
 *
 * Спільний для панелі й тестів навмисно: коли тест мав власну копію цієї
 * логіки, він проходив, а картка показувала сире «%1» — перевірявся намір,
 * а не той самий шлях коду.
 */
export function lineText(line) {
  const key = line.note ?? line.key;
  return line.vals ? tf(key, ...line.vals) : t(key);
}

/** Текст із необов'язковою підстановкою (проза й підказка станції). */
export const maybe = (key, vals) => (vals ? tf(key, ...vals) : t(key));
