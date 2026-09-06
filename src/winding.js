import * as THREE from 'three';
import { makeGear, makeBevelGear } from './gear.js';
import { AXLE_R, deg, dir2, mod, meshPhase, makeAxle, tagModule } from './common.js';

// ── Заведення: головка → вал → конічна пара → коронне колесо → храповик ──
export const RATCHET_T = 28;
export const CROWN_T = 18;   // храповик на осі барабана / коронне колесо
export const BEVEL_W = 16;
export const BEVEL_P = 8;      // конічна пара 90°, 2:1
export const RATCH_M = 0.33;                 // модуль пари храповик ↔ коронне
export const CW_ANGLE = deg(225);            // напрям вузла заведення від барабана
const WIND_Z = 2.6;                          // палуба заведення (над маточинним колесом диференціала)
const CLICK_LIFT = 0.07;                     // підйом собачки на зубці, рад

// Кути ділильних конусів доповнюють один одного: δ_w + δ_p = 90°, tan δ_w = Zw/Zp.
const DELTA_W = Math.atan(BEVEL_W / BEVEL_P); // ≈63.4° — конічне колесо
const DELTA_P = Math.atan(BEVEL_P / BEVEL_W); // ≈26.6° — триб на валу

/** Розкладка вузла заведення (позиції + внесок у межі сцени). */
export function layoutWinding(barrelPos) {
  const cwPos = barrelPos.clone().add(dir2(CW_ANGLE).multiplyScalar(((RATCHET_T + CROWN_T) / 2) * RATCH_M));
  const bevelPinionPos = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(2.64)); // центр вінця конічного триба
  const crownPos = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(5.6));        // головка на периферії
  const clickPivot = barrelPos.clone().add(dir2(deg(120)).multiplyScalar(6.0));
  return {
    cwPos, bevelPinionPos, crownPos, clickPivot,
    windZ: WIND_Z,
    extents: [
      { pos: cwPos, r: 3.4 },          // коронне + конічне колесо
      { pos: bevelPinionPos, r: 1.3 }, // конічний триб на валу
      { pos: crownPos, r: 1.5 },       // заводна головка
    ],
  };
}

/**
 * Меші заведення. Конічна пара 90° як у реальному калібрі: вершини обох ділильних
 * конусів сходяться в одній точці на перетині осей (Z_APEX), тому конуси дотикаються
 * вздовж спільної твірної, а не краями.
 *
 * Собачка (клік) — «зворотний клапан» заводу: пропускає обертання в бік заведення
 * (перескакуючи по зубцях) і блокує зворотне розкручування пружини через заводний
 * ланцюг, тож енергія пружини має єдиний вихід — у передачу.
 */
export function buildWinding({ steel, axleMat }, L, barrelPos) {
  const { cwPos, crownPos, clickPivot } = L;
  const group = new THREE.Group();
  const Z_APEX = WIND_Z + 0.35; // спільна вершина конусів
  const stepBP = (2 * Math.PI) / BEVEL_P;
  const stepR = (2 * Math.PI) / RATCHET_T;

  // ── Храповик на осі барабана (тримається собачкою) ──
  const ratchetG = new THREE.Group();
  ratchetG.position.set(barrelPos.x, barrelPos.y, 0);
  const ratchet = makeGear(
    { teeth: RATCHET_T, module: RATCH_M, thickness: 0.5, bore: AXLE_R * 0.9, crossings: 4 }, steel
  );
  ratchet.position.z = WIND_Z;
  ratchetG.add(ratchet);
  group.add(ratchetG);

  // ── Коронний вузол: плоске коронне колесо + конічне колесо коаксіально зверху ──
  const cwG = new THREE.Group();
  cwG.position.set(cwPos.x, cwPos.y, 0);
  const crownWheel = makeGear({ teeth: CROWN_T, module: RATCH_M, thickness: 0.5, bore: 0.2 }, steel);
  crownWheel.position.z = WIND_Z;
  cwG.add(crownWheel);
  const phiCW = meshPhase(CW_ANGLE, RATCHET_T, CROWN_T, 0);
  const bevelWheel = makeBevelGear(
    { teeth: BEVEL_W, module: RATCH_M, thickness: 0.45, bore: 0.2, pitchAngleDeg: (DELTA_W * 180) / Math.PI },
    steel
  );
  bevelWheel.position.z = Z_APEX;
  bevelWheel.rotation.z = mod(CW_ANGLE - phiCW, (2 * Math.PI) / BEVEL_W); // западина — проти лінії контакту
  cwG.add(bevelWheel);
  cwG.add(makeAxle({ r: 0.18, len: 3.0, z: WIND_Z + 0.5 }, axleMat));
  cwG.rotation.z = phiCW;
  group.add(cwG);

  // ── Собачка: важіль на стійці, кінчик лежить на зубцях храповика ──
  const clickG = new THREE.Group();
  clickG.position.set(clickPivot.x, clickPivot.y, WIND_Z);
  {
    clickG.add(makeAxle({ r: 0.18, len: 1.4, z: -0.4 }, axleMat));
    const tip = barrelPos.clone().add(dir2(deg(104)).multiplyScalar(4.45));
    const d = tip.clone().sub(clickPivot);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(d.length(), 0.32, 0.3), steel);
    bar.position.set(d.x / 2, d.y / 2, 0);
    bar.rotation.z = Math.atan2(d.y, d.x);
    bar.castShadow = true;
    clickG.add(bar);
  }
  group.add(clickG);

  // ── Конічний триб на валу: вершина конуса — у тій самій точці Z_APEX ──
  const pinionG = new THREE.Group();
  pinionG.position.set(cwPos.x, cwPos.y, Z_APEX);
  pinionG.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(Math.cos(CW_ANGLE), Math.sin(CW_ANGLE), 0)
  );
  const bevelPinion = makeBevelGear(
    { teeth: BEVEL_P, module: RATCH_M, thickness: 0.6, bore: 0.15, pitchAngleDeg: (DELTA_P * 180) / Math.PI },
    steel
  );
  const PSI_P = mod(CW_ANGLE + Math.PI - stepBP / 2, stepBP); // зубець триба — у западину колеса
  bevelPinion.rotation.z = PSI_P;
  pinionG.add(bevelPinion);
  group.add(pinionG);

  // ── Горизонтальний вал від триба до головки + сама головка ──
  const stemStart = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(2.2));
  const stemMid = stemStart.clone().add(crownPos).multiplyScalar(0.5);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, crownPos.clone().sub(stemStart).length() + 0.6, 12),
    axleMat
  );
  stem.rotation.z = CW_ANGLE - Math.PI / 2;
  stem.position.set(stemMid.x, stemMid.y, Z_APEX);
  group.add(stem);

  const crownOrient = new THREE.Group();
  crownOrient.position.set(crownPos.x, crownPos.y, Z_APEX);
  crownOrient.rotation.z = CW_ANGLE - Math.PI / 2;
  const knurl = steel.clone();
  knurl.flatShading = true;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.5, 14), knurl);
  crown.castShadow = true;
  crownOrient.add(crown);
  group.add(crownOrient);

  // Оберт вала/головки накопичується окремо: автопідзавід його не додає
  // (у реальному автопідзаводі заводна головка не крутиться).
  let crownSpin = 0, lastW = 0;

  /**
   * Поза вузла від кута храповика `w`.
   * Знак «−» на храповику: вісь заведення контр-обертається відносно ходу барабана.
   *
   * `spinCrown = false` — автопідзавід у режимі реального часу: храповик докручується
   * сам і собачка клацає, але вал із головкою лишається на місці.
   */
  function setAngle(w, { spinCrown = true } = {}) {
    const dw = w - lastW;
    lastW = w;
    ratchetG.rotation.z = -w;
    // Собачка перескакує по зубцях: повільний підйом за фазою зубця, різкий спад («клац»).
    clickG.rotation.z = CLICK_LIFT * (mod(w, stepR) / stepR);
    if (!spinCrown) return;
    cwG.rotation.z = phiCW + w * (RATCHET_T / CROWN_T);            // коронне + конічне колесо
    crownSpin += dw * (RATCHET_T / CROWN_T) * (BEVEL_W / BEVEL_P); // вал: 16 → 8 = ×2
    bevelPinion.rotation.z = PSI_P - crownSpin;
    crown.rotation.y = -crownSpin;
  }

  tagModule(group, 'winding');
  return { group, ratchet: ratchetG, click: clickG, crownWheelGroup: cwG, setAngle };
}
