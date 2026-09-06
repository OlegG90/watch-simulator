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
/** Z-рівні модуля — спільні з розрізом збоку. */
export const LAYERS = { deck: WIND_Z, apex: WIND_Z + 0.65 };
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
  const Z_APEX = WIND_Z + 0.65; // спільна вершина конусів (рознесено для шайби, B3)
  const stepBP = (2 * Math.PI) / BEVEL_P;
  const stepR = (2 * Math.PI) / RATCHET_T;

  // ── Храповик на осі барабана (тримається собачкою) — потовщений з фаскою ──
  const ratchetG = new THREE.Group();
  ratchetG.position.set(barrelPos.x, barrelPos.y, 0);
  const ratchetMat = steel.clone();
  ratchetMat.color = new THREE.Color(0xa3adb8);
  ratchetMat.roughness = 0.28;
  ratchetMat.metalness = 0.92;
  const ratchet = makeGear(
    { teeth: RATCHET_T, module: RATCH_M, thickness: 0.72, bore: AXLE_R * 0.9, crossings: 5 }, ratchetMat
  );
  ratchet.position.z = WIND_Z;
  ratchetG.add(ratchet);
  // Декоративна фаска-кільце зверху храповика.
  const ratchetRim = new THREE.Mesh(new THREE.RingGeometry(RATCHET_T * RATCH_M / 2 - 0.35, RATCHET_T * RATCH_M / 2 + 0.02, 48), ratchetMat);
  ratchetRim.position.z = WIND_Z + 0.36;
  ratchetG.add(ratchetRim);
  group.add(ratchetG);

  // ── Коронний вузол: плоске коронне колесо + шайба + конічне колесо коаксіально зверху (B3) ──
  const cwG = new THREE.Group();
  cwG.position.set(cwPos.x, cwPos.y, 0);
  const crownWheel = makeGear({ teeth: CROWN_T, module: RATCH_M, thickness: 0.5, bore: 0.2 }, steel);
  crownWheel.position.z = WIND_Z;
  cwG.add(crownWheel);
  // Шайба-проставка між коронним і конічним (B3).
  const spacer = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.14, 20), steel);
  spacer.rotation.x = Math.PI / 2;
  spacer.position.z = WIND_Z + 0.34;
  cwG.add(spacer);
  // Тонка прокладка над шайбою.
  const spacerRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.85, 20), axleMat);
  spacerRing.position.z = WIND_Z + 0.42;
  cwG.add(spacerRing);
  const phiCW = meshPhase(CW_ANGLE, RATCHET_T, CROWN_T, 0);
  const bevelWheel = makeBevelGear(
    { teeth: BEVEL_W, module: RATCH_M, thickness: 0.45, bore: 0.2, pitchAngleDeg: (DELTA_W * 180) / Math.PI },
    steel
  );
  bevelWheel.position.z = Z_APEX;
  bevelWheel.rotation.z = mod(CW_ANGLE - phiCW, (2 * Math.PI) / BEVEL_W); // западина — проти лінії контакту
  cwG.add(bevelWheel);
  cwG.add(makeAxle({ r: 0.18, len: 2.35, z: WIND_Z + 0.32 }, axleMat));
  cwG.rotation.z = phiCW;
  group.add(cwG);

  // ── Собачка: вигнутий важіль з пружиною та рубіновим кінчиком ──
  const clickG = new THREE.Group();
  clickG.position.set(clickPivot.x, clickPivot.y, WIND_Z);
  {
    clickG.add(makeAxle({ r: 0.18, len: 1.4, z: -0.4 }, axleMat));
    const tip = barrelPos.clone().add(dir2(deg(104)).multiplyScalar(4.45));
    const d = tip.clone().sub(clickPivot);
    const L = d.length();
    const ang = Math.atan2(d.y, d.x);
    // Вигнутий важіль — Extrude з фаскою (замість Box).
    const clickShape = new THREE.Shape();
    clickShape.moveTo(0, -0.16);
    clickShape.lineTo(L * 0.72, -0.18);
    clickShape.lineTo(L, -0.10);
    clickShape.lineTo(L, 0.10);
    clickShape.lineTo(L * 0.72, 0.18);
    clickShape.lineTo(0, 0.16);
    clickShape.closePath();
    const clickGeo = new THREE.ExtrudeGeometry(clickShape, {
      depth: 0.30, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2,
    });
    clickGeo.translate(0, 0, -0.15);
    const clickBar = new THREE.Mesh(clickGeo, steel);
    clickBar.rotation.z = ang;
    clickBar.castShadow = true;
    clickBar.receiveShadow = true;
    clickG.add(clickBar);
    // Рубіновий камінь на кінчику собачки.
    const clickRubyMat = new THREE.MeshPhysicalMaterial({
      color: 0xc0304a, roughness: 0.12, metalness: 0.0,
      transmission: 0.28, thickness: 0.3, ior: 1.76,
      emissive: 0x1a050a, emissiveIntensity: 0.2,
    });
    const clickStone = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.32), clickRubyMat);
    clickStone.position.set(d.x, d.y, 0);
    clickG.add(clickStone);
    // Пружина собачки — дуга від тильної сторони важеля до платини.
    const springAnchor = new THREE.Vector2(-1.1, -0.9);
    const ctrl = new THREE.Vector2(L * 0.18, -0.85);
    const springCurve = new THREE.QuadraticBezierCurve(new THREE.Vector2(0, 0), ctrl, springAnchor);
    const springPts = springCurve.getPoints(10);
    const springShape = new THREE.Shape();
    springShape.moveTo(-0.06, 0);
    springShape.lineTo(0.06, 0);
    // пружина як тонка стрічка — Extrude по кривій через Tube
    const springLine = new THREE.CatmullRomCurve3(springPts.map((p) => new THREE.Vector3(p.x, p.y, 0)));
    const springGeo = new THREE.TubeGeometry(springLine, 10, 0.04, 5, false);
    const springMat = steel.clone();
    springMat.roughness = 0.35;
    const springMesh = new THREE.Mesh(springGeo, springMat);
    clickG.add(springMesh);
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

  // ── Горизонтальний вал від триба до головки — один цілісний вал без сходинки ──
  const stemStart = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(2.2));
  const stemEnd = crownPos.clone();
  const stemLen = stemEnd.clone().sub(stemStart).length();
  const stemMid = stemStart.clone().add(stemEnd).multiplyScalar(0.5);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, stemLen + 0.5, 14),
    axleMat
  );
  stem.rotation.z = CW_ANGLE - Math.PI / 2;
  stem.position.set(stemMid.x, stemMid.y, Z_APEX);
  stem.castShadow = true;
  group.add(stem);

  const crownOrient = new THREE.Group();
  crownOrient.position.set(crownPos.x, crownPos.y, Z_APEX);
  crownOrient.rotation.z = CW_ANGLE - Math.PI / 2;
  // Головка як у Reverso Gyrotourbillon: цілісний циліндр з дрібним монетним рифленням.
  const crownBaseMat = steel.clone();
  crownBaseMat.roughness = 0.28;
  crownBaseMat.metalness = 0.92;
  const crownGroup = new THREE.Group();
  // Тіло головки — один циліндр, рифлення інтегроване через 36 тонких гребенів врівень з тілом.
  const crownCore = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 1.42, 40), crownBaseMat);
  crownCore.castShadow = true;
  crownCore.receiveShadow = true;
  crownGroup.add(crownCore);
  // Дрібне рифлення — 36 вузьких гребенів уздовж осі Y (вісь головки), втоплені для цілісності.
  const ridgeGeo = new THREE.BoxGeometry(0.06, 1.38, 0.045);
  for (let i = 0; i < 36; i++) {
    const a = (i * Math.PI * 2) / 36;
    const ridge = new THREE.Mesh(ridgeGeo, crownBaseMat);
    ridge.position.set(Math.cos(a) * 1.085, 0, Math.sin(a) * 1.085);
    ridge.rotation.y = -a;
    ridge.castShadow = true;
    ridge.receiveShadow = true;
    crownGroup.add(ridge);
  }
  // Верхня фаска — конічний перехід до ковпачка (вісь Y).
  const topBevel = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.08, 0.14, 40), crownBaseMat);
  topBevel.position.y = 0.71;
  topBevel.castShadow = true;
  crownGroup.add(topBevel);
  const botBevel = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 0.92, 0.14, 40), crownBaseMat);
  botBevel.position.y = -0.71;
  botBevel.castShadow = true;
  crownGroup.add(botBevel);
  // Ковпачок — плоский полірований диск врівень з фаскою, з логотипом-гравіюванням.
  const capMat = steel.clone();
  capMat.roughness = 0.16;
  capMat.metalness = 0.96;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.05, 32), capMat);
  cap.position.y = 0.805;
  cap.castShadow = true;
  crownGroup.add(cap);
  // Гравіювання — тонке кільце на ковпачку.
  const logoRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.36, 24), capMat);
  logoRing.rotation.x = Math.PI / 2;
  logoRing.position.y = 0.835;
  logoRing.rotation.z = 0.12;
  crownGroup.add(logoRing);
  // Прокладка.
  const gasketMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.85, metalness: 0.05 });
  const gasket = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.055, 8, 20), gasketMat);
  gasket.rotation.x = Math.PI / 2;
  gasket.position.y = -0.79;
  crownGroup.add(gasket);
  // Crown обертається навколо своєї поздовжньої осі Y (вісь вала), тому групуємо крізь проміжний вузол.
  const crown = new THREE.Group();
  crown.add(crownGroup);
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
