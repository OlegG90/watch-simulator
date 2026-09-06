import * as THREE from 'three';
import { makeGear, makeBevelGear } from './gear.js';
import { deg, dir2, meshPhase, makeAxle, makeHandAssembly, tagModule } from './common.js';

// ── Коаксіальний конічний диференціал над барабаном ───────────────
// Обидва входи вже на осі барабана: храповик (w) веде верхнє сонце прямою
// трубкою (RA = 1), барабанне колесо (β) — нижнє через маточинне колесо (32)
// → компаунд-проміжне (8/20) → колесо трубки нижнього сонця (20), RB = 4.
// Міжосьова однакова для обох пар: (32+8)·m/2 = (20+20)·m/2 = 6.0.
export const PRT_M = 0.3;
export const PRT_HUB = 32;
export const PRT_P = 8;
export const PRT_W = 20;
export const PRT_G = 20;
export const RA = 1;                                   // храповик → верхнє сонце
export const RB = (PRT_HUB / PRT_P) * (PRT_W / PRT_G); // барабан → нижнє сонце = 4
const PRT_ANGLE = deg(160);                            // напрям компаунд-проміжного від барабана

export const PR_EMPTY = deg(150);            // «порожньо»
export const PR_FULL = deg(30);              // повний завод
export const SWEEP = PR_EMPTY - PR_FULL;     // 120°
const C0 = 0.75;                             // початковий заряд

const DIFF_M = 0.28;              // модуль конічних коліс диференціала
const SUN_T = 16, PLANET_T = 10;  // δ_сонця = atan(16/10) ≈ 58°, δ_планети ≈ 32°
const DELTA_SUN = Math.atan(SUN_T / PLANET_T);
const DELTA_PL = Math.atan(PLANET_T / SUN_T);
const Z_DIFF = 5.8;               // спільний апекс сонць/планет
/** Z-рівні модуля — спільні з розрізом збоку. */
export const LAYERS = { hubWheel: 1.85, idlerWheel: 3.3, suns: Z_DIFF, arm: Z_DIFF + 2.15, dial: Z_DIFF + 2.75, hand: Z_DIFF + 3.05 };

/** Заряд — ПОХІДНИЙ від двох входів диференціала, а не окрема змінна стану. */
export const chargeOf = (w, beta) => C0 + (RA * w - RB * beta) / (2 * SWEEP);

/** Скільки ще можна докрутити храповик до упору повного заводу (c = 1). */
export const windRoomAt = (w, beta) => Math.max(0, ((1 - chargeOf(w, beta)) * 2 * SWEEP) / RA);

/** Автопідзавід: докрут храповика, за якого водило (стрілка) стоїть: dθ_C = 0. */
export const autoWindDelta = (dBeta) => (RB / RA) * dBeta;

/** Розкладка вузла (позиції + внесок у межі сцени). */
export function layoutPowerReserve(barrelPos) {
  const idlerPos = barrelPos.clone()
    .add(dir2(PRT_ANGLE).multiplyScalar(((PRT_HUB + PRT_P) / 2) * PRT_M));
  return {
    idlerPos,
    extents: [{ pos: idlerPos, r: ((PRT_W * PRT_M) / 2) + PRT_M * 1.3 }],
  };
}

/**
 * Меші індикатора запасу ходу. Класика диференціала: S_up + S_low = 2·водило,
 * тож водило-стрілка показує різницю між заведенням і витратою.
 *
 * Маточинне колесо (вхід ходу) кріпиться до вузла барабана; решта — на власній
 * групі, коаксіальній з барабаном.
 */
export function buildPowerReserve({ brass, steel, axleMat, ruby, plateMat, bluedMat }, L,
  { barrelPos, barrelGroup, barrelPhi }) {
  const { idlerPos } = L;
  const group = new THREE.Group();
  group.position.set(barrelPos.x, barrelPos.y, 0);

  // ── Маточинне колесо (вхід ходу, β) — на трубці барабанного колеса ──
  const hubParts = [];
  {
    const hubWheel = makeGear({ teeth: PRT_HUB, module: PRT_M, thickness: 0.5, bore: 0.62, crossings: 4 }, brass);
    hubWheel.position.z = 1.85;
    barrelGroup.add(hubWheel);
    const hubPipe = makeAxle({ r: 0.42, len: 1.3, z: 1.05 }, brass);
    barrelGroup.add(hubPipe);
    hubParts.push(hubWheel, hubPipe);
  }

  // ── Компаунд-проміжне: тріб (8, площина маточинного) + колесо (20) ──
  const idlerG = new THREE.Group();
  idlerG.position.set(idlerPos.x - barrelPos.x, idlerPos.y - barrelPos.y, 0);
  {
    const p = makeGear({ teeth: PRT_P, module: PRT_M, thickness: 0.5, bore: 0.14 }, steel);
    p.position.z = 1.85;
    idlerG.add(p);
    const w = makeGear({ teeth: PRT_W, module: PRT_M, thickness: 0.5, bore: 0.14, crossings: 3 }, steel);
    w.position.z = 3.3;
    idlerG.add(w);
    idlerG.add(makeAxle({ r: 0.13, len: 3.1, z: 2.45, segments: 10 }, axleMat));
  }
  group.add(idlerG);

  // ── Нижнє сонце + колесо його трубки (вхід ходу ×4) ──
  const sunLow = new THREE.Group();
  {
    const sun = makeBevelGear(
      { teeth: SUN_T, module: DIFF_M, thickness: 0.4, bore: 0.72, pitchAngleDeg: (DELTA_SUN * 180) / Math.PI },
      steel
    );
    sun.position.z = Z_DIFF;
    sun.rotation.x = Math.PI; // перевернуте: вінець знизу, зубці до планет
    sunLow.add(sun);
    const g = makeGear({ teeth: PRT_G, module: PRT_M, thickness: 0.5, bore: 0.72, crossings: 3 }, steel);
    g.position.z = 3.3;
    sunLow.add(g);
    sunLow.add(makeAxle({ r: 0.68, len: 1.6, z: 4.2, segments: 14 }, steel));
  }
  group.add(sunLow);

  // ── Верхнє сонце — на трубці від храповика (вхід заведення, RA = 1) ──
  const sunUp = new THREE.Group();
  {
    const sun = makeBevelGear(
      { teeth: SUN_T, module: DIFF_M, thickness: 0.4, bore: 0.5, pitchAngleDeg: (DELTA_SUN * 180) / Math.PI },
      steel
    );
    sun.position.z = Z_DIFF; // апекс у центрі, вінець зверху
    sunUp.add(sun);
    sunUp.add(makeAxle({ r: 0.45, len: 3.3, z: 4.55 }, steel)); // від храповика до сонця
  }
  group.add(sunUp);

  // ── Водило-«клітка»: кільце навколо сонць, планети на внутрішніх цапфах,
  //    місток над верхнім сонцем і стрілка ──
  const carrier = new THREE.Group();
  const planets = [];
  {
    const cage = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.12, 10, 48), axleMat);
    cage.position.z = Z_DIFF;
    carrier.add(cage);
    for (const s of [+1, -1]) {
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.75, 10), axleMat);
      stub.rotation.z = Math.PI / 2;
      stub.position.set(s * 1.97, 0, Z_DIFF);
      carrier.add(stub);
      const pg = new THREE.Group();
      pg.position.z = Z_DIFF;
      pg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(s, 0, 0));
      const planet = makeBevelGear(
        { teeth: PLANET_T, module: DIFF_M, thickness: 0.38, bore: 0.4, pitchAngleDeg: (DELTA_PL * 180) / Math.PI },
        brass
      );
      planet.userData.dir = s;
      pg.add(planet);
      planets.push(planet);
      carrier.add(pg);
      carrier.add(makeAxle({ r: 0.12, len: 2.15, x: s * 3.35, z: Z_DIFF + 1.08, segments: 10 }, axleMat));
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.24, 0.12), axleMat);
    arm.position.z = Z_DIFF + 2.15; // місток над верхнім сонцем
    carrier.add(arm);
    carrier.add(makeAxle({ r: 0.25, len: 0.9, z: Z_DIFF + 2.6 }, axleMat));
    carrier.add(makeHandAssembly(
      { length: 2.5, width: 0.32, tail: 0.3, hubR: 0.28, hubH: 0.22, z: Z_DIFF + 3.05, segments: 14 },
      bluedMat
    ));
  }
  group.add(carrier);

  // ── Шкала-сектор над барабаном (не повне кільце — диференціал під нею видно) ──
  {
    const pad = deg(8); // поля сектора за межами ходу стрілки
    const fan = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 3.05, 48, 1, PR_FULL - pad, SWEEP + 2 * pad), plateMat
    );
    fan.position.z = Z_DIFF + 2.75;
    group.add(fan);
    const hubRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.7, 32), plateMat);
    hubRing.position.z = Z_DIFF + 2.75;
    group.add(hubRing);
    const arc = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.85, 48, 1, PR_FULL, SWEEP), brass);
    arc.position.z = Z_DIFF + 2.77;
    group.add(arc);
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const a = PR_EMPTY - SWEEP * f;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.06), f === 0 ? ruby : steel);
      tick.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, Z_DIFF + 2.81);
      tick.rotation.z = a;
      group.add(tick);
    }
  }

  // ── Фазування пар входу ходу ──
  const thHI = Math.atan2(idlerPos.y - barrelPos.y, idlerPos.x - barrelPos.x);
  const phiP8 = meshPhase(thHI, PRT_HUB, PRT_P, barrelPhi);        // маточинне (β) → тріб компаунда
  const phiG20 = meshPhase(thHI + Math.PI, PRT_W, PRT_G, phiP8);   // колесо компаунда → трубка сонця
  // Стала водила обрана так, щоб початковий заряд дорівнював C0 (стрілка на 60°).
  const KC = (PR_EMPTY - C0 * SWEEP) - phiG20 / 2;

  /**
   * Поза диференціала від двох входів; повертає заряд, обрізаний до [0,1].
   * @param w    кут храповика (заведення)
   * @param beta кут барабанного колеса (хід)
   */
  function update(w, beta) {
    // Знак «−»: вісь заведення контр-обертається відносно ходу барабанного колеса.
    sunUp.rotation.z = -w;
    idlerG.rotation.z = phiP8 - (PRT_HUB / PRT_P) * beta;
    sunLow.rotation.z = phiG20 + RB * beta;
    carrier.rotation.z = (sunUp.rotation.z + sunLow.rotation.z) / 2 + KC; // умова диференціала
    const spin = ((sunUp.rotation.z - sunLow.rotation.z) / 2) * (SUN_T / PLANET_T);
    for (const p of planets) p.rotation.z = spin * p.userData.dir;
    return Math.min(1, Math.max(0, chargeOf(w, beta)));
  }

  for (const o of [group, ...hubParts]) tagModule(o, 'powerReserve');

  return {
    group, carrier, hand: carrier, sunUp, sunLow, idler: idlerG,
    emptyAngle: PR_EMPTY, fullAngle: PR_FULL, update,
  };
}
