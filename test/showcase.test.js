import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { readFileSync, readdirSync } from 'node:fs';
import { buildShowcase, TEETH, WHEEL_R, FORK_D, BAL_D } from '../src/showcase/leverModel.js';
import {
  wheelAngle, forkAngle, balanceAngle, phaseName, activePallet, stepFrom, pose, stages,
  FORK_MAX, AMPLITUDE,
} from '../src/showcase/motion.js';
import {
  PITCH, LEVER_HALF, LEVER_UNLOCK, DRAW, LIFT, LIFT_MEASURED, action, poseAt, report,
  stonePoly, toothPoly, toe, toWorld,
} from '../src/showcase/design.js';
import { buildSpring, SPRING_N, SPRING_R0, SPRING_R1 } from '../src/showcase/spring.js';

const noNaN = (root) => {
  let ok = true;
  root.traverse((o) => {
    if (o.isMesh) {
      const a = o.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) ok = false;
    }
  });
  return ok;
};

/** Is a point inside a polygon, and how far from its boundary? The contact check leans on
 *  these two and on nothing from `design.js`, so it can disagree with the construction. */
const insidePoly = (pt, poly) => {
  let hit = false;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const [xi, yi] = poly[i], [xk, yk] = poly[k];
    if ((yi > pt[1]) !== (yk > pt[1]) && pt[0] < ((xk - xi) * (pt[1] - yi)) / (yk - yi) + xi) hit = !hit;
  }
  return hit;
};
const distToPoly = (pt, poly) => {
  let best = Infinity;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const a = poly[k], b = poly[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(pt[0] - (a[0] + dx * t), pt[1] - (a[1] + dy * t)));
  }
  return best;
};

const byPallet = (m, face) => {
  const found = [];
  m.group.traverse((o) => { if (o.userData.pallet?.face === face) found.push(o); });
  return found;
};

describe('lever escapement showcase (geometry)', () => {
  it('wheel: 15 club teeth, tips at the given radius', () => {
    const m = buildShowcase();
    let wheel = null;
    m.group.traverse((o) => { if (o.userData.club) wheel = o; });
    expect(wheel).not.toBeNull();
    expect(wheel.userData.club.teeth).toBe(TEETH);
    const pos = wheel.geometry.attributes.position;
    let maxR = 0;
    for (let i = 0; i < pos.count; i++) maxR = Math.max(maxR, Math.hypot(pos.getX(i), pos.getY(i)));
    expect(maxR).toBeCloseTo(WHEEL_R, 6);
    expect(noNaN(m.group)).toBe(true);
  });

  it('axes on the line of centres: the fork at FORK_D, the balance a further BAL_D away', () => {
    const m = buildShowcase();
    expect(m.forkPivot.position.x).toBeCloseTo(FORK_D, 12);
    expect(m.forkPivot.position.y).toBeCloseTo(0, 12);
    expect(m.balancePivot.position.x).toBeCloseTo(FORK_D + BAL_D, 12);
    expect(m.balancePivot.position.y).toBeCloseTo(0, 12);
  });

  it('the tooth stays on the acting stone through the whole engagement', () => {
    // The pallets are traced from the action, so contact through it is true by
    // construction. This test does not trust the construction: it walks the beat and
    // measures, with a point-to-polygon distance that knows nothing about how the
    // outline was arrived at.
    for (const face of ['entry', 'exit']) {
      const stone = stonePoly(face);
      for (let i = 0; i <= 200; i++) {
        const u = i / 200;
        const { lever, wheel, phase } = poseAt(face, u);
        if (phase === 'drop') continue;             // through the drop nothing is touching
        const world = stone.map((q) => toWorld(q, lever));
        const gap = distToPoly(toe(wheel), world);
        // A hundredth of a millimetre at this scale. The face is a traced polyline, so the
        // only gap that should exist is the sag of its chords: measured at 1e-5, and a
        // tolerance a thousand times looser than the thing it guards guards nothing.
        expect(gap, `${face} at u=${u.toFixed(3)} (${phase})`).toBeLessThan(1e-4);
      }
    }
  });

  it('no tooth ever enters a stone', () => {
    // The other half of the same claim, and the one that would catch a face drawn where
    // the tooth cannot go: not a vertex of any tooth may be inside the stone's outline.
    for (const face of ['entry', 'exit']) {
      const stone = stonePoly(face);
      let deepest = 0;
      for (let i = 0; i <= 200; i++) {
        const { lever, wheel } = poseAt(face, i / 200);
        const world = stone.map((q) => toWorld(q, lever));
        for (let k = -4; k <= 4; k++)
          for (const v of toothPoly(k, wheel))
            if (insidePoly(v, world)) deepest = Math.max(deepest, distToPoly(v, world));
      }
      expect(deepest, `${face}: a tooth is inside the stone`).toBeLessThan(1e-3);
    }
  });

  it('the lock has depth, and it costs the lever the travel it was given', () => {
    for (const face of ['entry', 'exit']) {
      const a = action(face);
      expect(a.uUnlock, face).toBeCloseTo(LEVER_UNLOCK / (2 * LEVER_HALF), 12);
      // While the lock is pushed off the wheel GIVES BACK: that is the draw, and a lock
      // that let the wheel forward instead would not be holding anything.
      expect(a.wheel(a.uUnlock), face).toBeLessThan(a.wheel(0));
    }
  });

  it('the draw on the entry stone is the angle it was asked for', () => {
    // The face is traced, so its angle is a measurement of the result. The entry stone is
    // held to the figure; the exit stone's comes out steeper on its own, and that is
    // recorded in design.js rather than forced.
    expect(Math.abs(report().entry.draw)).toBeCloseTo(DRAW, 4);
    expect(Math.abs(report().exit.draw)).toBeGreaterThan(DRAW);
  });

  it('the traced faces are nearly straight — real pallets are a fair approximation', () => {
    for (const face of ['entry', 'exit']) {
      const m = report()[face];
      expect(m.lockBend, `${face} lock`).toBeLessThan(0.002);
      expect(m.impBend, `${face} impulse`).toBeLessThan(0.02);
    }
  });

  it('the stones in the scene are the outlines the design traced', () => {
    // One source: the mesh is extruded from stonePoly(), so a stone drawn anywhere else
    // would be a picture of an escapement the contact solution knows nothing about.
    const m = buildShowcase();
    for (const face of ['entry', 'exit']) {
      const [stone] = byPallet(m, face);
      expect(stone, face).toBeTruthy();
      const want = stonePoly(face);
      const pos = stone.geometry.attributes.position;
      let worst = Infinity;
      for (const [x, y] of want) {
        let best = Infinity;
        for (let i = 0; i < pos.count; i++)
          best = Math.min(best, Math.hypot(pos.getX(i) - x, pos.getY(i) - y));
        worst = Math.min(worst, -best);
      }
      expect(-worst, `${face}: the mesh does not follow the traced outline`).toBeLessThan(1e-6);
    }
  });

  it('the showcase does not import the movement: isolation by decision', () => {
    // Self-containment is not an agreement but a structure: not one import from the
    // movement, the socket or the lesson layer anywhere in the showcase/ folder.
    const dir = new URL('../src/showcase/', import.meta.url);
    for (const f of readdirSync(dir)) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      for (const mod of ['movement', 'escapement', 'lesson', 'settings', 'motionWorks']) {
        expect(src, `${f} pulls in ${mod}`).not.toMatch(new RegExp(`from\\s+['"][^'"]*${mod}`));
      }
    }
  });
});

describe('showcase motion (the escapement running)', () => {
  it('a beat advances the wheel half a pitch — a result, not a setting', () => {
    // Nowhere is this written down. It falls out of the pallets standing two and a half
    // teeth apart, and it is the one number that says the exhibit is an escapement.
    for (let n = 0; n < 4; n++)
      expect(wheelAngle(n + 1.5) - wheelAngle(n + 0.5), `beat ${n}`).toBeCloseTo(PITCH / 2, 9);
  });

  it('a beat runs lock → unlock → impulse → drop, once each', () => {
    const seen = [];
    for (let i = 0; i <= 4000; i++) {
      const ph = phaseName(-0.5 + i / 4000);
      if (!seen.length || seen[seen.length - 1] !== ph) seen.push(ph);
    }
    expect(seen).toEqual(['lock', 'unlock', 'impulse', 'drop', 'lock']);
  });

  it('the lever lies on a banking through the lock and crosses once a beat', () => {
    expect(Math.abs(forkAngle(0.5))).toBeCloseTo(FORK_MAX, 9);
    expect(Math.abs(forkAngle(1.5))).toBeCloseTo(FORK_MAX, 9);
    expect(Math.sign(forkAngle(0.5))).toBe(-Math.sign(forkAngle(1.5)));
    expect(Math.abs(forkAngle(1))).toBeLessThan(FORK_MAX); // crossing, mid-travel
  });

  it('the balance is at zero when the escaping happens', () => {
    expect(balanceAngle(0)).toBeCloseTo(0, 12);
    expect(balanceAngle(1)).toBeCloseTo(0, 12);
    expect(Math.abs(balanceAngle(0.5))).toBeCloseTo(AMPLITUDE, 12);
  });

  it('the escapement takes the lift it was designed for', () => {
    // The pin's orbit is solved from the lift rather than guessed at: a closed form in the
    // small-angle limit was out by a seventh, so the engagement is measured instead.
    expect(LIFT_MEASURED).toBeCloseTo(LIFT, 2);
  });

  it('one stone is unlocked and impulsed; the other takes the drop', () => {
    // The same stone carries the tooth from the unlocking through the impulse. The
    // handover is the drop: from there the name is the stone that has caught it.
    let u = 0.6;
    const seen = [];
    for (let i = 0; i < 4; i++) { u = stepFrom(u); seen.push(`${phaseName(u)}:${activePallet(u)}`); }
    expect(seen).toEqual(['unlock:exit', 'impulse:exit', 'drop:exit', 'lock:entry']);
  });

  it('the lock is held in turn, beat by beat', () => {
    // Between beats the stone being named is the one HOLDING — which is the stone the next
    // beat will escape on, because it caught the tooth at the last drop.
    expect(activePallet(0.5)).toBe('exit');
    expect(activePallet(1.5)).toBe('entry');
    expect(activePallet(2.5)).toBe('exit');
  });

  it('the pose is a pure function of time: the same instant twice, the same scene', () => {
    const m = buildShowcase();
    m.update(1.02);
    const first = [m.wheelPivot.rotation.z, m.forkPivot.rotation.z, m.balancePivot.rotation.z];
    m.update(7.4);
    m.update(1.02);
    expect([m.wheelPivot.rotation.z, m.forkPivot.rotation.z, m.balancePivot.rotation.z]).toEqual(first);
  });

  it('update sets poses free of NaN at the locks and mid-unlocking', () => {
    const m = buildShowcase();
    for (const u of [0.5, 0.9, 1.0, 1.1, 1.5, 3.25]) {
      m.update(u);
      for (const p of [m.wheelPivot, m.forkPivot, m.balancePivot])
        expect(Number.isFinite(p.rotation.z), `u=${u}`).toBe(true);
    }
    expect(noNaN(m.group)).toBe(true);
  });
});

describe('showcase hairspring (breathing)', () => {
  const springMat = () => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });

  it('the outer end stays in the stud, the inner one travels with the balance', () => {
    const s = buildSpring({ cx: 0, cy: 0, z: 0, material: springMat() });
    const railMid = (i) => {
      const p = s.mesh.geometry.attributes.position.array;
      return [(p[i * 6] + p[i * 6 + 3]) / 2, (p[i * 6 + 1] + p[i * 6 + 4]) / 2];
    };
    s.update(0);
    const outer0 = railMid(SPRING_N - 1), inner0 = railMid(0);
    expect(Math.hypot(...outer0)).toBeCloseTo(SPRING_R1, 6);
    expect(Math.hypot(...inner0)).toBeCloseTo(SPRING_R0, 6);
    s.update(1.0);
    const outer1 = railMid(SPRING_N - 1), inner1 = railMid(0);
    expect(Math.hypot(outer1[0] - outer0[0], outer1[1] - outer0[1])).toBeCloseTo(0, 9);
    const a0 = Math.atan2(inner0[1], inner0[0]);
    const a1 = Math.atan2(inner1[1], inner1[0]);
    expect(a1 - a0).toBeCloseTo(1.0, 6);
  });

  it('the same buffer between frames: no allocations, no NaN', () => {
    const s = buildSpring({ cx: 0, cy: 0, z: 0, material: springMat() });
    const pos = s.mesh.geometry.attributes.position;
    const buf = pos.array;
    s.update(0.37);
    s.update(1.61);
    expect(pos.array).toBe(buf);
    for (let i = 0; i < buf.length; i++) expect(Number.isFinite(buf[i])).toBe(true);
  });
  it('a press of Step lands in the middle of a stage, and four presses visit all four', () => {
    // The old step was a constant ⅛ of a beat while the impulse is ~0.054 beat wide, so
    // stepping jumped over the stage the exhibit exists to show. The step is now derived
    // from the phase machine itself: there is no step constant left to drift.
    for (let s = 0; s < 40; s++) {
      const start = 2 + s / 40;
      let u = start;
      const seen = [];
      for (let i = 0; i < 4; i++) { u = stepFrom(u); seen.push(phaseName(u)); }
      expect(new Set(seen), `from u = ${start}: ${seen.join(' → ')}`)
        .toEqual(new Set(['lock', 'unlock', 'impulse', 'drop']));
    }
  });

  it('every landing sits clear of its stage boundaries', () => {
    // The middle is the point of the design: a landing that only just clears a boundary
    // would show the caption of one stage over the pose of the next.
    //
    // The pallet is checked with the phase, and that is not belt and braces: the pallets
    // change hands at the drop, and the impulse's landing is at the beat itself, which is
    // exactly where the old rounding handed over. A step that lands on a discontinuity
    // shows a caption that disagrees with the frame before and the frame after it.
    // The tolerance is a fraction of the SHORTEST stage, because the stages are of very
    // different lengths now that they are solved rather than cut into thirds.
    let u = 2.13;
    for (let i = 0; i < 12; i++) {
      u = stepFrom(u);
      const here = `${phaseName(u)} · ${activePallet(u)}`;
      const at = (d) => `${phaseName(u + d)} · ${activePallet(u + d)}`;
      expect(at(-0.002), `before ${here}`).toBe(here);
      expect(at(+0.002), `after ${here}`).toBe(here);
    }
  });

  it('stepping always moves forward, and a beat takes exactly four presses', () => {
    // Counted from a landing, not from an arbitrary instant: four presses is a beat only
    // between the same stage's middles.
    const start = 2 + stages()[0].at - 0.5;
    let u = start;
    for (let i = 0; i < 4; i++) {
      const next = stepFrom(u);
      expect(next, `press ${i + 1}`).toBeGreaterThan(u);
      u = next;
    }
    expect(u - start).toBeCloseTo(1, 9);
  });

  it('every landing is the middle of the stage the panel will name', () => {
    // What the caption says and where the step stops come from one list: the stages are
    // found by walking the beat, and both the panel and the step read that.
    const marks = stages();
    let u = 4.2;
    for (let i = 0; i < 8; i++) {
      u = stepFrom(u);
      const want = marks.find((m) => Math.abs(((u + 0.5) % 1) - m.at) < 1e-6);
      expect(want, `no stage has its middle at ${u.toFixed(4)}`).toBeTruthy();
      expect(phaseName(u)).toBe(want.phase);
    }
  });
});
