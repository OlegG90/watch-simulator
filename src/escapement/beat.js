/**
 * Фаза удару — спільна для всіх варіантів спуску.
 *
 * Ця математика вже двічі жила копіями: у `escapement.js` (до турбійона) і в
 * `tourbillon.js` — з тими самими `FORK_MAX`, `FLIP_W` і тією самою `smooth`.
 * Третій варіант скопіював би її втретє, і однаковий таймінг тримався б на
 * дисципліні. Тепер фаза рахується один раз, а варіант робить єдине: розкладає
 * її по СВОЇЙ геометрії.
 *
 * Саме тому вимога «у всіх варіантів однаковий хід» стає структурною: `β`
 * фізично один, його нема з чим розсинхронізувати.
 */

/** Розмах анкера, рад (~8°). */
export const FORK_MAX = 0.14;
/** Пів-ширина вікна перекидання, частка удару. */
export const FLIP_W = 0.12;

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * Фаза на момент `t`.
 *
 * Кличеться щокадру, тому приймає буфер `out` і не алокує.
 *
 * @returns {{u, n, ss, sigma, thetaB, beta, forkAngle}}
 *   `u` — час у ударах; `n` — номер удару; `ss` — smoothstep у вікні
 *   перекидання; `sigma` — чергування сторін; `thetaB` — кут балансу;
 *   `beta` — приводний кут механізму; `forkAngle` — кут вилки.
 */
export function beatPhase(t, beatHz, ampDeg, escTeeth, out = {}) {
  const u = t * beatHz;
  const A = (ampDeg * Math.PI) / 180;
  const thetaB = A * Math.sin(Math.PI * u);
  const n = Math.round(u);
  const x = (u - n) / (2 * FLIP_W) + 0.5;
  const ss = smooth(x);
  const sigma = ((n % 2) + 2) % 2 === 0 ? 1 : -1;

  out.u = u;
  out.n = n;
  out.ss = ss;
  out.sigma = sigma;
  out.thetaB = thetaB;
  // Пів-кроку зубця за удар: анкерне колесо просувається на π/Z за кожен удар.
  out.beta = (Math.PI / escTeeth) * (n - 1 + ss);
  out.forkAngle = -FORK_MAX * sigma * (2 * ss - 1);
  return out;
}
