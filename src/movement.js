import * as THREE from 'three';
import { TRAIN, layoutTrain, buildTrain, arborOuterR } from './train.js';
import { tagModule } from './common.js';
import { buildBarrel } from './barrel.js';
import { layoutMotionWorks, buildMotionWorks } from './motionWorks.js';
import { layoutWinding, buildWinding } from './winding.js';
import { layoutPowerReserve, buildPowerReserve, chargeOf, windRoomAt, autoWindDelta } from './powerReserve.js';
import { buildEscapementSocket } from './escapement/index.js';

/** Radius of the tourbillon cage (checked with a prototype at 170°). The developed section takes it from here. */
export const CAGE_R = 4.3;
const WIND_RATE = 5;      // winding animation speed, rad/s
const WIND_CLICK = Math.PI / 2; // one «click» = a quarter turn of the ratchet (+0.375 of charge)

/**
 * Assembling the movement: layout → scene bounds → module meshes → kinematics.
 *
 * The order matters: first the pure layout geometry (what stands where) — the
 * bounds and the plate radius are computed from it; only then are the meshes built.
 *
 * The modules (each in its own file): `train` — the going train, `barrel` — energy,
 * `motionWorks` — the time display, `winding` — winding, `powerReserve` — the
 * power-reserve differential, `escapement` — the escapement socket (see
 * escapement/index.js).
 */
export function buildMovement({ brass, steel, axleMat, ruby, plateMat, bluedMat, springSteel, backdropMat, cageMat }) {
  backdropMat = backdropMat || plateMat; // compatibility, if none was passed
  cageMat = cageMat || plateMat;
  const root = new THREE.Group();
  const mats = { brass, steel, axleMat, ruby, plateMat, bluedMat, springSteel };

  // ── 1. Layout (no meshes) ─────────────────────────────────────────
  const arbors = layoutTrain();
  const barrelPos = arbors[0].pos;
  const cagePos = arbors[4].pos;            // the cage's centre = the escape arbor's place
  const CAGE_ZBASE = arbors[4].wheelZ;      // the bottom of the cage, above the train
  const mwL = layoutMotionWorks(arbors);
  const windL = layoutWinding(barrelPos);
  const prL = layoutPowerReserve(barrelPos);

  // ── 2. Scene bounds and centring ──────────────────────────────────
  const extents = [
    ...arbors.map((a) => ({ pos: a.pos, r: arborOuterR(a.spec, CAGE_R) })),
    { pos: cagePos, r: CAGE_R }, // the rotating tourbillon cage
    ...mwL.extents, ...windL.extents, ...prL.extents,
  ];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const e of extents) {
    minX = Math.min(minX, e.pos.x - e.r); maxX = Math.max(maxX, e.pos.x + e.r);
    minY = Math.min(minY, e.pos.y - e.r); maxY = Math.max(maxY, e.pos.y + e.r);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  root.position.set(-cx, -cy, 0);
  const size = { w: maxX - minX, h: maxY - minY };

  // ── 3. Module meshes ──────────────────────────────────────────────
  buildTrain(mats, arbors, root);

  const barrel = buildBarrel(mats, { wheelTeeth: TRAIN[0].wheel });
  arbors[0].group.add(barrel.group);

  // The escapement socket: the rotating part is a child of arbor4 (it turns with
  // θ_cage), the fixed part sits separately in root, so it stays put. Every variant
  // is built; exactly one is installed.
  const escapement = buildEscapementSocket(
    mats,
    { escTeeth: TRAIN[4].escapeTeeth, cageMat, cageR: CAGE_R },
    { arbor: arbors[4].group, root, pos: cagePos, zBase: CAGE_ZBASE }
  );

  const motionWorks = buildMotionWorks(mats, mwL, arbors, root);
  const winding = buildWinding(mats, windL, barrelPos);
  root.add(winding.group);
  const powerReserve = buildPowerReserve(
    { ...mats, plateMat }, prL,
    { barrelPos, barrelGroup: arbors[0].group, barrelPhi: arbors[0].phi }
  );
  root.add(powerReserve.group);

  // ── 4. Main plate (back plate) + ruby jewels under the arbors ─────
  const plateMargin = 1.8;
  let plateR = Math.hypot(size.w, size.h) * 0.5 + plateMargin;
  for (const e of extents) {
    plateR = Math.max(plateR, Math.hypot(e.pos.x - cx, e.pos.y - cy) + e.r + plateMargin);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(plateR, plateR, 0.8, 96), backdropMat);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(cx, cy, -3.2);
  plate.receiveShadow = true;
  tagModule(plate, 'plate');
  root.add(plate);
  for (const a of arbors) {
    const jewel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 20), ruby);
    jewel.rotation.x = Math.PI / 2;
    jewel.position.set(a.pos.x, a.pos.y, -2.65);
    tagModule(jewel, 'plate');
    root.add(jewel);
  }

  // ── 5. Wind state (derived) and kinematics ────────────────────────
  // The charge is not stored separately: c(w, β) is computed by the differential from
  // the ratchet angle (w) and the barrel wheel's angle (β). Only the angles live here.
  let windAngle = 0, windPending = 0, lastDrive = 0;

  /** Sync the differential and the spring's shape with the state (w, β). */
  function syncCharge() {
    barrel.setCharge(powerReserve.update(windAngle, lastDrive));
  }

  const winder = {
    group: winding.group,
    ratchet: winding.ratchet,
    click: winding.click,
    get charge() { return Math.min(1, Math.max(0, chargeOf(windAngle, lastDrive))); },
    wind() { windPending += WIND_CLICK; },
    update(dt) {
      if (windPending <= 0) return;
      let d = Math.min(dt * WIND_RATE, windPending);
      // The full-wind stop: the crown stops consuming turns at c = 1.
      const room = windRoomAt(windAngle, lastDrive);
      if (d >= room) { d = room; windPending = 0; } else windPending -= d;
      if (d <= 0) return;
      windAngle += d;
      winding.setAngle(windAngle); // ratchet + click + crown wheel / bevel / crown
      syncCharge();
    },
  };

  /** Kinematics: every arbor's angle comes from the barrel's angle (β). */
  function update(driveAngle) {
    lastDrive = driveAngle;
    for (const a of arbors) a.group.rotation.z = a.phi + a.omega * driveAngle;
    motionWorks.resetHands();
    motionWorks.update(arbors[1].omega * driveAngle, arbors[3].omega * driveAngle);
    syncCharge();
  }
  update(0);

  // The main entry point: time → balance/escapement in the cage → the cage angle
  // θ_cage → the whole train. θ_cage = β (Zf = Zp), and arbor4.group (the cage) turns by phi4 + β.
  function setTime(t, { beatHz, amplitude }) {
    const beta = escapement.update(t, beatHz, amplitude);
    update(beta / arbors[4].omega);
    return beta;
  }

  const clockAngle = (unit) => Math.PI / 2 - unit * Math.PI * 2;

  /**
   * Real-time mode: the escapement and the whole train move from the balance's own
   * beat (as in demo), while the three hands are laid over the top on the clock's
   * true time. `beatT` is the continuous beat phase, kept apart from the clock on
   * the hands.
   */
  function setClockTime(date, beatT, { beatHz, amplitude }) {
    // 1) The escapement (in the cage) drives the train — by exactly the same path as demo.
    const beta = escapement.update(beatT, beatHz, amplitude);
    const nd = beta / arbors[4].omega;
    // Auto-wind: advance the ratchet by just enough to keep the reserve hand still.
    // The crown does not turn while it happens (spinCrown: false) — as in a real calibre.
    if (nd > lastDrive) {
      windAngle += autoWindDelta(nd - lastDrive);
      winding.setAngle(windAngle, { spinCrown: false });
    }
    update(nd);

    // 2) The hands are laid over the true time (the train «slips» beneath them).
    const h = date.getHours() % 12;
    const m = date.getMinutes();
    const s = date.getSeconds();
    const secondUnit = (s + date.getMilliseconds() / 1000) / 60;
    const minuteUnit = (m + secondUnit) / 60;
    const hourUnit = (h + minuteUnit) / 12;
    motionWorks.setHandAngles({
      hour: clockAngle(hourUnit),
      minute: clockAngle(minuteUnit),
      second: clockAngle(secondUnit),
    }, arbors);
    return { secondUnit, minuteUnit, hourUnit };
  }

  // ── Focus points (for the labels and the camera presets) ──────────
  // Every point has a stable `id` (stations and the camera address it by that) and a
  // `nameKey` (what the user reads). For most of them these agree; for the escapement
  // socket they part ways: the id is fixed, while the name follows the installed variant.
  // How to look at a point is said by the point itself. By default the standoff is
  // derived from its radius; where it was tuned by hand, the number stands beside it.
  // `preset: true` — a point the scene chrome offers as a button.
  const view = (r) => ({ back: r * 3.6 + 4, up: r * 0.6 });

  const focusPoints = [
    // The escape arbor gets no label of its own: it IS the escapement socket — the same
    // axis, so two labels would sit on top of each other at one point.
    ...arbors.filter((a) => !a.spec.escapeTeeth)
      .map((a) => {
        const r = arborOuterR(a.spec, CAGE_R);
        return { id: a.nameKey, nameKey: a.nameKey, pos: a.pos, z: a.wheelZ, r, ...view(r) };
      }),
    // The scene chrome (label, camera preset, node toggle) names the SOCKET, not what
    // stands in it: otherwise, after a swap, all three would keep the previous variant's
    // name, because they are built once. The variant's name appears where the variant is
    // actually the subject — on the card and in the section.
    { id: 'escapement', nameKey: 'part.escapement', pos: cagePos, z: CAGE_ZBASE + 1.8, r: CAGE_R,
      back: 15, up: 3, preset: true },
    { id: 'part.hands', nameKey: 'part.hands', pos: mwL.P1, z: 10.0, r: 4.5,
      back: 22, up: 4, preset: true },
    { id: 'part.winding', nameKey: 'part.winding', pos: windL.cwPos, z: 2.0, r: 4.5, ...view(4.5) },
    { id: 'part.click', nameKey: 'part.click', pos: windL.clickPivot, z: windL.windZ, r: 1.4, ...view(1.4) },
    { id: 'part.powerReserve', nameKey: 'part.powerReserve', pos: barrelPos, z: 8.6, r: 3.2,
      back: 13, up: 1, preset: true },
  ];

  // Nodes that free mode shows and hides as a whole. Each one is declared by whoever
  // owns it: the composer no longer re-publishes six internal groups for the sake of
  // one toggle.
  const nodes = [
    { kind: 'flag', labelKey: 'gui.handsAndMotionWorks',
      obj: motionWorks.view, prop: 'visible', onChange: motionWorks.setVisible },
    { kind: 'flag', labelKey: 'part.winding', obj: winder.group, prop: 'visible' },
    { kind: 'flag', labelKey: 'part.powerReserve', obj: powerReserve.group, prop: 'visible' },
  ];

  return {
    root, arbors, update, setTime, setClockTime, escapement, size, focusPoints, winder, nodes,
    /**
     * Internal meshes — for the TESTS only.
     *
     * Named this way on purpose: until now they stood in the interface beside the real
     * members, and any regrouping inside broke tests that supposedly describe
     * behaviour. Here it is visible that this is not interface.
     */
    internals: {
      bounds: { minX, maxX, minY, maxY, cx, cy, plateR },
      motionWorks, powerReserve,
    },
  };
}
