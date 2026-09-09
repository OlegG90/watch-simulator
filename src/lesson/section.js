/**
 * The side view — a **development along the chain**, not a projection.
 *
 * An honest orthographic projection does not work here: it collapses the Y axis, and
 * the tourbillon cage (14 units from the barrel) lands on top of the differential. So
 * we do what watch sections do: the heights are true, while horizontally the arbors
 * stand at their real centre distances along the chain. A side benefit is that every
 * pinion touches its neighbour's wheel exactly at the pitch circles, because the
 * distances are not invented.
 *
 * The parts come from the same `layout…()` and `LAYERS` that build the scene: the
 * diagram cannot drift away from the mechanism.
 */
import { TRAIN, layoutTrain } from '../train.js';
import { pitchR, WHEEL_T, PINION_T } from '../common.js';
import { LAYERS as BARREL } from '../barrel.js';
import { LAYERS as WIND, RATCHET_T, CROWN_T, RATCH_M } from '../winding.js';
import { profile as reserveProfile } from '../powerReserve.js';
import { profile as motionProfile } from '../motionWorks.js';
import { variantProfile } from '../escapement/index.js';
import { CAGE_R } from '../movement.js';

const V_EXAGGERATION = 2; // otherwise layers 1.1 apart merge; captioned in the viewport

/**
 * The section's parts: `u` — the place along the chain, `z0..z1` — the height, `r` —
 * the half-width. All in movement units.
 *
 * This is a COMPOSER: it derives none of the nodes' own numbers. Every module says
 * for itself what it is made of (`profile()`) and which axis it hangs from
 * (`anchor`) — all that happens here is placing the axes along the chain.
 *
 * @param variant which escapement construction to draw — required: the default
 *                variant is known to the socket, and there will be no second opinion here
 */
export function sectionParts(variant) {
  const arbors = layoutTrain();
  const u = [0];
  for (let k = 1; k < TRAIN.length; k++) {
    u.push(u[k - 1] + pitchR(TRAIN[k - 1].wheel) + pitchR(TRAIN[k].pinion));
  }

  const parts = [];
  const add = (p) => parts.push(p);

  // ── The train's chain: a staircase where each step touches the next ──
  TRAIN.forEach((spec, k) => {
    if (spec.pinion) {
      add({ u: u[k], z0: arbors[k].pinionZ, z1: arbors[k].pinionZ + PINION_T,
            r: pitchR(spec.pinion), mod: 'train', kind: 'pinion' });
    }
    if (spec.wheel) {
      add({ u: u[k], z0: arbors[k].wheelZ, z1: arbors[k].wheelZ + WHEEL_T,
            r: pitchR(spec.wheel), mod: 'train', kind: 'wheel', labelKey: spec.nameKey });
    }
  });

  // The meshing points — where the pitch circles touch.
  const meshes = [];
  for (let k = 1; k < TRAIN.length; k++) {
    meshes.push({
      u: u[k] - pitchR(TRAIN[k].pinion),
      z: (arbors[k].pinionZ + arbors[k - 1].wheelZ + WHEEL_T) / 2,
      text: `${TRAIN[k - 1].wheel}→${TRAIN[k].pinion}`,
    });
  }

  // ── The barrel with its spring (below the wheel) ──
  const drumR = pitchR(TRAIN[0].wheel) - 1.2;
  add({ u: 0, z0: BARREL.drumCentre - BARREL.drumHeight / 2, z1: BARREL.drumCentre + BARREL.drumHeight / 2,
        r: drumR, mod: 'barrel', kind: 'drum' });

  // ── Winding: the ratchet on the barrel arbor + the crown wheel on its own ──
  add({ u: 0, z0: WIND.deck, z1: WIND.deck + 0.5, r: pitchR(RATCHET_T, RATCH_M), mod: 'winding', kind: 'wheel' });
  const uCrown = -((RATCHET_T + CROWN_T) / 2) * RATCH_M;
  add({ u: uCrown, z0: WIND.deck, z1: WIND.deck + 0.5, r: pitchR(CROWN_T, RATCH_M), mod: 'winding', kind: 'wheel',
        labelKey: 'part.winding' });

  // ── The remaining nodes: each one tells its own story ──
  // The chain's axes live here; what hangs on them is the modules' own business.
  const anchorU = { barrel: u[0], centre: u[1], seconds: u[3], escape: u[4] };
  const place = (mod, prof) => {
    // `anchor` is what the module tells the composer, not a property of a part:
    // once placed it means nothing more and does not go into the section.
    for (const { anchor, ...p } of prof.parts) add({ ...p, u: anchorU[anchor] + p.u, mod });
  };

  place('powerReserve', reserveProfile());
  place('motionWorks', motionProfile(arbors));

  // ── The escapement socket: we show WHAT IS INSTALLED ──
  // The development is the one diagram kept truthful here, so it must draw the
  // installed variant rather than one chosen forever.
  place('escapement', variantProfile(variant, arbors[4].wheelZ, { cageR: CAGE_R }));

  // ── The main plate ──
  const uMin = Math.min(...parts.map((p) => p.u - p.r));
  const uMax = Math.max(...parts.map((p) => p.u + p.r));
  add({ u: (uMin + uMax) / 2, z0: -3.6, z1: -2.8, r: (uMax - uMin) / 2, mod: 'plate', kind: 'plate' });

  return { parts, meshes, arborU: u, bounds: { uMin, uMax } };
}

/** The Z levels for the scale on the left — taken from the same data. */
export function zTicks() {
  const arbors = layoutTrain();
  return [...new Set([
    ...arbors.map((a) => a.wheelZ),
    ...reserveProfile().zTicks,
    ...motionProfile(arbors).zTicks,
  ])].sort((a, b) => a - b);
}

export const V_SCALE = V_EXAGGERATION;
