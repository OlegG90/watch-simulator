import * as THREE from 'three';
import { makeSpiralRibbon } from './gear.js';
import { pitchR, makeAxle } from './common.js';

/**
 * Модуль енергії: відкритий барабан із видимою заводною пружиною.
 *
 * Барабан навмисно без кришки — видно змотаний мейнспринг. Форма пружини
 * (зовнішній радіус і кількість витків) — функція заряду `c ∈ [0,1]`, який
 * рахує диференціал запасу ходу; сама пружина стану не тримає.
 *
 * Група кріпиться до вузла барабана (arbor0), тож обертається разом із ним.
 */
export function buildBarrel({ brass, steel, springSteel }, { wheelTeeth }) {
  const group = new THREE.Group();
  const R = pitchR(wheelTeeth) - 1.2; // 7.2 — внутрішній радіус барабана
  const zC = -1.5, drumH = 2.0;

  // Стінка барабана — відкритий циліндр (без кришки), отвір дивиться на +Z.
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, drumH, 48, 1, true), brass);
  wall.rotation.x = Math.PI / 2;
  wall.position.z = zC;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Дно барабана (дальня грань, −Z).
  const floor = makeAxle({ r: R, len: 0.2, z: zC - drumH / 2 + 0.1, segments: 48 }, brass);
  floor.receiveShadow = true;
  group.add(floor);

  // Втулка барабанної осі, навколо якої змотана пружина.
  group.add(makeAxle({ r: 0.85, len: drumH * 0.9, z: zC, segments: 24, castShadow: true }, steel));

  // Мейнспринг — спіральна стрічка від втулки до стінки (стан задає setShape).
  const relaxedOuterR = R - 0.4;
  const spring = makeSpiralRibbon({ height: drumH - 0.5, segments: 600 }, springSteel);
  spring.position.z = zC;
  group.add(spring);

  /** Форма пружини від заряду: тугіша = більше витків і менший зовнішній радіус. */
  function setCharge(c) {
    spring.userData.setShape({
      innerR: 1.05,
      outerR: relaxedOuterR - 1.2 * c, // тугіша пружина відходить від стінки
      turns: 3.4 + 3.6 * c,            // більше витків = щільніший пакет
    });
  }
  setCharge(0); // розслаблена — до першого syncDiff

  return { group, spring, setCharge };
}
