import * as THREE from 'three';

/**
 * Параметрична шестерня (спрощені трапецієподібні зубці).
 *
 * @param {object} o
 * @param {number} o.teeth      кількість зубців
 * @param {number} o.module     модуль (крок зубців); ділильний радіус = module * teeth / 2
 * @param {number} o.thickness  товщина колеса (вздовж осі Z)
 * @param {number} o.bore       радіус центрального отвору
 * @param {number} [o.addendum] висота зубця над ділильним колом (× module)
 * @param {number} [o.dedendum] глибина западини під ділильним колом (× module)
 * @returns {THREE.Shape}       контур для ExtrudeGeometry
 */
export function gearShape({
  teeth,
  module,
  bore,
  addendum = 1.0,
  dedendum = 1.25,
  crossings = 0, // кількість вікон між маточиною і ободом (спиці)
}) {
  const pitchR = (module * teeth) / 2;
  const outerR = pitchR + module * addendum;
  const rootR = pitchR - module * dedendum;

  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  // Частка кроку, яку займає вершина зубця (решта — западина + скоси).
  const topFrac = 0.38;
  const botFrac = 0.62;

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const aRootStart = a0;
    const aFlankUp = a0 + step * (1 - botFrac) * 0.5;
    const aTopStart = a0 + step * (1 - topFrac) * 0.5;
    const aTopEnd = a0 + step * (1 + topFrac) * 0.5;
    const aFlankDown = a0 + step * (1 + botFrac) * 0.5;

    const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

    if (i === 0) shape.moveTo(...p(rootR, aRootStart));
    else shape.lineTo(...p(rootR, aRootStart));
    shape.lineTo(...p(rootR, aFlankUp));
    shape.lineTo(...p(outerR, aTopStart));
    shape.lineTo(...p(outerR, aTopEnd));
    shape.lineTo(...p(rootR, aFlankDown));
    shape.lineTo(...p(rootR, a0 + step));
  }
  shape.closePath();

  // Центральний отвір.
  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  // Вікна між маточиною і ободом → спиці, як у справжніх коліс.
  if (crossings > 0) {
    const hubR = bore + module * 1.6;
    const rimR = rootR - module * 2.0;
    if (rimR > hubR + module) {
      const spokeW = module * 1.5; // ширина спиці
      const aSp = spokeW / ((hubR + rimR) / 2);
      const seg = (Math.PI * 2) / crossings;
      for (let i = 0; i < crossings; i++) {
        const a1 = i * seg + aSp / 2;
        const a2 = (i + 1) * seg - aSp / 2;
        const w = new THREE.Path();
        w.absarc(0, 0, hubR, a1, a2, false);
        w.lineTo(Math.cos(a2) * rimR, Math.sin(a2) * rimR);
        w.absarc(0, 0, rimR, a2, a1, true);
        w.closePath();
        shape.holes.push(w);
      }
    }
  }

  return shape;
}

/**
 * Анкерне колесо: гострі храпові зубці (стрімка запірна грань + похила спинка).
 * @returns {THREE.Mesh} з мета-даними у mesh.userData.escape
 */
export function makeEscapeWheel({ teeth, outerR, rootR, thickness, bore, crossings = 4 }, material) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    if (i === 0) shape.moveTo(...p(outerR, a0));
    else shape.lineTo(...p(outerR, a0)); // вістря (завершує похилу спинку попереднього зубця)
    shape.lineTo(...p(rootR, a0 + 0.14 * step)); // запірна грань — стрімка
    shape.lineTo(...p(rootR * 0.96, a0 + 0.42 * step)); // легка западина
    shape.lineTo(...p(rootR, a0 + 0.72 * step)); // початок похилої спинки
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  // Вікна-спиці.
  if (crossings > 0) {
    const hubR = bore + 0.55;
    const rimR = rootR - 0.75;
    const aSp = 0.5 / ((hubR + rimR) / 2);
    const seg = (Math.PI * 2) / crossings;
    for (let i = 0; i < crossings; i++) {
      const a1 = i * seg + aSp / 2;
      const a2 = (i + 1) * seg - aSp / 2;
      const w = new THREE.Path();
      w.absarc(0, 0, hubR, a1, a2, false);
      w.lineTo(Math.cos(a2) * rimR, Math.sin(a2) * rimR);
      w.absarc(0, 0, rimR, a2, a1, true);
      w.closePath();
      shape.holes.push(w);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.escape = { teeth, outerR, step };
  return mesh;
}

/**
 * Стрілка: видовжений клин з хвостом-противагою, вістрям уздовж +X.
 */
export function makeHand({ length, tail = 0.25, width = 0.55, thickness = 0.14 }, material) {
  const T = length * tail;
  const shape = new THREE.Shape();
  shape.moveTo(-T, -width * 0.5);
  shape.lineTo(length * 0.88, -width * 0.14);
  shape.lineTo(length, 0);
  shape.lineTo(length * 0.88, width * 0.14);
  shape.lineTo(-T, width * 0.5);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Готовий Mesh шестерні.
 * @param {object} o          параметри gearShape + thickness
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}      з мета-даними у mesh.userData.gear
 */
export function makeGear(o, material) {
  const shape = gearShape(o);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: o.thickness,
    bevelEnabled: true,
    bevelThickness: o.module * 0.1,
    bevelSize: o.module * 0.1,
    bevelSegments: 1,
    curveSegments: 12,
  });
  geo.translate(0, 0, -o.thickness / 2);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.gear = {
    teeth: o.teeth,
    pitchR: (o.module * o.teeth) / 2,
  };
  return mesh;
}
