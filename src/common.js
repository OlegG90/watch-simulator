import * as THREE from 'three';
import { makeHand } from './gear.js';

// ── Спільні параметри основної передачі ───────────────────────────
export const M = 0.35;        // модуль зубців (спільний для зчеплень передачі)
export const WHEEL_T = 0.7;   // товщина коліс
export const PINION_T = 1.2;  // товщина трібів (довші, бо зчеплення на іншій площині)
export const Z_STEP = 1.1;    // крок між z-площинами сусідніх вузлів
export const AXLE_R = 0.3;    // радіус осей

// ── Спільні хелпери ───────────────────────────────────────────────
export const pitchR = (z, m = M) => (m * z) / 2;
export const mod = (a, m) => ((a % m) + m) % m;
export const deg = (d) => (d * Math.PI) / 180;
export const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

/**
 * Початкова фаза веденого триба: його зубець має стояти у западині ведучого
 * колеса вздовж лінії центрів (theta — напрям від ведучого до веденого).
 * Виводиться з умови: коли западина ведучого дивиться на theta, зубець
 * веденого дивиться на theta + PI.
 */
export function meshPhase(theta, ZA, ZB, phiA) {
  const stepA = (2 * Math.PI) / ZA;
  const stepB = (2 * Math.PI) / ZB;
  const tau = mod(theta - phiA, stepA); // докрут ведучого до вирівнювання западини
  return theta + Math.PI - stepB / 2 + (ZA / ZB) * tau;
}

/**
 * Циліндр уздовж осі Z (вісь, трубка, колонка). Three-циліндр за замовчуванням
 * стоїть уздовж Y, тож потрібен поворот на 90°.
 */
export function makeAxle({ r, len, z = 0, x = 0, y = 0, segments = 12, castShadow = false }, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segments), material);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  return mesh;
}

/**
 * Стрілка + маточина в спільній підгрупі: підгрупа дозволяє задати стрілці
 * власний кут поверх обертання її вузла (режим реального часу).
 */
export function makeHandAssembly(
  { length, width, tail = 0.25, hubR, hubH = 0.24, z, segments = 16 },
  material
) {
  const g = new THREE.Group();
  const hand = makeHand({ length, width, tail }, material);
  hand.position.z = z;
  g.add(hand);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, hubH, segments), material);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = z;
  g.add(hub);
  return g;
}
