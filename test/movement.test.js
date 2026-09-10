import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildMovement, CAGE_R, demoCanRun, hasRunDown } from '../src/movement.js';
import { buildEscapementSocket } from '../src/escapement/index.js';
import { buildTourbillon } from '../src/escapement/tourbillon.js';
import { LAYERS as DA_LAYERS } from '../src/escapement/doubleAxis.js';
import { BALANCE_OFF, BALANCE_R, buildLever } from '../src/escapement/lever.js';
import { buildShowcase } from '../src/showcase/leverModel.js';
import { dictKeys } from '../src/i18n.js';

// ── Helpers ───────────────────────────────────────────────────────
const TWO = Math.PI * 2;
const mod = (a, q) => ((a % q) + q) % q;
const wrap = (a) => { a = mod(a, TWO); return a > Math.PI ? a - TWO : a; };

const mat = () => new THREE.MeshStandardMaterial();
const buildFresh = () =>
  buildMovement({
    brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(),
    plateMat: mat(), bluedMat: mat(), springSteel: mat(),
  });

/** The meshing invariant: u + v ≡ 0 (mod 1) — see README «Common meshing formulas». */
function meshInvariant(posA, posB, ZA, ZB, RA, RB) {
  const theta = Math.atan2(posB.y - posA.y, posB.x - posA.x);
  const sA = TWO / ZA, sB = TWO / ZB;
  const u = mod(theta - RA, sA) / sA;
  const v = mod(theta + Math.PI - sB / 2 - RB, sB) / sB;
  const e = mod(u + v, 1);
  return Math.min(e, 1 - e);
}

/**
 * The tourbillon's internals — for the tests.
 *
 * The socket hands out only `{ rotating, fixed, update, nodes }`; a variant's meshes
 * live behind a separate door, named so nobody mistakes it for interface. Tests of the
 * escapement's action must see them — but through that door.
 */
const tb = (m) => m.escapement.variant('tourbillon').internals;

/**
 * The world angle about Z: the sum of `rotation.z` up the chain to the root.
 *
 * That sum is only an angle while every link in the chain turns about Z, and since the
 * double-axis module arrived that is no longer true of the whole scene. So the helper
 * checks its own precondition and throws rather than adding up angles measured about
 * different axes — a number that would look perfectly reasonable and mean nothing. This
 * was recorded as debt when the socket landed; the module that made it real has arrived.
 */
const worldZ = (obj, root) => {
  let z = 0, o = obj;
  while (o && o !== root) {
    const q = o.quaternion;
    if (Math.abs(q.x) > 1e-9 || Math.abs(q.y) > 1e-9)
      throw new Error('worldZ: this part does not turn about Z, so its angle about Z is not a number');
    z += o.rotation.z;
    o = o.parent;
  }
  return z;
};
const findHand = (grp) => grp.children.find((c) => c.type === 'Group');
const clockAngle = (u) => Math.PI / 2 - u * TWO;

let m;
beforeAll(() => { m = buildFresh(); });

// ── The going train ───────────────────────────────────────────────
describe('running down', () => {
  it('a demo run needs wind; real time never asks the mainspring anything', () => {
    // The rule is asked in three places — the loop advancing time, the status line, the
    // test harness — so it is written once and they all read it. It used to be written out
    // separately in each, and the panel's tests were quietly grading a copy of it.
    expect(demoCanRun(0.4)).toBe(true);
    expect(demoCanRun(0)).toBe(false);

    expect(hasRunDown({ real: false, running: true, charge: 0 })).toBe(true);
    expect(hasRunDown({ real: false, running: true, charge: 0.01 })).toBe(false);
    // Paused is not run down: nothing is asking it to run.
    expect(hasRunDown({ real: false, running: false, charge: 0 })).toBe(false);
    // And real time keeps going on an empty spring, which is the asymmetry the viewer was
    // left to guess at — measured, not assumed: the loop never consults the charge there.
    expect(hasRunDown({ real: true, running: true, charge: 0 })).toBe(false);
    // And it refuses to answer on half a question. The app's status object had no
    // `running`, the rule returned undefined, and the notice never appeared — while these
    // tests passed, because the harness happened to pass the field.
    expect(() => hasRunDown({ real: false, charge: 0 })).toThrow(/needs/);
    expect(() => hasRunDown({ real: false, running: true })).toThrow(/needs/);
  });
});

describe('going train', () => {
  it('gear ratios: ω = [1, −4, +40/3, −40, +320/3]', () => {
    m.update(0); const r0 = m.arbors.map((a) => a.group.rotation.z);
    m.update(1); const r1 = m.arbors.map((a) => a.group.rotation.z);
    const omegas = r1.map((v, i) => v - r0[i]);
    const expected = [1, -4, 40 / 3, -40, 320 / 3];
    omegas.forEach((w, i) => expect(w).toBeCloseTo(expected[i], 10));
  });

  it('the meshing invariant = 0 on all 4 pairs at arbitrary angles', () => {
    for (const drive of [0, 0.37, 2.9, 11.1]) {
      m.update(drive);
      for (let k = 1; k < 5; k++) {
        const A = m.arbors[k - 1], B = m.arbors[k];
        const e = meshInvariant(A.pos, B.pos, A.spec.wheel, B.spec.pinion,
          A.group.rotation.z, B.group.rotation.z);
        expect(e).toBeLessThan(1e-9);
      }
    }
  });
});

// ── The escapement in the tourbillon ──────────────────────────────
describe('tourbillon escapement', () => {
  const params = { beatHz: 2.5, amplitude: 220 };
  const Tb = 1 / params.beatHz;
  const halfStep = Math.PI / 15;
  // The default variant is the lever escapement; these tests are about the tourbillon, so we install it.
  beforeAll(() => m.escapement.install('tourbillon'));

  it('θ_cage = β: at rest between beats, +π/15 per beat', () => {
    const b = (u) => m.setTime(u * Tb, params);
    const restA = b(0.45), restB = b(0.55), restNext = b(1.45);
    expect(restB - restA).toBeCloseTo(0, 12);
    expect(restNext - restA).toBeCloseTo(halfStep, 12);
  });

  it('the balance (in the cage): full amplitude at a half-beat, zero on the beat', () => {
    const A = (params.amplitude * Math.PI) / 180;
    m.setTime(0.5 * Tb, params);
    expect(tb(m).balance.rotation.z).toBeCloseTo(A, 9);
    m.setTime(1.0 * Tb, params);
    expect(tb(m).balance.rotation.z).toBeCloseTo(0, 9);
  });

  it('the fork (in the cage) alternates ±0.14 rad between rests', () => {
    m.setTime(0.5 * Tb, params); const f0 = tb(m).fork.rotation.z;
    m.setTime(1.5 * Tb, params); const f1 = tb(m).fork.rotation.z;
    m.setTime(2.5 * Tb, params); const f2 = tb(m).fork.rotation.z;
    expect(Math.abs(f0)).toBeCloseTo(0.14, 9);
    expect(f1).toBeCloseTo(-f0, 9);
    expect(f2).toBeCloseTo(f0, 9);
  });

  it('the fourth wheel\'s period = 32 s at 2.5 beats/s (the timing has not changed)', () => {
    m.setTime(0, params); const r0 = m.arbors[3].group.rotation.z;
    m.setTime(60, params); const r1 = m.arbors[3].group.rotation.z;
    expect(60 / (Math.abs(r1 - r0) / TWO)).toBeCloseTo(32, 6);
  });
});

// ── The tourbillon: the cage ──────────────────────────────────────
describe('tourbillon cage', () => {
  const params = { beatHz: 2.5, amplitude: 220 };
  beforeAll(() => m.escapement.install('tourbillon'));

  it('the cage = arbor4.group and turns by θ_cage (12 s per turn at 2.5 beats/s)', () => {
    // The cage is the very node arbor4 is (it carries the pinion the fourth wheel drives).
    expect(tb(m).cage.parent).toBe(m.arbors[4].group);
    m.setTime(0, params); const c0 = m.arbors[4].group.rotation.z;
    m.setTime(60, params); const c1 = m.arbors[4].group.rotation.z;
    expect(60 / (Math.abs(c1 - c0) / TWO)).toBeCloseTo(12, 4);
  });

  it('the fixed wheel stays put while the cage turns', () => {
    const f = buildFresh();
    f.escapement.install('tourbillon');
    const fixedR0 = tb(f).fixed.rotation.z;
    f.setTime(0, params); const cage0 = f.arbors[4].group.rotation.z;
    f.setTime(30, params); const cage1 = f.arbors[4].group.rotation.z;
    expect(tb(f).fixed.rotation.z).toBe(fixedR0); // fixed = does not turn
    expect(cage1).not.toBe(cage0);                        // the cage does turn
  });

  it('the escape wheel rolls around the fixed one (Zf=Zp → relative to the cage = β)', () => {
    const b0 = m.setTime(0.55 * (1 / params.beatHz), params);
    const e0 = tb(m).escSub.rotation.z;
    const b1 = m.setTime(1.55 * (1 / params.beatHz), params);
    const e1 = tb(m).escSub.rotation.z;
    // The escape wheel's angle relative to the cage equals θ_cage (β) — Zf=Zp.
    expect(e1 - e0).toBeCloseTo(b1 - b0, 9);
  });

  it('the hairspring breathes inside the same geometry: the vertices move, the buffer is the same', () => {
    const f = buildFresh();
    f.escapement.install('tourbillon');
    const hair = tb(f).hairGroup.children[0];
    // The moments are deliberately NOT symmetrical about the balance's peak: at u and 1−u
    // the amplitude is the same, and the hairspring would legitimately stand still.
    f.setTime(0.05, params); // u = 0.125
    const geo = hair.geometry;
    const buf = geo.attributes.position.array;
    const first = buf.slice(0, 12);

    f.setTime(0.17, params); // u = 0.425
    // The geometry must not be recreated every frame: TubeGeometry cost ~5.7 KB of
    // garbage and ~285 µs per frame — more than the whole rest of the movement.
    expect(hair.geometry, 'the hairspring geometry was recreated').toBe(geo);
    expect(geo.attributes.position.array, 'the position buffer was replaced').toBe(buf);
    const later = geo.attributes.position.array.slice(0, 12);
    expect([...later].some((v, i) => Math.abs(v - first[i]) > 1e-6),
      'the hairspring vertices do not move').toBe(true);
  });

  it('the hairspring stays a tube of constant thickness at any balance angle', () => {
    const f = buildFresh();
    f.escapement.install('tourbillon');
    const RADIAL = 8, VROW = RADIAL + 1, HAIR_R = 0.034;
    const pos = tb(f).hairGroup.children[0].geometry.attributes.position;
    const rings = pos.count / VROW;
    for (const t of [0, 0.13, 0.27, 0.41]) {
      f.setTime(t, params);
      for (let i = 0; i < rings; i++) {
        let cx = 0, cy = 0, cz = 0;
        for (let j = 0; j < RADIAL; j++) {
          cx += pos.getX(i * VROW + j); cy += pos.getY(i * VROW + j); cz += pos.getZ(i * VROW + j);
        }
        cx /= RADIAL; cy /= RADIAL; cz /= RADIAL;
        for (let j = 0; j <= RADIAL; j++) {
          const d = Math.hypot(pos.getX(i * VROW + j) - cx,
                               pos.getY(i * VROW + j) - cy,
                               pos.getZ(i * VROW + j) - cz);
          expect(d, `t=${t}, ring ${i}`).toBeCloseTo(HAIR_R, 5);
        }
      }
    }
  });
});

// ── The escapement socket ─────────────────────────────────────────
describe('escapement socket', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  const visibleIds = (f) =>
    f.escapement.ids.filter((id) => {
      const v = f.escapement.variant(id);
      return v.rotating.visible || v.fixed.visible;
    });

  it('the installed variant is one of the known ones', () => {
    const f = buildFresh();
    expect(f.escapement.ids.length).toBeGreaterThan(0);
    expect(f.escapement.ids).toContain(f.escapement.installed);
  });

  it('exactly one variant is visible — after every swap too', () => {
    const f = buildFresh();
    // The movement always has exactly one module built in: the choice changes nothing
    // about that. This is not a promise in a note but something that breaks here.
    expect(visibleIds(f)).toEqual([f.escapement.installed]);
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      expect(visibleIds(f), `after install(${id})`).toEqual([id]);
    }
  });

  it('only the installed variant is updated', () => {
    const f = buildFresh();
    // The hairspring rewrites 1089 vertices per frame — three running escapements would
    // triple the frame budget. We count the calls: swapping it on the variant itself is
    // visible to the socket, because it reads `update` at the moment of the call.
    const calls = new Map();
    for (const id of f.escapement.ids) {
      const v = f.escapement.variant(id);
      const real = v.update;
      calls.set(id, 0);
      v.update = (...a) => { calls.set(id, calls.get(id) + 1); return real(...a); };
    }
    for (const id of f.escapement.ids) {
      for (const k of calls.keys()) calls.set(k, 0);
      f.escapement.install(id);
      f.setTime(0.3, params);
      f.setTime(0.7, params);
      for (const [k, n] of calls) {
        expect(n, `variant ${k} while ${id} is installed`).toBe(k === id ? 2 : 0);
      }
    }
  });

  it('the lever escapement is installed at startup — the simplest module', () => {
    // The narrative leads from simple to complex, so the app opens with the lever
    // escapement rather than the tourbillon.
    expect(buildFresh().escapement.installed).toBe('lever');
  });

  it('the choice does not survive rebuilding the movement', () => {
    const a = buildFresh();
    a.escapement.install('tourbillon');
    expect(a.escapement.installed).toBe('tourbillon');
    // A new movement = a new session: no saved state at all.
    expect(buildFresh().escapement.installed).toBe('lever');
  });

  it('every variant produces the same β — the timing does not depend on the construction', () => {
    // This is the main claim of the whole swap, and it holds structurally: the phase is
    // computed by the shared beat engine, so there is physically one β. The test guards that.
    const f = buildFresh();
    for (const t of [0, 0.13, 0.4, 1.7, 9.3]) {
      const betas = f.escapement.ids.map((id) => {
        f.escapement.install(id);
        return f.setTime(t, params);
      });
      for (const b of betas) expect(b, `t=${t}`).toBe(betas[0]);
    }
  });

  it('the fourth wheel = 32 s whichever variant is installed', () => {
    const f = buildFresh();
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      f.setTime(0, params); const r0 = f.arbors[3].group.rotation.z;
      f.setTime(60, params); const r1 = f.arbors[3].group.rotation.z;
      expect(60 / (Math.abs(r1 - r0) / TWO), `variant ${id}`).toBeCloseTo(32, 6);
    }
  });

  it('the balance is the same size in every variant — for the sake of a clean comparison', () => {
    const f = buildFresh();
    const radii = f.escapement.ids.map((id) => f.escapement.variant(id).internals.balR);
    for (const r of radii) expect(r).toBe(radii[0]);
  });

  it('and the same BALANCE, not merely the same radius', () => {
    // The rule was «the same balance in every module», the guard compared radii, and the
    // three drawings drifted underneath it: one had timing screws and another did not, and
    // the rims were different thicknesses. Nothing went red, and the cost table quietly
    // called the newest module cheaper than the one it is meant to be more complex than.
    //
    // So the wheel is built once (`escapement/balance.js`) and this compares what came
    // out: every mesh, its geometry's parameters and where it sits. Identity of
    // construction, not of one number about it.
    const f = buildFresh();
    const wheelOf = (id) => {
      const balance = f.escapement.variant(id).internals.balance;
      const wheel = balance.children.find((c) => c.type === 'Group');
      expect(wheel, `${id}: the balance carries no shared wheel`).toBeTruthy();
      // Walk the whole subtree: the wheel proper comes from `parts/` as its own group,
      // and the hub is the movement's mounting alongside it. A shape without numeric
      // parameters (the extruded rim) is described by its bounding box — otherwise
      // every extrusion would read as the same string and the rim would go unguarded.
      const rows = [];
      wheel.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry, prm = g.parameters || {};
        const nums = Object.keys(prm).filter((k) => typeof prm[k] === 'number').sort();
        let shape;
        if (nums.length) shape = nums.map((k) => `${k}=${prm[k]}`).join(',');
        else {
          g.computeBoundingBox();
          const b = g.boundingBox.getSize(new THREE.Vector3());
          shape = `bbox ${b.x.toFixed(5)},${b.y.toFixed(5)},${b.z.toFixed(5)}`;
        }
        const p = o.position, r = o.rotation;
        rows.push(`${g.type}[${shape}]@${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}` +
                  `/${r.x.toFixed(4)},${r.y.toFixed(4)},${r.z.toFixed(4)}`);
      });
      return rows.sort();
    };
    const first = wheelOf(f.escapement.ids[0]);
    expect(first.length, 'a balance of one mesh is not a balance').toBeGreaterThan(10);
    for (const id of f.escapement.ids.slice(1)) expect(wheelOf(id), id).toEqual(first);
  });

  it('and one FORK, in three sizes — the sections follow the wheel, nobody eyeballs them', () => {
    // The fork was drawn three times, and the three drifted in ways nobody decided: two
    // modules gave the stones a bevelled prism and the third a plain box, and the
    // double-axis fork's bars were scaled down by hand. No test had an opinion about a
    // stone's shape, so nothing went red.
    //
    // The fork is not the same part in three places — the pivot, the reach and the
    // direction to the balance genuinely differ — so this compares what does not: the
    // SECTIONS, normalised by the scale each fork declares. Lengths stay out of it; they
    // are the module's own geometry. The reference numbers are written out here rather
    // than taken from the first module, so all three can be wrong together and still fail.
    const SECTIONS = [
      'box 0.3000x0.2800',                      // the two arms out to the stones
      'box 0.3000x0.2800',
      'box 0.2600x0.2800',                      // the stem towards the balance
      'ExtrudeGeometry 0.3700x0.6700x0.4800',   // the stones — a bevelled prism, not a box
      'ExtrudeGeometry 0.3700x0.6700x0.4800',
      'cyl r=0.1500 h=1.3000 seg=12',           // the arbor
    ].sort();
    const HORNS = ['box 0.1400x0.2800', 'box 0.1400x0.2800'];  // only where a pin rides a notch

    const f = buildFresh();
    const sectionsOf = (id) => {
      const fork = f.escapement.variant(id).internals.fork;
      const k = fork.userData.forkScale;
      expect(k, `${id}: the fork declares no scale — it was not built by the shared builder`)
        .toBeGreaterThan(0);
      return fork.children.map((o) => {
        const g = o.geometry, prm = g.parameters || {};
        if (g.type === 'BoxGeometry')          // width is the bar's LENGTH: the module's own
          return `box ${(prm.height / k).toFixed(4)}x${(prm.depth / k).toFixed(4)}`;
        if (g.type === 'CylinderGeometry')
          return `cyl r=${(prm.radiusTop / k).toFixed(4)} h=${(prm.height / k).toFixed(4)}` +
                 ` seg=${prm.radialSegments}`;
        g.computeBoundingBox();
        const b = g.boundingBox.getSize(new THREE.Vector3());
        return `${g.type} ${(b.x / k).toFixed(4)}x${(b.y / k).toFixed(4)}x${(b.z / k).toFixed(4)}`;
      }).sort();
    };

    for (const id of f.escapement.ids) {
      const got = sectionsOf(id);
      const want = (got.length === SECTIONS.length + 2 ? [...SECTIONS, ...HORNS] : SECTIONS).sort();
      expect(got, `${id}: this fork's sections are its own, not the shared ones`).toEqual(want);
    }
    // Only the lever has horns — the other two have nothing riding in a notch.
    expect(sectionsOf('lever').length).toBe(SECTIONS.length + 2);
    expect(sectionsOf('tourbillon').length).toBe(SECTIONS.length);
    // And the scale is the wheel's, not a number picked to make the test pass: the
    // double-axis wheel really is smaller, so its fork really is smaller by the same ratio.
    const scaleOf = (id) => f.escapement.variant(id).internals.fork.userData.forkScale;
    expect(scaleOf('lever')).toBeCloseTo(1, 12);
    expect(scaleOf('tourbillon')).toBeCloseTo(1, 12);
    expect(scaleOf('doubleAxis')).toBeLessThan(0.5);
  });

  it('and the exhibit draws the SAME balance wheel, at its own size', () => {
    // The guard above compares the three modules with each other, so it cannot see a
    // change made in the builder they share — all three move together and stay equal.
    // That blind spot is exactly how the movement and the exhibit came to draw one part
    // twice: a bent wire with four screws here, a machined rim with eighteen timing pins
    // there. Nothing compared the two models, so nothing went red.
    //
    // This compares them. Sections normalised by the scale each wheel declares, because
    // the exhibit's rim is 1.75 and the movement's 1.95; positions and angles as they
    // are, because the pins' places on the rim are the drawing, not the size.
    const f = buildFresh();
    const balance = f.escapement.variant('lever').internals.balance;
    const mounted = balance.children.find((c) => c.type === 'Group');
    const inMovement = mounted.children.find((c) => c.userData.balanceScale);

    const show = buildShowcase({
      brass: mat(), steel: mat(), darkSteel: mat(), ruby: mat(), springSteel: mat(),
    });
    let inExhibit = null;
    show.balancePivot.traverse((o) => { if (o.userData.balanceScale) inExhibit = o; });

    expect(inMovement, 'the movement carries no shared balance wheel').toBeTruthy();
    expect(inExhibit, 'the exhibit carries no shared balance wheel').toBeTruthy();

    const drawing = (wheel) => {
      const k = wheel.userData.balanceScale;
      const rows = [];
      wheel.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry, prm = g.parameters || {};
        // Only LENGTHS are normalised. Segment counts and sweep angles are not sizes: a
        // uniform scale leaves them alone, and dividing them by k would hide a rim drawn
        // with half the segments while flagging one that is merely bigger.
        const dimensionless = (n) => /segments|theta|teeth|curve/i.test(n);
        const nums = Object.keys(prm).filter((n) => typeof prm[n] === 'number').sort();
        let shape;
        if (nums.length)
          shape = nums.map((n) => `${n}=${dimensionless(n) ? prm[n] : (prm[n] / k).toFixed(4)}`)
            .join(',');
        else {
          g.computeBoundingBox();
          const b = g.boundingBox.getSize(new THREE.Vector3());
          shape = `bbox ${(b.x / k).toFixed(4)},${(b.y / k).toFixed(4)},${(b.z / k).toFixed(4)}`;
        }
        const p = o.position, r = o.rotation;
        rows.push(`${g.type}[${shape}]@${(p.x / k).toFixed(4)},${(p.y / k).toFixed(4)},` +
                  `${(p.z / k).toFixed(4)}/${r.z.toFixed(4)}`);
      });
      return rows.sort();
    };

    const want = drawing(inExhibit);
    expect(want.length, 'a balance of one mesh is not a balance').toBeGreaterThan(15);
    expect(drawing(inMovement), 'the two models draw the balance differently').toEqual(want);
    // And the sizes really do differ, or the normalisation above proves nothing.
    expect(inMovement.userData.balanceScale)
      .not.toBeCloseTo(inExhibit.userData.balanceScale, 3);
  });

  it('escape wheel: 12 s in the lever, 6 s in the tourbillon (it rides the cage)', () => {
    // The difference is real and visible — which is why it belongs to the comparison,
    // not to a station card, where only unchanging numbers belong.
    const f = buildFresh();
    const absPeriod = (mesh) => {
      f.setTime(0, params); const a0 = worldZ(mesh, f.root);
      f.setTime(60, params); const a1 = worldZ(mesh, f.root);
      return 60 / (Math.abs(a1 - a0) / TWO);
    };
    f.escapement.install('lever');
    expect(absPeriod(f.escapement.variant('lever').internals.escWheel)).toBeCloseTo(12, 4);
    f.escapement.install('tourbillon');
    expect(absPeriod(f.escapement.variant('tourbillon').internals.escSub)).toBeCloseTo(6, 4);
  });

  it('the double-axis module: the three ratios multiply to one, or the beat would drift', () => {
    // The escape wheel must turn by exactly β relative to its fork, and the fork rides in
    // the inner cage. Follow the drive — rolling on the plate, through the bevel, rolling
    // again inside the inner cage — and the product of the three ratios has to be 1. It is
    // a constraint on the tooth counts, not a number anyone picked, and everything else in
    // the module is free within it.
    const d = buildFresh().escapement.variant('doubleAxis').internals;
    expect(d.escPerBeta * (d.innerPerBeta / d.escPerBeta) * d.escPerInner).toBeCloseTo(1, 12);
    expect(d.escPerFork).toBeCloseTo(1, 12);
    // And within the constraint there is still a choice: the inner cage turns twice for
    // every turn of the outer, which is what a second axis is for.
    expect(d.innerPerBeta).toBeCloseTo(2, 12);
  });

  it('the double-axis module: the escape wheel steps half a tooth per beat, as everywhere else', () => {
    // Measured where the question has an answer: the wheel and its fork share a parent, so
    // the angle between them is an ordinary rotation about one axis.
    const f = buildFresh();
    f.escapement.install('doubleAxis');
    const d = f.escapement.variant('doubleAxis').internals;
    const beat = 1 / params.beatHz;                  // seconds in one beat
    f.setTime(0, params); const a0 = d.escSub.rotation.z;
    f.setTime(beat * 8, params); const a1 = d.escSub.rotation.z;
    expect((a1 - a0) / 8).toBeCloseTo(Math.PI / 15, 9);
  });

  it('the double-axis module: the inner axis stands at a right angle to the outer', () => {
    const d = buildFresh().escapement.variant('doubleAxis').internals;
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(d.innerCarrier.quaternion);
    expect(Math.abs(axis.dot(new THREE.Vector3(0, 0, 1))), 'not a right angle').toBeLessThan(1e-9);
  });

  it('the double-axis module: the inner cage swings inside the outer one\'s plates', () => {
    // The reason this cage is taller than the single-axis one. The inner cage sweeps a
    // circle of its own radius about a horizontal axis, and that circle has to fit between
    // the plates — so the height is a consequence of the balance's size, not a choice.
    const d = buildFresh().escapement.variant('doubleAxis').internals;
    expect(DA_LAYERS.axis - d.innerR).toBeGreaterThan(DA_LAYERS.bottom);
    expect(DA_LAYERS.axis + d.innerR).toBeLessThan(DA_LAYERS.top);
    expect(d.balR, 'the balance is the one every module shares').toBe(1.95);
  });

  it('worldZ refuses to answer where the answer would not be an angle', () => {
    // The helper used to sum rotation.z up the chain. With a cage turning about a tilted
    // axis that sum still computes — and means nothing. Sabotage-proofing the measurement
    // itself: it throws rather than returning a plausible number.
    const f = buildFresh();
    f.escapement.install('doubleAxis');
    const d = f.escapement.variant('doubleAxis').internals;
    expect(() => worldZ(d.escSub, f.root)).toThrow(/not a number/);
    // And it still answers for the parts that do turn about Z.
    expect(() => worldZ(d.cage, f.root)).not.toThrow();
  });

  it('the escape wheel\'s turn is derived from the meshing, not typed in', () => {
    // The escape node rolls around the fixed wheel, so per turn of the arbor the wheel
    // makes 1 + Zf/Zp. The same teeth move the mesh and give the number for the
    // comparison: change Zf and both the scene and the line in the modal shift.
    const mats = { steel: mat(), brass: mat(), axleMat: mat(), ruby: mat(),
                   plateMat: mat(), bluedMat: mat(), springSteel: mat() };
    const opts = { escTeeth: 15, moduleT: 0.26, cageR: 4.3, escDirLocal: 0 };
    const t1 = buildTourbillon(mats, { ...opts, fixedTeeth: 10, pinionTeeth: 10 });
    const t2 = buildTourbillon(mats, { ...opts, fixedTeeth: 20, pinionTeeth: 10 });

    expect(t1.motion.escapeTurns).toBe(2);
    expect(t2.motion.escapeTurns).toBe(3);
    expect(t1.motion.hasCage).toBe(true);

    // The mesh follows the same formula: double Zf → twice the rolling angle.
    t1.update(0.37, 2.5, 220); const a1 = t1.escSub.rotation.z;
    t2.update(0.37, 2.5, 220); const a2 = t2.escSub.rotation.z;
    expect(a2 / a1).toBeCloseTo(2, 9);
  });

  it('the lever escapement has no cage, and its wheel makes one turn per turn of the arbor', () => {
    const f = buildFresh();
    expect(f.escapement.variant('lever').motion).toEqual({ escapeTurns: 1, hasCage: false });
  });

  it('at lock a tip stands on a pallet stone, not between teeth', () => {
    // The lock phase is staging, not physics: β and the motion curves are unchanged, but a
    // constant extra rotation of the wheel seats a tip on the active pallet in every locked
    // state (both parities of beat, both ends of the window). Sabotage: with a zero rotation
    // the tip lands ~6° past the stone — and this test goes red.
    // Built directly, like the tourbillon tests above: the socket's matrices are irrelevant here.
    const lv = buildLever({ steel: mat(), brass: mat(), springSteel: mat(), axleMat: mat() }, {});
    const stones = [];
    lv.fork.traverse((o) => { if (o.isMesh && o.geometry.type === 'ExtrudeGeometry') stones.push(o); });
    expect(stones).toHaveLength(2);
    const STEP = TWO / 15;
    for (let n = 0; n < 6; n++) {
      for (const u of [n + 0.2, n + 0.5]) {
        const beta = lv.update(u / 2.5, 2.5, 220);
        lv.fork.updateMatrixWorld(true);
        const wp = stones.map((s) => s.getWorldPosition(new THREE.Vector3()));
        wp.sort((a, b) => (a.x ** 2 + a.y ** 2) - (b.x ** 2 + b.y ** 2)); // the active one is deeper
        const stoneAng = Math.atan2(wp[0].y, wp[0].x);
        let best = Infinity;
        for (let i = 0; i < 15; i++)
          best = Math.min(best, Math.abs(wrap(beta + lv.escWheel.rotation.z + i * STEP - stoneAng)));
        expect(best).toBeLessThan(THREE.MathUtils.degToRad(2));
      }
    }
  });

  it('the scene names the SOCKET, not the installed module', () => {
    // Decision #21: the scene chrome is a list of PLACES in the movement (barrel, centre
    // wheel, hands, winding), so the escapement is named there as a place. The module's
    // name sounds where the module is the subject: the modal, the section, the table.
    const f = buildFresh();
    const esc = f.focusPoints.find((p) => p.id === 'escapement');
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      expect(esc.nameKey, `after installing «${id}»`).toBe('part.escapement');
      expect(f.escapement.nameKey, 'the module itself does have a name').toBe(`part.${id}`);
    }
  });

  it('the node knobs address ONLY the installed module', () => {
    // Until now the free-mode panel addressed the tourbillon by name: with the lever
    // escapement installed, the «Balance» checkbox switched on the hidden tourbillon's
    // balance — two escapements in a movement that always holds exactly one.
    const f = buildFresh();
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      const v = f.escapement.variant(id);
      const own = new Set();
      for (const root of [v.rotating, v.fixed]) root.traverse((o) => own.add(o));
      for (const n of f.escapement.nodes()) {
        if (!n.obj.isObject3D) continue;           // the cage's opacity is not a mesh
        expect(own.has(n.obj), `${id} / ${n.labelKey}`).toBe(true);
      }
    }
  });

  it('every node knob is on — the other module still cannot be seen', () => {
    const f = buildFresh();
    const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      for (const n of f.escapement.nodes()) if (n.kind === 'flag') n.obj[n.prop] = true;
      for (const other of f.escapement.ids) {
        if (other === id) continue;
        const v = f.escapement.variant(other);
        let shown = 0;
        for (const root of [v.rotating, v.fixed]) root.traverse((o) => { if (o.isMesh && visible(o)) shown++; });
        expect(shown, `with ${id} installed, meshes of ${other} are visible`).toBe(0);
      }
    }
  });

  it('every escapement module has knobs of its own, and all of them are translated', () => {
    const f = buildFresh();
    const keys = new Set(dictKeys('ua'));
    for (const id of f.escapement.ids) {
      f.escapement.install(id);
      const nodes = f.escapement.nodes();
      expect(nodes.length, `variant ${id} has no knobs at all`).toBeGreaterThan(0);
      for (const n of nodes) expect(keys, `${id} / ${n.labelKey}`).toContain(n.labelKey);
    }
  });

  it('the cost of complexity is measured, not typed in: the parts are counted by walking', () => {
    const f = buildFresh();
    for (const id of f.escapement.ids) {
      const v = f.escapement.variant(id);
      let n = 0;
      for (const root of [v.rotating, v.fixed]) root.traverse((o) => { if (o.isMesh) n++; });
      expect(v.cost.parts, `variant ${id}`).toBe(n);
    }
  });

  it('the envelope follows the geometry: a bigger cage, a bigger recess', () => {
    // The most direct proof that the number is not typed in: change a constant and see
    // whether the measure follows it.
    const socket = (cageR) => buildEscapementSocket(
      { brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(), springSteel: mat(), plateMat: mat() },
      { escTeeth: 15, cageMat: mat(), cageR },
      { arbor: new THREE.Group(), root: new THREE.Group(), pos: { x: 0, y: 0 }, zBase: 0 }
    );
    const small = socket(4.3).variant('tourbillon').cost.r;
    const big = socket(5.5).variant('tourbillon').cost.r;
    expect(big).toBeGreaterThan(small);
  });

  it('the tourbillon costs more by every measure except width', () => {
    const f = buildFresh();
    const lever = f.escapement.variant('lever').cost;
    const tb = f.escapement.variant('tourbillon').cost;
    expect(tb.parts).toBeGreaterThan(lever.parts);      // 50 against 18
    expect(tb.axes).toBe(lever.axes + 1);               // the cage is an extra level
    expect(tb.h).toBeGreaterThan(lever.h);              // a taller tower
    // The lever's recess, though, is WIDER: the balance carried out to the side reaches
    // further than the edge of the cage. The cost of complexity is in parts and height, not width.
    expect(lever.r).toBeGreaterThan(tb.r);
  });

  it('a larger share of the tourbillon\'s parts are in motion — the cage carries the whole escapement', () => {
    const f = buildFresh();
    const tb = f.escapement.variant('tourbillon').cost;
    const lever = f.escapement.variant('lever').cost;
    // What stays still in the tourbillon is exactly the fixed wheel and its pillar — that
    // is the point of the node: the escape pinion rolls around THAT fixed wheel.
    expect(tb.parts - tb.moving).toBe(2);
    expect(tb.moving / tb.parts).toBeGreaterThan(lever.moving / lever.parts);
    expect(lever.moving).toBeGreaterThan(0);
  });

  it('the lever variant\'s recess = the carried-out balance, the tourbillon\'s = the edge of the cage', () => {
    const f = buildFresh();
    expect(f.escapement.variant('lever').cost.r)
      .toBeGreaterThanOrEqual(BALANCE_OFF + BALANCE_R);
    expect(f.escapement.variant('tourbillon').cost.r).toBeCloseTo(CAGE_R, 0);
  });

  it('an unknown variant is rejected rather than silently ignored', () => {
    const f = buildFresh();
    expect(() => f.escapement.install('no-such-thing')).toThrow();
    expect(visibleIds(f)).toEqual([f.escapement.installed]);
  });
});

// ── Motion works and centre seconds ───────────────────────────────
describe('motion works + centre seconds', () => {
  it('the hour arbor = the centre wheel / 12, in the same direction', () => {
    m.update(0); const c0 = m.arbors[1].group.rotation.z, h0 = m.internals.motionWorks.hourGroup.rotation.z;
    m.update(3); const c1 = m.arbors[1].group.rotation.z, h1 = m.internals.motionWorks.hourGroup.rotation.z;
    expect((h1 - h0) / (c1 - c0)).toBeCloseTo(1 / 12, 12);
  });

  it('centre seconds : minute arbor = 60', () => {
    m.update(0); const s0 = m.internals.motionWorks.centralSecondsGroup.rotation.z, c0 = m.arbors[1].group.rotation.z;
    m.update(1); const s1 = m.internals.motionWorks.centralSecondsGroup.rotation.z, c1 = m.arbors[1].group.rotation.z;
    expect((s1 - s0) / (c1 - c0)).toBeCloseTo(60, 10);
  });

  it('the invariants of the motion-works pairs (12→36, 10→40) = 0', () => {
    const P1 = m.arbors[1].pos;
    const mw = m.internals.motionWorks.mwArbor.position;
    for (const drive of [0, 1.7]) {
      m.update(drive);
      const e1 = meshInvariant(P1, mw, 12, 36, m.arbors[1].group.rotation.z, m.internals.motionWorks.mwArbor.rotation.z);
      const e2 = meshInvariant(mw, P1, 10, 40, m.internals.motionWorks.mwArbor.rotation.z, m.internals.motionWorks.hourGroup.rotation.z);
      expect(e1).toBeLessThan(1e-9);
      expect(e2).toBeLessThan(1e-9);
    }
  });

  it('the invariants of the centre-seconds pairs (48→20, 20→8) = 0', () => {
    const P3 = m.arbors[3].pos, P1 = m.arbors[1].pos;
    const idler = m.internals.motionWorks.csIdlerGroup.position;
    for (const drive of [0, 0.9]) {
      m.update(drive);
      const e1 = meshInvariant(P3, idler, 48, 20, m.arbors[3].group.rotation.z, m.internals.motionWorks.csIdlerGroup.rotation.z);
      const e2 = meshInvariant(idler, P1, 20, 8, m.internals.motionWorks.csIdlerGroup.rotation.z, m.internals.motionWorks.centralSecondsGroup.rotation.z);
      expect(e1).toBeLessThan(1e-9);
      expect(e2).toBeLessThan(1e-9);
    }
  });
});

// ── Real-time mode ────────────────────────────────────────────────
describe('real time (setClockTime)', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  it('the hands land exactly on the clock angles; the cage stays engaged', () => {
    const phi4 = m.arbors[4].phi;
    for (const [hh, mm, ss, beatT] of [[3, 0, 0, 0.4], [9, 0, 30, 12.6], [12, 30, 15, 101.9], [6, 45, 52, 250.3]]) {
      const beta = tb(m).update(beatT, params.beatHz, params.amplitude);
      m.setClockTime(new Date(2026, 0, 1, hh, mm, ss, 0), beatT, params);
      const su = ss / 60, mu = (mm + su) / 60, hu = ((hh % 12) + mu) / 12;
      expect(wrap(worldZ(findHand(m.internals.motionWorks.centralSecondsGroup), m.root) - clockAngle(su))).toBeCloseTo(0, 9);
      expect(wrap(worldZ(findHand(m.internals.motionWorks.cannonSub), m.root) - clockAngle(mu))).toBeCloseTo(0, 9);
      expect(wrap(worldZ(findHand(m.internals.motionWorks.hourGroup), m.root) - clockAngle(hu))).toBeCloseTo(0, 9);
      expect(m.arbors[4].group.rotation.z - phi4 - beta).toBeCloseTo(0, 9); // the cage = phi4 + β
    }
  });
});

// ── Winding ───────────────────────────────────────────────────────
describe('winding', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  it('charge is derived from the differential: going spends it, a click adds it, clamped at the stop', () => {
    const f = buildFresh(); // c₀ = 0.75
    expect(f.winder.charge).toBeCloseTo(0.75, 9);
    // Running down to a stop (emulating the demo gate charge>0): 0.75·2·SWEEP/RB = π/4 rad
    // of the barrel ≈ 160 s at 2.5 beats/s (RA=1, RB=4).
    let t = 0;
    while (f.winder.charge > 0 && t < 250) { t += 0.1; f.setTime(t, params); }
    expect(f.winder.charge).toBe(0);
    expect(t).toBeGreaterThan(150);
    expect(t).toBeLessThan(172);
    // A click = π/2 of the ratchet → +RA·(π/2)/(2·SWEEP) = 0.375 of charge.
    f.winder.wind();
    for (let i = 0; i < 300; i++) f.winder.update(0.05);
    expect(f.winder.charge).toBeCloseTo(0.375, 2);
    // Clamped at the stop: many clicks → exactly 1 (the crown stops turning).
    for (let k = 0; k < 5; k++) { f.winder.wind(); for (let i = 0; i < 300; i++) f.winder.update(0.05); }
    expect(f.winder.charge).toBe(1);
  });

  it('the click ticks over the ratchet teeth while winding', () => {
    const f = buildFresh();
    const click = f.winder.click;
    expect(click.rotation.z).toBe(0); // at rest it lies in a space
    f.winder.wind();
    const lifts = [];
    for (let i = 0; i < 40; i++) { f.winder.update(0.01); lifts.push(click.rotation.z); }
    expect(Math.max(...lifts)).toBeGreaterThan(0.03);          // it did lift over the teeth
    let drops = 0;
    for (let i = 1; i < lifts.length; i++) {
      expect(lifts[i]).toBeGreaterThanOrEqual(0);
      expect(lifts[i]).toBeLessThanOrEqual(0.07 + 1e-9);       // within the lever's travel
      if (lifts[i] < lifts[i - 1] - 0.02) drops++;             // a sharp drop = the «tick»
    }
    expect(drops).toBeGreaterThanOrEqual(3);                   // several teeth per click of winding
  });

  it('the barrel wheel stays still while winding', () => {
    const f = buildFresh();
    const r0 = f.arbors[0].group.rotation.z;
    f.winder.wind();
    for (let i = 0; i < 200; i++) f.winder.update(0.05);
    expect(f.arbors[0].group.rotation.z).toBe(r0);
  });

  it('the bevel pair: the pitch circles touch, the apices coincide', () => {
    m.root.updateMatrixWorld(true);
    let bw = null, bp = null;
    m.winder.group.traverse((o) => {
      if (o.isMesh && o.userData.gear) {
        if (o.userData.gear.teeth === 16) bw = o;
        if (o.userData.gear.teeth === 8) bp = o;
      }
    });
    expect(bw).toBeTruthy(); expect(bp).toBeTruthy();
    const RATCH_M = 0.33;
    const Rw = (RATCH_M * 16) / 2, gw = 1 / Math.tan(Math.atan(16 / 8));
    const Rp = (RATCH_M * 8) / 2, gp = 1 / Math.tan(Math.atan(8 / 16));
    // The shared apex: the local zeros of both meshes, in world space.
    const apexW = bw.localToWorld(new THREE.Vector3());
    const apexP = bp.localToWorld(new THREE.Vector3());
    expect(apexW.distanceTo(apexP)).toBeLessThan(1e-9);
    // The pitch circles' contact — analytically (a point of the wheel's circle → the
    // pinion's circle), independent of the sampling step.
    const pC = bp.localToWorld(new THREE.Vector3(0, 0, Rp * gp)); // the centre of the pinion's circle
    const pN = bp.localToWorld(new THREE.Vector3(0, 0, 1)).sub(bp.localToWorld(new THREE.Vector3())).normalize();
    const distToPinionCircle = (pt) => {
      const d = pt.clone().sub(pC);
      const h = d.dot(pN);                       // the distance to the circle's plane
      const radial = d.clone().addScaledVector(pN, -h).length(); // the projection into that plane
      return Math.hypot(radial - Rp, h);
    };
    let minD = Infinity;
    for (let i = 0; i < 1440; i++) {
      const a = (i / 1440) * TWO;
      minD = Math.min(minD, distToPinionCircle(
        bw.localToWorld(new THREE.Vector3(Math.cos(a) * Rw, Math.sin(a) * Rw, Rw * gw))
      ));
    }
    expect(minD).toBeLessThan(1e-4);
  });
});

// ── The power-reserve indicator (differential) ────────────────────
describe('power reserve differential', () => {
  const params = { beatHz: 2.5, amplitude: 220 };

  it('the carrier-hand\'s angle: α(c) = α₀ + (α₁−α₀)·c', () => {
    const f = buildFresh();
    const { hand, emptyAngle, fullAngle } = f.internals.powerReserve;
    const expectAt = (c) => emptyAngle + (fullAngle - emptyAngle) * c;
    expect(hand.rotation.z).toBeCloseTo(expectAt(0.75), 9); // the initial charge
    f.winder.wind(); // 0.75 + 0.375 → clamped at 1 (the stop)
    for (let i = 0; i < 300; i++) f.winder.update(0.05);
    expect(hand.rotation.z).toBeCloseTo(expectAt(1), 9);
  });

  it('the hand moves monotonically towards «empty» while running', () => {
    const f = buildFresh();
    const angles = [];
    for (let i = 0; i < 5; i++) { angles.push(f.internals.powerReserve.hand.rotation.z); f.setTime(15 * (i + 1), params); }
    for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]); // towards PR_EMPTY (150°)
  });

  it('the differential condition: Δcarrier = (ΔS_up + ΔS_low)/2 while winding and while running', () => {
    const f = buildFresh();
    const pr = f.internals.powerReserve;
    const snap = () => ({ u: pr.sunUp.rotation.z, l: pr.sunLow.rotation.z, c: pr.hand.rotation.z });
    const s0 = snap();
    f.winder.wind(); for (let i = 0; i < 100; i++) f.winder.update(0.02); // a partial wind
    const s1 = snap();
    expect(s1.c - s0.c).toBeCloseTo(((s1.u - s0.u) + (s1.l - s0.l)) / 2, 12);
    f.setTime(20, params); // running
    const s2 = snap();
    expect(s2.c - s1.c).toBeCloseTo(((s2.u - s1.u) + (s2.l - s1.l)) / 2, 12);
  });

  it('the lower sun stays still while winding; the upper one while running', () => {
    const f = buildFresh();
    const pr = f.internals.powerReserve;
    const low0 = pr.sunLow.rotation.z;
    f.winder.wind(); for (let i = 0; i < 100; i++) f.winder.update(0.02);
    expect(pr.sunLow.rotation.z).toBe(low0);          // the train holds the barrel
    const up1 = pr.sunUp.rotation.z;
    f.setTime(10, params);
    expect(pr.sunUp.rotation.z).toBe(up1);            // the click holds the ratchet
    expect(pr.sunLow.rotation.z).not.toBe(low0);      // while the lower one does move
  });

  it('the invariants of the going path\'s meshings = 0 (hub→compound→sun\'s tube)', () => {
    const f = buildFresh();
    const pr = f.internals.powerReserve;
    const A0 = f.arbors[0].pos; // the differential is coaxial with the barrel
    const I = { x: pr.group.position.x + pr.idler.position.x, y: pr.group.position.y + pr.idler.position.y };
    // A few states: winding + running.
    f.winder.wind(); for (let i = 0; i < 60; i++) f.winder.update(0.02);
    for (const t of [0, 7.3]) {
      f.setTime(t, params);
      // the hub wheel (32, driven by the barrel wheel) → the compound's pinion (8)
      const eHI = meshInvariant(A0, I, 32, 8, f.arbors[0].group.rotation.z, pr.idler.rotation.z);
      // the compound's wheel (20) → the wheel on the lower sun's tube (20)
      const eIG = meshInvariant(I, A0, 20, 20, pr.idler.rotation.z, pr.sunLow.rotation.z);
      expect(eHI).toBeLessThan(1e-9);
      expect(eIG).toBeLessThan(1e-9);
    }
  });

  it('real time = auto-wind: the reserve hand stands still, the ratchet advances', () => {
    const f = buildFresh();
    const pr = f.internals.powerReserve;
    const hand0 = pr.hand.rotation.z;
    const ratchet0 = f.winder.ratchet.rotation.z;
    f.setClockTime(new Date(2026, 0, 1, 3, 0, 0), 0.5, params);
    f.setClockTime(new Date(2026, 0, 1, 3, 0, 30), 30.5, params);
    expect(pr.hand.rotation.z).toBeCloseTo(hand0, 9);          // the reserve does not fall
    expect(f.winder.ratchet.rotation.z).toBeLessThan(ratchet0); // auto-wind turns the ratchet (counter-rotating)
  });
});

// ── Layout ────────────────────────────────────────────────────────
describe('layout', () => {
  it('every focus point is inside the plate', () => {
    const { cx, cy, plateR } = m.internals.bounds;
    for (const fp of m.focusPoints) {
      expect(Math.hypot(fp.pos.x - cx, fp.pos.y - cy) + Math.min(fp.r, 3.8)).toBeLessThan(plateR + 1e-6);
    }
  });

  it('no deep collisions of bodies on the lower Z layers', () => {
    m.setTime(0.5, { beatHz: 2.5, amplitude: 220 });
    m.root.updateMatrixWorld(true);
    const bodies = [];
    m.root.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      // The variants that are not installed stand hidden in the scene and do not coexist
      // in the movement: their balances legitimately occupy the same place.
      if (o.userData.variant && o.userData.variant !== m.escapement.installed) return;
      const t = o.geometry.type;
      if (t !== 'ExtrudeGeometry' && t !== 'TorusGeometry') return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const e = o.matrixWorld.elements;
      const bb = o.geometry.boundingBox;
      bodies.push({ x: e[12], y: e[13], z: e[14], r: o.geometry.boundingSphere.radius, zHalf: (bb.max.z - bb.min.z) / 2 });
    });
    const low = bodies.filter((b) => b.z < 6.5);
    const hits = [];
    for (let i = 0; i < low.length; i++) for (let j = i + 1; j < low.length; j++) {
      const a = low[i], b = low[j];
      const dxy = Math.hypot(a.x - b.x, a.y - b.y);
      if (dxy < 1.0) continue; // coaxial assemblies (crown+bevel, a shared apex) — by design
      const pen = a.r + b.r - dxy;
      const zOv = Math.abs(a.z - b.z) < a.zHalf + b.zHalf;
      if (pen > 1.3 && zOv) hits.push({ pen, za: a.z, zb: b.z });
    }
    expect(hits).toEqual([]);
  });
});
