import * as THREE from 'three';
import { makeGear, makeEscapeWheel } from '../gear.js';
import { tagModule, tagVariant } from '../common.js';
import { beatPhase } from './beat.js';
import { buildHairspring } from './hairspring.js';

// ── Константи спуску (ті самі, що в escapement.js) ────────────────
/** Локальні Z-рівні кліті (від її основи) — спільні з розрізом збоку. */
export const LAYERS = { bottom: -0.55, pin: 0, escape: 0.55, fork: 0.95, balance: 1.75, hair: 2.25, top: 2.6 };

/** Радіус обода балансу: або власний розмір, або скільки лишає кліть. */
export const balanceR = (cageR) => Math.min(1.95, cageR - 1.95);

/** Товщини тіл — ті самі числа в мешах і в розгортці. */
const T = { balRim: 0.18 };

/**
 * Що варіант каже про себе в розгортці — до появи мешів.
 *
 * Вежа з двох платівок: усе інше всередині неї, тож у розгортці видно саме
 * кліть, а не начинку. `u` — від анкерної осі, `z` — від основи гнізда.
 */
export function profile(zBase = 0, { cageR } = {}) {
  return {
    parts: [
      { anchor: 'escape', u: 0, z0: zBase + LAYERS.bottom, z1: zBase + LAYERS.top, r: cageR, kind: 'cage',
        labelKey: `part.${VARIANT_ID}` },
      { anchor: 'escape', u: 0, z0: zBase + LAYERS.balance - T.balRim, z1: zBase + LAYERS.balance + T.balRim,
        r: balanceR(cageR), kind: 'flat' },
    ],
  };
}

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
/** Ідентифікатор варіанта в гнізді спуску. */
export const VARIANT_ID = 'tourbillon';

export function buildTourbillon(
  { steel, brass, ruby, springSteel, axleMat, plateMat },
  { escTeeth = 15, fixedTeeth = 10, pinionTeeth = 10, moduleT = 0.26, cageR = 4.3, escDirLocal = 0 }
) {
  const cage = new THREE.Group();   // обертова частина (додати до arbor4.group)
  const fixed = new THREE.Group();  // нерухома частина (додати до root у cagePos)

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
  // Рубінові палети — гранований фізичний матеріал з transmission, щоб камінь
  // просвічувався і мав відблиск, на відміну від матового Box.
  const palletMat = new THREE.MeshPhysicalMaterial({
    color: 0xc0304a, roughness: 0.12, metalness: 0.0,
    transmission: 0.28, thickness: 0.4, ior: 1.76,
    emissive: 0x1a050a, emissiveIntensity: 0.25,
    clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
  // Імпульсний камінь балансу теж фізичний — просвічує.
  const impulseRubyMat = palletMat.clone();
  impulseRubyMat.emissiveIntensity = 0.18;
  const fork = new THREE.Group();
  const forkPivot = dir2(escDirLocal).multiplyScalar(escOff * 0.52); // ближче до центра
  fork.position.set(forkPivot.x, forkPivot.y, zFork);
  {
    // Палети на ободі анкерного колеса, ±30° від лінії до балансу.
    const inward = escDirLocal + Math.PI; // від анкерного колеса до центра
    for (const s of [+1, -1]) {
      const rimPt = escCenter.clone().add(dir2(inward + s * (30 * Math.PI) / 180).multiplyScalar(escR - 0.12));
      const local = rimPt.clone().sub(forkPivot);
      fork.add(bar(new THREE.Vector2(0, 0), local, 0.3, 0.28, steel));
      // Гранована призма замість Box — фаска через bevel Extrude.
      const pShape = new THREE.Shape();
      const pw = 0.3, ph = 0.6;
      pShape.moveTo(-pw / 2, -ph / 2);
      pShape.lineTo(pw / 2, -ph / 2);
      pShape.lineTo(pw / 2, ph / 2);
      pShape.lineTo(-pw / 2, ph / 2);
      pShape.closePath();
      const pGeo = new THREE.ExtrudeGeometry(pShape, {
        depth: 0.4, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 2,
      });
      pGeo.translate(0, 0, -0.2);
      const stone = new THREE.Mesh(pGeo, palletMat);
      stone.position.set(local.x, local.y, 0);
      stone.rotation.z = inward + s * (30 * Math.PI) / 180;
      stone.castShadow = true;
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

  // ── Баланс — у ЦЕНТРІ кліті (коаксіально з нерухомим колесом) — збільшено для видимості ──
  const balance = new THREE.Group();
  balance.position.z = zBal;
  const balR = balanceR(cageR);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(balR, T.balRim, 16, 64), brass);
  rim.castShadow = true;
  rim.receiveShadow = true;
  balance.add(rim);
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(balR * 2 - 0.15, 0.16, 0.16), brass);
    spoke.rotation.z = a;
    spoke.castShadow = true;
    balance.add(spoke);
  }
  // Регулювальні гвинти/ваги на ободі — 4 шт хрест-навхрест з офсетом, щоб не збігались зі спицями.
  const screwGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.26, 12);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI * 2) / 4 + Math.PI / 8;
    const sx = Math.cos(a) * balR, sy = Math.sin(a) * balR;
    const screw = new THREE.Mesh(screwGeo, steel);
    screw.position.set(sx, sy, 0.08);
    // Гвинт стирчить радіально назовні.
    screw.rotation.z = a;
    screw.rotation.x = Math.PI / 2;
    screw.castShadow = true;
    balance.add(screw);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), steel);
    head.position.set(Math.cos(a) * (balR + 0.07), Math.sin(a) * (balR + 0.07), 0.08);
    head.rotation.z = a;
    head.rotation.x = Math.PI / 2;
    head.castShadow = true;
    balance.add(head);
  }
  const balHub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16), steel);
  balHub.rotation.x = Math.PI / 2;
  balance.add(balHub);
  const balAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.4, 12), axleMat);
  balAxle.rotation.x = Math.PI / 2;
  balAxle.position.z = -0.35;
  balance.add(balAxle);
  // Імпульсний камінь — прямокутна призма рубіну з фаскою (не циліндр).
  const impulseGeo = new THREE.BoxGeometry(0.18, 0.28, 0.9);
  const pin = new THREE.Mesh(impulseGeo, impulseRubyMat);
  const pinPos = dir2(escDirLocal).multiplyScalar(0.45);
  pin.position.set(pinPos.x, pinPos.y, -0.68);
  balance.add(pin);
  cage.add(balance);

  // ── Спіраль (волосок) — спільна для всіх варіантів спуску ──
  const hair = buildHairspring({ balR, dirAngle: escDirLocal, springSteel, steel });
  const hairGroup = hair.group;
  hairGroup.position.z = zHair;
  cage.add(hairGroup);
  const updateHair = hair.update;

  // ── Кліть: дві платівки з об'ємом і фаскою + 3 колони з оголовками ──
  const cagePlateMat = plateMat.clone();
  cagePlateMat.side = THREE.DoubleSide;
  const cagePillars = [];
  const cagePlates = [];
  const topPlateGroup = new THREE.Group();
  const PLATE_T = 0.11;
  const bottomPlateGroup = new THREE.Group();

  function makeCagePlate(z, targetGroup) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, cageR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, cageR - 0.32, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: PLATE_T,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 48,
    });
    geo.translate(0, 0, -PLATE_T / 2);
    const ring = new THREE.Mesh(geo, cagePlateMat);
    ring.position.z = z;
    ring.castShadow = true;
    ring.receiveShadow = true;
    targetGroup.add(ring);
    cagePlates.push(ring);
    for (let i = 0; i < 3; i++) {
      const a = escDirLocal + Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const spokeGeo = new THREE.BoxGeometry(cageR * 0.96, 0.32, 0.09);
      const spoke = new THREE.Mesh(spokeGeo, cagePlateMat);
      spoke.rotation.z = a;
      spoke.position.set(Math.cos(a) * cageR * 0.48, Math.sin(a) * cageR * 0.48, z);
      spoke.castShadow = true;
      spoke.receiveShadow = true;
      targetGroup.add(spoke);
      cagePlates.push(spoke);
    }
  }
  makeCagePlate(zBot, bottomPlateGroup);
  makeCagePlate(zTop, topPlateGroup);
  cage.add(bottomPlateGroup);
  cage.add(topPlateGroup);

  const pillarH = zTop - zBot;
  for (let i = 0; i < 3; i++) {
    const a = escDirLocal + Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const cx = Math.cos(a) * (cageR - 0.28), cy = Math.sin(a) * (cageR - 0.28);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, pillarH, 14), steel);
    stem.rotation.x = Math.PI / 2;
    stem.position.set(cx, cy, (zBot + zTop) / 2);
    stem.castShadow = true;
    cage.add(stem);
    cagePillars.push(stem);
    for (const z of [zBot, zTop]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.05, 14), steel);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(cx, cy, z > 0 ? z - 0.015 : z + 0.015);
      cap.castShadow = true;
      cage.add(cap);
      cagePillars.push(cap);
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.02, 10), axleMat);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(cx, cy, z > 0 ? z + PLATE_T / 2 + 0.04 : z - PLATE_T / 2 - 0.04);
      cage.add(screw);
      cagePillars.push(screw);
    }
  }

  function setCageOpacity(op) {
    const on = op < 1;
    cagePlateMat.transparent = on;
    cagePlateMat.opacity = op;
    cagePlateMat.depthWrite = !on;
    cagePlateMat.needsUpdate = true;
  }
  function setTopPlateVisible(v) { topPlateGroup.visible = v; }

  // ── Фазування анкерного колеса: вістря проти вхідної палети при β=0 ──
  const stepE = (2 * Math.PI) / escTeeth;
  escWheel.rotation.z = mod(escDirLocal + Math.PI + Math.PI / 6, stepE);

  // ── Кінематика удару (та сама, що в escapement.js) ──
  // Буфер фази: `update()` у циклі рендеру, новий об'єкт на кадр був би сміттям.
  const phase = {};

  function update(t, beatHz, ampDeg) {
    const { thetaB, beta, forkAngle } = beatPhase(t, beatHz, ampDeg, escTeeth, phase);
    escSub.rotation.z = beta;   // анкерне колесо обкочується (Zf = Zp → відносно кліті = β)
    fork.rotation.z = forkAngle;
    balance.rotation.z = thetaB;
    updateHair(thetaB);
    return beta;                // = θ_cage
  }
  update(0, 2.5, 220);

  // Гніздо — 'escapement'; який саме модуль у ньому стоїть — у variant.
  for (const g of [cage, fixed, bottomPlateGroup, topPlateGroup]) {
    tagModule(g, 'escapement');
    tagVariant(g, VARIANT_ID);
  }
  // Ручки вузлів вільного режиму — див. `lever.js`. Прозорість кліті й верхня
  // платівка є тільки тут: вони описують саме кліть, і в анкерному спуску їм
  // немає відповідника.
  const view = { cageOpacity: 1.0, topPlate: true };
  const nodes = [
    { kind: 'flag', labelKey: 'part.fixedWheel', obj: fixed, prop: 'visible' },
    { kind: 'flag', labelKey: 'part.balance', obj: balance, prop: 'visible' },
    { kind: 'range', labelKey: 'gui.cageOpacity', obj: view, prop: 'cageOpacity',
      min: 0.15, max: 1.0, step: 0.05, onChange: setCageOpacity },
    { kind: 'flag', labelKey: 'gui.cageTopPlate', obj: view, prop: 'topPlate',
      onChange: setTopPlateVisible },
  ];

  return { cage, fixed, update, nodes, balance, fork, escSub, hairGroup, cageR, balR,
           setCageOpacity, setTopPlateVisible, cagePlates, cagePillars, topPlateGroup, bottomPlateGroup };
}

function mod(a, m) { return ((a % m) + m) % m; }
