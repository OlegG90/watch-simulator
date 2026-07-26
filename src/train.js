import * as THREE from 'three';
import { makeGear } from './gear.js';
import { M, WHEEL_T, PINION_T, Z_STEP, AXLE_R, pitchR, deg, meshPhase, makeAxle } from './common.js';

/**
 * Колісна передача: кожен вузол (arbor) несе тріб (ведений попереднім колесом)
 * та власне колесо (веде наступний тріб). Барабан має лише колесо (сам барабан
 * із пружиною — у `barrel.js`); останній вузол несе тріб і слугує обертовою
 * кліттю турбійона (анкерне колесо живе в кліті, див. `tourbillon.js`).
 */
export const TRAIN = [
  { name: 'Барабан',           wheel: 48, axleTop: 2.3, crossings: 5 },    // вище — трубки диференціала запасу ходу
  { name: 'Центральне колесо', pinion: 12, wheel: 40, crossings: 4, axleTop: 7.4 }, // вісь до канонного триба
  { name: 'Проміжне колесо',   pinion: 12, wheel: 36, crossings: 4 },
  { name: 'Секундне колесо',   pinion: 12, wheel: 32, crossings: 3, axleTop: 5.15 }, // вісь під секундну стрілку
  { name: 'Анкерний вузол',    pinion: 12, escapeTeeth: 15 },              // = кліть турбійона
];

// Напрям (у площині XY) від осі k до осі k+1 — передачу скручено в тісну петлю
// (компактна компоновка): кожен крок повертає сильніше, тож хвіст майже змикається
// з барабаном. Колеса лежать на різних Z-площинах, тож перекриття по XY безпечне.
// Останній кут (секундне → анкерний вузол) — 170°: там просторо для обертової
// кліті турбійона (перевірено числовим прототипом компоновки).
export const MESH_ANGLES = [0, 78, 150, 170].map(deg);

/** Радіус вузла для меж сцени; анкерний вузол міряється кліттю турбійона. */
export const arborOuterR = (spec, cageR) => (spec.escapeTeeth ? cageR : pitchR(spec.wheel) + M * 1.3);

/**
 * Розстановка осей передачі + кінематика кожного вузла (швидкість і фаза).
 * Меші тут не створюються — лише геометрія розкладки, потрібна для меж сцени.
 */
export function layoutTrain() {
  const arbors = [];
  let pos = new THREE.Vector2(0, 0);
  TRAIN.forEach((spec, k) => {
    let omega = 1; // швидкість відносно барабана (барабан = 1)
    let phi = 0;
    if (k > 0) {
      const prev = arbors[k - 1];
      const ZA = TRAIN[k - 1].wheel;
      const ZB = spec.pinion;
      const theta = MESH_ANGLES[k - 1];
      const d = pitchR(ZA) + pitchR(ZB); // міжосьова відстань по ділильних колах
      pos = prev.pos
        .clone()
        .add(new THREE.Vector2(Math.cos(theta), Math.sin(theta)).multiplyScalar(d));
      omega = -prev.omega * (ZA / ZB); // зовнішнє зчеплення міняє напрям
      phi = meshPhase(theta, ZA, ZB, prev.phi);
    }
    arbors.push({
      name: spec.name,
      spec,
      pos,
      omega,
      phi,
      pinionZ: (k - 1) * Z_STEP, // тріб у площині колеса попереднього вузла
      wheelZ: k * Z_STEP,
    });
  });
  return arbors;
}

/** Меші передачі: тріб + колесо + вісь на кожному вузлі. Заповнює `a.group`. */
export function buildTrain({ brass, steel, axleMat }, arbors, root) {
  arbors.forEach((a, k) => {
    const g = new THREE.Group();
    g.position.set(a.pos.x, a.pos.y, 0);

    if (a.spec.pinion) {
      const p = makeGear(
        { teeth: a.spec.pinion, module: M, thickness: PINION_T, bore: AXLE_R * 0.9 },
        steel
      );
      p.position.z = a.pinionZ;
      g.add(p);
    }
    if (a.spec.wheel) {
      const w = makeGear(
        { teeth: a.spec.wheel, module: M, thickness: WHEEL_T, bore: AXLE_R * 0.9, crossings: a.spec.crossings || 0 },
        brass
      );
      w.position.z = a.wheelZ;
      g.add(w);
    }

    // Вісь: від нижньої до верхньої деталі вузла.
    const zFrom = k === 0 ? -2.6 : a.pinionZ - 1.0;
    const zTo = a.spec.axleTop ?? a.wheelZ + 1.0;
    g.add(makeAxle(
      { r: AXLE_R, len: zTo - zFrom, z: (zFrom + zTo) / 2, segments: 20, castShadow: true },
      axleMat
    ));

    root.add(g);
    a.group = g;
  });
}
