import * as THREE from 'three';
import { makeGear } from './gear.js';
import { AXLE_R, deg, dir2, meshPhase, makeAxle, makeHandAssembly, tagModule } from './common.js';

// ── Моторний механізм: канон (12) → хвилинне (36); тріб (10) → годинне (40) = ×12 ──
export const CANNON_T = 12;
export const MINUTE_T = 36;
export const MW_PINION_T = 10;
export const HOUR_T = 40;
export const MW_M1 = 0.28;                  // модуль пари канон → хвилинне
export const MW_M2 = (MW_M1 * 48) / 50;     // модуль пари тріб → годинне (та сама міжосьова)
export const MW_ANGLE = deg(120);           // хвилинне колесо — над петлею передачі
const Z_MW = 7.2, Z_HR = 7.9;
/** Z-рівні модуля — їх читає і розріз збоку, тож числа живуть в одному місці. */
export const LAYERS = { minuteWheel: Z_MW, hourWheel: Z_HR, hands: { hour: 9.9, minute: 10.25, second: 10.7 } };

// ── Центральна секунда: верхній місток від секундного колеса до центру ──
export const CS_DRIVE = 48;
export const CS_IDLER = 20;
export const CS_PINION = 8;
const Z_CS = 9.45;
LAYERS.centralSeconds = Z_CS;

/** Розкладка моторного вузла й центральної секунди (позиції + внесок у межі). */
export function layoutMotionWorks(arbors) {
  const P1 = arbors[1].pos;
  const mwPos = P1.clone().add(dir2(MW_ANGLE).multiplyScalar(((CANNON_T + MINUTE_T) / 2) * MW_M1));

  const csFrom = arbors[3].pos;
  const csVec = P1.clone().sub(csFrom);
  // Модуль підганяється під фактичну відстань осей: (48+8)/2 + 20 проміжного.
  const CS_M = csVec.length() / (((CS_DRIVE + CS_PINION) / 2) + CS_IDLER);
  const csIdlerPos = csFrom.clone()
    .add(csVec.clone().normalize().multiplyScalar(((CS_DRIVE + CS_IDLER) / 2) * CS_M));

  return {
    P1, mwPos, CS_M, csIdlerPos,
    csTheta1: Math.atan2(csIdlerPos.y - csFrom.y, csIdlerPos.x - csFrom.x),
    csTheta2: Math.atan2(P1.y - csIdlerPos.y, P1.x - csIdlerPos.x),
    csRatio: CS_DRIVE / CS_PINION, // 6×: секундна вісь → центральна секундна вісь
    extents: [
      { pos: P1, r: 7.9 },        // розмах найдовшої центральної стрілки (секундної)
      { pos: mwPos, r: 5.6 },     // хвилинне колесо
      { pos: csFrom, r: (CS_DRIVE * CS_M) / 2 + CS_M * 1.3 }, // ведуче колесо центральної секунди
      { pos: csIdlerPos, r: (CS_IDLER * CS_M) / 2 + CS_M * 1.3 },
    ],
  };
}

/**
 * Меші індикації часу: моторний механізм, центральна секундна передача й три
 * концентричні стрілки на верху центрального вала.
 *
 * Канонний тріб і хвилинна стрілка сидять на осі центрального колеса (обертаються
 * з ним); годинне колесо — коаксіально, у 12 разів повільніше; центральна секунда
 * приходить окремим містком від секундної осі.
 */
export function buildMotionWorks({ brass, steel, axleMat, bluedMat }, L, arbors, root) {
  const { P1, mwPos, CS_M, csIdlerPos } = L;
  const handRefs = {};

  // ── Канонний тріб + трубка + хвилинна стрілка (на осі центрального колеса) ──
  const cannonSub = new THREE.Group();
  {
    const cannon = makeGear({ teeth: CANNON_T, module: MW_M1, thickness: 0.8, bore: AXLE_R * 0.9 }, steel);
    cannon.position.z = Z_MW;
    cannonSub.add(cannon);
    cannonSub.add(makeAxle({ r: 0.4, len: 3.1, z: 8.7, segments: 16 }, steel)); // канонна трубка до верху
    handRefs.minute = makeHandAssembly(
      { length: 7.0, width: 0.6, hubR: 0.5, hubH: 0.28, z: 10.25 }, bluedMat
    );
    cannonSub.add(handRefs.minute);
  }
  arbors[1].group.add(cannonSub);

  // ── Хвилинне колесо + його тріб ──
  const mwArbor = new THREE.Group();
  mwArbor.position.set(mwPos.x, mwPos.y, 0);
  {
    const wheel = makeGear({ teeth: MINUTE_T, module: MW_M1, thickness: 0.55, bore: 0.2, crossings: 4 }, brass);
    wheel.position.z = Z_MW;
    mwArbor.add(wheel);
    const pinion = makeGear({ teeth: MW_PINION_T, module: MW_M2, thickness: 0.7, bore: 0.2 }, steel);
    pinion.position.z = Z_HR;
    mwArbor.add(pinion);
    mwArbor.add(makeAxle({ r: 0.22, len: 1.9, z: (Z_MW + Z_HR) / 2 + 0.05, segments: 16 }, axleMat));
  }
  root.add(mwArbor);

  // ── Годинне колесо + годинна стрілка (коаксіально з центральною віссю) ──
  const hourGroup = new THREE.Group();
  hourGroup.position.set(P1.x, P1.y, 0);
  {
    const wheel = makeGear({ teeth: HOUR_T, module: MW_M2, thickness: 0.5, bore: 0.68, crossings: 4 }, brass);
    wheel.position.z = Z_HR;
    hourGroup.add(wheel);
    hourGroup.add(makeAxle({ r: 0.62, len: 2.0, z: 8.9, segments: 16 }, brass)); // годинна трубка
    handRefs.hour = makeHandAssembly(
      { length: 5.6, width: 0.7, hubR: 0.62, z: 9.9 }, bluedMat // над усіма колесами (найвище z≈9.45)
    );
    hourGroup.add(handRefs.hour);
  }
  root.add(hourGroup);

  // ── Центральна секундна передача: секундне колесо → проміжне → центральний тріб ──
  const csDriveGear = makeGear(
    { teeth: CS_DRIVE, module: CS_M, thickness: 0.45, bore: AXLE_R * 0.9, crossings: 4 }, brass
  );
  csDriveGear.position.z = Z_CS;
  arbors[3].group.add(csDriveGear);
  const csDriveAxle = makeAxle({ r: 0.2, len: 5.8, z: 7.2, segments: 16 }, axleMat);
  arbors[3].group.add(csDriveAxle);

  const csIdlerGroup = new THREE.Group();
  csIdlerGroup.position.set(csIdlerPos.x, csIdlerPos.y, 0);
  {
    const idler = makeGear({ teeth: CS_IDLER, module: CS_M, thickness: 0.45, bore: 0.18, crossings: 3 }, steel);
    idler.position.z = Z_CS;
    csIdlerGroup.add(idler);
    csIdlerGroup.add(makeAxle({ r: 0.18, len: 1.5, z: Z_CS, segments: 14 }, axleMat));
  }
  root.add(csIdlerGroup);

  const centralSecondsGroup = new THREE.Group();
  centralSecondsGroup.position.set(P1.x, P1.y, 0);
  {
    const pinion = makeGear({ teeth: CS_PINION, module: CS_M, thickness: 0.55, bore: 0.18 }, steel);
    pinion.position.z = Z_CS;
    centralSecondsGroup.add(pinion);
    centralSecondsGroup.add(makeAxle({ r: 0.24, len: 2.2, z: 10.0, segments: 16 }, steel));
    handRefs.second = makeHandAssembly(
      { length: 7.4, width: 0.32, tail: 0.18, hubR: 0.32, z: 10.7 }, bluedMat // зверху над хвилинною
    );
    centralSecondsGroup.add(handRefs.second);
  }
  root.add(centralSecondsGroup);

  // ── Фазування (та сама умова «зубець у западину», що й в основній передачі) ──
  const phiMW = meshPhase(MW_ANGLE, CANNON_T, MINUTE_T, arbors[1].phi);
  const phiHW = meshPhase(MW_ANGLE + Math.PI, MW_PINION_T, HOUR_T, phiMW);
  const phiCSIdler = meshPhase(L.csTheta1, CS_DRIVE, CS_IDLER, arbors[3].phi);
  const phiCSCenter = meshPhase(L.csTheta2, CS_IDLER, CS_PINION, phiCSIdler);

  /**
   * @param dR1 приріст кута центрального колеса (веде моторний механізм)
   * @param dR3 приріст кута секундної осі (веде центральну секунду)
   */
  function update(dR1, dR3) {
    mwArbor.rotation.z = phiMW - (CANNON_T / MINUTE_T) * dR1;
    hourGroup.rotation.z = phiHW + (MW_PINION_T / HOUR_T) * (CANNON_T / MINUTE_T) * dR1; // = центральне / 12
    // Дві зовнішні пари зберігають напрям, а 48→8 дає множник 6× від секундної осі.
    csIdlerGroup.rotation.z = phiCSIdler - (CS_DRIVE / CS_IDLER) * dR3;
    centralSecondsGroup.rotation.z = phiCSCenter + L.csRatio * dR3;
  }

  /** Демо-режим: стрілки жорстко зчеплені зі своїми колесами. */
  function resetHands() {
    handRefs.hour.rotation.z = 0;
    handRefs.minute.rotation.z = 0;
    handRefs.second.rotation.z = 0;
  }

  /** Реальний час: стрілки накладаються поверх (передача під ними «проковзує»). */
  function setHandAngles({ hour, minute, second }, arbors_) {
    handRefs.second.rotation.z = second - centralSecondsGroup.rotation.z;
    handRefs.minute.rotation.z = minute - arbors_[1].group.rotation.z;
    handRefs.hour.rotation.z = hour - hourGroup.rotation.z;
  }

  for (const o of [cannonSub, mwArbor, hourGroup, csDriveGear, csDriveAxle, csIdlerGroup, centralSecondsGroup]) {
    tagModule(o, 'motionWorks');
  }

  return {
    cannonSub, mwArbor, hourGroup, csDriveGear, csIdlerGroup, centralSecondsGroup,
    handRefs, update, resetHands, setHandAngles,
  };
}
