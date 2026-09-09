/**
 * The beat phase — shared by every escapement variant.
 *
 * This maths already lived as two copies: in `escapement.js` (before the
 * tourbillon) and in `tourbillon.js` — with the same `FORK_MAX`, the same `FLIP_W`
 * and the same `smooth`. A third variant would have copied it a third time, and
 * identical timing would rest on discipline. Now the phase is computed once, and a
 * variant does one thing only: it lays that phase out on ITS OWN geometry.
 *
 * That is what makes «every variant keeps the same beat» structural: there is
 * physically one `β`, with nothing to fall out of sync with.
 */

/** The fork's swing, rad (~8°). */
export const FORK_MAX = 0.14;
/** Half-width of the unlocking window, as a fraction of a beat. */
export const FLIP_W = 0.12;

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * The phase at the moment `t`.
 *
 * Called every frame, so it takes an `out` buffer and allocates nothing.
 *
 * @returns {{u, n, ss, sigma, thetaB, beta, forkAngle}}
 *   `u` — time in beats; `n` — beat number; `ss` — the smoothstep inside the
 *   unlocking window; `sigma` — the alternating side; `thetaB` — the balance's
 *   angle; `beta` — the movement's driving angle; `forkAngle` — the fork's angle.
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
  // Half a tooth pitch per beat: the escape wheel advances by π/Z on every beat.
  out.beta = (Math.PI / escTeeth) * (n - 1 + ss);
  out.forkAngle = -FORK_MAX * sigma * (2 * ss - 1);
  return out;
}
