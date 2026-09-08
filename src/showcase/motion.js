import { TEETH, WHEEL_LOCK_PHASE } from './leverModel.js';

/**
 * Рух вітрини — власна фазова кінематика.
 *
 * Форма кривих повторює `escapement/beat.js` (півзубця за удар, перекидання
 * вилки у вікні ±0.12), але код НЕ імпортує його: вітрина ізольована за
 * рішенням, а її таймінг ні з чим не синхронізується, тож спільності тут
 * нема — лише випадковий збіг форми. Дубль малий (smoothstep і розклад
 * фази), задокументований тут, а не розмазаний мовчки.
 *
 * Усе — чисті функції часу в ударах `u`: пауза й покроковість — це просто
 * зупинка й ручне просування `u`, жодної пам'яті в інтеграторах.
 */

/** Темп вітрини: повільний, щоб замок було видно; швидкість — множник панелі. */
export const BEAT_HZ = 1.0;
/** Амплітуда балансу, градуси. */
export const AMPLITUDE = 270;
/** Розмах вилки, рад: хвіст ходить між обмежувачами. */
export const FORK_MAX = 0.07;
/** Півширина вікна перекидання, частка удару. */
export const FLIP_W = 0.12;

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Розклад фази: номер удару, прогрес перекидання, чергування сторін. */
export function phaseAt(u) {
  const n = Math.round(u);
  const ss = smooth((u - n) / (2 * FLIP_W) + 0.5);
  const sigma = ((n % 2) + 2) % 2 === 0 ? 1 : -1;
  return { n, ss, sigma };
}

/** Колесо: півзубця за удар поверх виміряної фази замка. */
export function wheelAngle(u) {
  const { n, ss } = phaseAt(u);
  return WHEEL_LOCK_PHASE + (Math.PI / TEETH) * (n - 1 + ss);
}

/** Вилка: перекидання між упорами, сторона чергується кожного удару. */
export function forkAngle(u) {
  const { ss, sigma } = phaseAt(u);
  return -FORK_MAX * sigma * (2 * ss - 1);
}

/** Баланс: синус, нуль двічі на удар — зрив відбувається в нулі. */
export function balanceAngle(u, ampDeg = AMPLITUDE) {
  return ((ampDeg * Math.PI) / 180) * Math.sin(Math.PI * u);
}

/**
 * Ім'я фази для підпису: поза вікном — замок; всередині вікно ділиться
 * на зрив → імпульс → падіння. Це постановка послідовності, не виміряний
 * контакт: справжні межі розв'яже посадка падіння.
 */
export function phaseName(u) {
  if (Math.abs(u - Math.round(u)) > FLIP_W) return 'lock';
  const { ss } = phaseAt(u);
  if (ss < 1 / 3) return 'unlock';
  if (ss < 2 / 3) return 'impulse';
  return 'drop';
}

/**
 * Активна палета: замок тримається по черзі. Індекс замка — округлене
 * `u − 0.5` (замки сидять на напівцілих): парний тримає вхідна — це умовність
 * першого кадру, де посадка виміряна саме на ній.
 */
export function activePallet(u) {
  return Math.round(u - 0.5) % 2 === 0 ? 'entry' : 'exit';
}
