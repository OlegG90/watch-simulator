import * as THREE from 'three';
import { makeGear, makeEscapeWheel } from './gear.js';

// ── Константи спуску (ті самі, що в escapement.js) ────────────────
const FORK_MAX = 0.14;   // розмах анкера, рад
const FLIP_W = 0.12;     // пів-ширина вікна перекидання, частка удару
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

function bar(from, to, w, t, material) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Турбійон: увесь спуск (анкерне колесо + вилка + баланс зі спіраллю) сидить
 * у обертовій кліті. Анкерний триб (Zp) обкочується навколо НЕРУХОМОГО колеса
 * (Zf) в центрі кліті; при Zf = Zp кут кліті θ_cage дорівнює биттю спуску β,
 * тож привід передачі не змінюється (θ_cage замінює старий кут анкерного колеса).
 *
 * update(t, beatHz, ampDeg) → θ_cage (кут кліті; ним рухається вся передача).
 *
 * Геометрія — компактна, у локальних координатах кліті (центр = вісь нерухомого
 * колеса). Кліть додається дочірньою до групи, що вже обертається на θ_cage
 * (у нас — arbor4.group); нерухоме колесо додається окремо, у нерухому групу.
 */
export function buildTourbillon(
  { steel, brass, ruby, springMat, axleMat, plateMat },
  { escTeeth = 15, fixedTeeth = 10, pinionTeeth = 10, moduleT = 0.26, cageR = 4.3, escDirLocal = 0 }
) {
  const cage = new THREE.Group();   // обертова частина (додати до arbor4.group)
  const fixed = new THREE.Group();  // нерухома частина (додати до root у cagePos)
  const halfStep = Math.PI / escTeeth;

  // Z-рівні (локальні; кліть ставиться на zBase у movement).
  const zPin = 0;      // площина нерухомого колеса й анкерного триба (зачеплення)
  const zEsc = 0.55;   // анкерне колесо
  const zFork = 0.95;  // вилка
  const zBal = 1.75;   // баланс
  const zHair = 2.25;  // спіраль
  const zBot = -0.55, zTop = 2.6; // платівки кліті

  const escOff = moduleT * (fixedTeeth + pinionTeeth) / 2; // центр анкерного вузла від центра кліті
  const escCenter = dir2(escDirLocal).multiplyScalar(escOff);
  const escR = Math.min(1.7, cageR - escOff - 0.2); // анкерне колесо не виходить за кліть

  // ── Нерухоме колесо (fourth wheel) — у центрі, НЕ обертається з кліттю ──
  const fixedWheel = makeGear({ teeth: fixedTeeth, module: moduleT, thickness: 0.4, bore: 0.5 }, steel);
  fixedWheel.position.z = zPin;
  fixed.add(fixedWheel);
  // Колонка нерухомого колеса (від платини вгору до центра кліті).
  const fixedPost = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.0, 12), axleMat);
  fixedPost.rotation.x = Math.PI / 2;
  fixedPost.position.z = zPin - 1.0;
  fixed.add(fixedPost);

  // ── Анкерний вузол (колесо + триб) — обкочується навколо нерухомого ──
  const escSub = new THREE.Group();
  escSub.position.set(escCenter.x, escCenter.y, 0);
  const escWheel = makeEscapeWheel(
    { teeth: escTeeth, outerR: escR, rootR: escR - 0.5, thickness: 0.35, bore: 0.18, crossings: 3 },
    brass
  );
  escWheel.position.z = zEsc;
  escSub.add(escWheel);
  const escPinion = makeGear({ teeth: pinionTeeth, module: moduleT, thickness: 0.4, bore: 0.18 }, steel);
  escPinion.position.z = zPin;
  escSub.add(escPinion);
  const escAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 10), axleMat);
  escAxle.rotation.x = Math.PI / 2;
  escAxle.position.z = zEsc - 0.15;
  escSub.add(escAxle);
  cage.add(escSub);

  // ── Вилка (анкер) — між анкерним колесом і балансом у центрі ──
  const fork = new THREE.Group();
  const forkPivot = dir2(escDirLocal).multiplyScalar(escOff * 0.52); // ближче до центра
  fork.position.set(forkPivot.x, forkPivot.y, zFork);
  {
    const toEscLocal = escCenter.clone().sub(forkPivot);
    // Палети на ободі анкерного колеса, ±30° від лінії до балансу.
    const inward = escDirLocal + Math.PI; // від анкерного колеса до центра
    for (const s of [+1, -1]) {
      const rimPt = escCenter.clone().add(dir2(inward + s * (30 * Math.PI) / 180).multiplyScalar(escR - 0.12));
      const local = rimPt.clone().sub(forkPivot);
      fork.add(bar(new THREE.Vector2(0, 0), local, 0.3, 0.28, steel));
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.4), ruby);
      stone.position.set(local.x, local.y, 0);
      stone.rotation.z = inward + s * (30 * Math.PI) / 180;
      fork.add(stone);
    }
    // Стрижень до центра (балансу) + ріжки.
    const stemEnd = dir2(inward).multiplyScalar(forkPivot.length() - 0.55);
    fork.add(bar(new THREE.Vector2(0, 0), stemEnd, 0.26, 0.28, steel));
    const forkAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.3, 12), axleMat);
    forkAxle.rotation.x = Math.PI / 2;
    fork.add(forkAxle);
  }
  cage.add(fork);

  // ── Баланс — у ЦЕНТРІ кліті (коаксіально з нерухомим колесом) ──
  const balance = new THREE.Group();
  balance.position.z = zBal;
  const balR = Math.min(1.5, cageR - 2.4);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(balR, 0.16, 10, 40), brass);
  rim.castShadow = true;
  balance.add(rim);
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(balR * 2 - 0.15, 0.16, 0.16), brass);
    spoke.rotation.z = a;
    balance.add(spoke);
  }
  const balHub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16), steel);
  balHub.rotation.x = Math.PI / 2;
  balance.add(balHub);
  const balAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.4, 12), axleMat);
  balAxle.rotation.x = Math.PI / 2;
  balAxle.position.z = -0.35;
  balance.add(balAxle);
  // Імпульсний палець (у площину вилки).
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 10), ruby);
  pin.rotation.x = Math.PI / 2;
  const pinPos = dir2(escDirLocal).multiplyScalar(0.45);
  pin.position.set(pinPos.x, pinPos.y, -0.7);
  balance.add(pin);
  cage.add(balance);

  // ── Спіраль (волосок): зовнішній кінець на кліті, внутрішній — на балансі ──
  const N = 160, TURNS = 4, R0 = 0.32, R1 = Math.min(1.25, balR - 0.15);
  const hairGroup = new THREE.Group();
  hairGroup.position.z = zHair;
  const hairGeo = new THREE.BufferGeometry();
  hairGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const hair = new THREE.Line(hairGeo, springMat);
  hairGroup.add(hair);
  const stud = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.35), steel);
  stud.position.set(Math.cos(escDirLocal) * R1, Math.sin(escDirLocal) * R1, 0);
  hairGroup.add(stud);
  cage.add(hairGroup);
  const PHI_TOT = TURNS * Math.PI * 2;
  function updateHair(thetaB) {
    const pos = hairGeo.attributes.position;
    for (let j = 0; j < N; j++) {
      const f = j / (N - 1);
      const ang = thetaB * (1 - f) + f * PHI_TOT - PHI_TOT + escDirLocal;
      const r = R0 + (R1 - R0) * f;
      pos.setXYZ(j, Math.cos(ang) * r, Math.sin(ang) * r, 0);
    }
    pos.needsUpdate = true;
  }

  // ── Кліть: дві платівки з вирізами + 3 колони ──
  const makePlate = (z) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(cageR - 0.85, cageR, 40), plateMat);
    ring.position.z = z;
    cage.add(ring);
    // Три перемички-спиці (щоб платівка була цілісною, але прозорою).
    for (let i = 0; i < 3; i++) {
      const a = escDirLocal + Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(cageR, 0.35, 0.12), plateMat);
      spoke.rotation.z = a;
      spoke.position.set(Math.cos(a) * cageR * 0.5, Math.sin(a) * cageR * 0.5, z);
      cage.add(spoke);
    }
  };
  makePlate(zBot);
  makePlate(zTop);
  for (let i = 0; i < 3; i++) {
    const a = escDirLocal + Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, zTop - zBot, 10), steel);
    pillar.rotation.x = Math.PI / 2;
    pillar.position.set(Math.cos(a) * (cageR - 0.25), Math.sin(a) * (cageR - 0.25), (zBot + zTop) / 2);
    pillar.castShadow = true;
    cage.add(pillar);
  }

  // ── Фазування анкерного колеса: вістря проти вхідної палети при β=0 ──
  const stepE = (2 * Math.PI) / escTeeth;
  escWheel.rotation.z = mod(escDirLocal + Math.PI + Math.PI / 6, stepE);

  // ── Кінематика удару (та сама, що в escapement.js) ──
  function update(t, beatHz, ampDeg) {
    const u = t * beatHz;
    const A = (ampDeg * Math.PI) / 180;
    const thetaB = A * Math.sin(Math.PI * u);
    const n = Math.round(u);
    const x = (u - n) / (2 * FLIP_W) + 0.5;
    const ss = smooth(x);
    const sigma = ((n % 2) + 2) % 2 === 0 ? 1 : -1;

    const beta = halfStep * (n - 1 + ss); // кут анкерного колеса відносно кліті = θ_cage
    escSub.rotation.z = beta;             // анкерне колесо обкочується (Zf = Zp → відносно кліті = β)
    fork.rotation.z = -FORK_MAX * sigma * (2 * ss - 1);
    balance.rotation.z = thetaB;
    updateHair(thetaB);
    return beta;                          // = θ_cage
  }
  update(0, 2.5, 220);

  return { cage, fixed, update, balance, fork, escSub, hairGroup, cageR };
}

function mod(a, m) { return ((a % m) + m) % m; }
