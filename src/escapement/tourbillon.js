import * as THREE from 'three';
import { makeGear, makeEscapeWheel } from '../gear.js';
import { tagModule, tagVariant } from '../common.js';
import { beatPhase } from './beat.js';

// ── Константи спуску (ті самі, що в escapement.js) ────────────────
/** Локальні Z-рівні кліті (від її основи) — спільні з розрізом збоку. */
export const LAYERS = { bottom: -0.55, pin: 0, escape: 0.55, fork: 0.95, balance: 1.75, hair: 2.25, top: 2.6 };

/** Радіус обода балансу: або власний розмір, або скільки лишає кліть. */
export const balanceR = (cageR) => Math.min(1.95, cageR - 1.95);

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
  const rim = new THREE.Mesh(new THREE.TorusGeometry(balR, 0.18, 16, 64), brass);
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

  // ── Спіраль (волосок): об'ємна трубка з Breguet overcoil ──
  // Зовнішній кінець на кліті (stud), внутрішній — на балансі. TubeGeometry дає
  // реальну товщину (видно під кутом і з відстані), на відміну від Line 1px.
  const N = 120, TURNS = 4, R0 = 0.32, R1 = Math.min(1.65, balR - 0.08);
  const OVERCOIL_F = 0.85, OVERCOIL_H = 0.18, HAIR_R = 0.034;
  const hairGroup = new THREE.Group();
  hairGroup.position.z = zHair;
  // Матеріал трубки — власний клон пружинної сталі: спіраль об'ємна, тож це
  // звичайний метал, а не матеріал лінії.
  const hairMat = springSteel.clone();
  // Підсилюємо контраст відносно вороненої кліті — трохи світліший і холодніший
  // відтінок, щоб тонкий дріт не губився на темному тлі.
  hairMat.color.setHex(0xbfd4ff);
  hairMat.roughness = 0.22;
  hairMat.metalness = 0.95;
  // Сітка трубки будується ОДИН раз: індекси й UV незмінні, щокадру
  // переписуються лише позиції та нормалі. Перебудова `TubeGeometry` на кожен
  // кадр коштувала ~5.7 КБ сміття й ~285 мкс — більше за весь інший механізм.
  const RADIAL = 8;
  const VROW = RADIAL + 1;
  const hairGeo = new THREE.BufferGeometry();
  const hairPos = new Float32Array((N + 1) * VROW * 3);
  const hairNrm = new Float32Array((N + 1) * VROW * 3);
  {
    const uv = new Float32Array((N + 1) * VROW * 2);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= RADIAL; j++) {
        const k = i * VROW + j;
        uv[k * 2] = i / N;
        uv[k * 2 + 1] = j / RADIAL;
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = i * VROW + j, b = (i + 1) * VROW + j;
        idx.push(a, b, i * VROW + j + 1, b, (i + 1) * VROW + j + 1, i * VROW + j + 1);
      }
    }
    hairGeo.setIndex(idx);
    hairGeo.setAttribute('position', new THREE.BufferAttribute(hairPos, 3));
    hairGeo.setAttribute('normal', new THREE.BufferAttribute(hairNrm, 3));
    hairGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    // Спіраль дихає всередині сталих меж, тож сферу рахуємо раз і не чіпаємо —
    // інакше довелося б обходити всі вершини щокадру заради відсікання.
    hairGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, OVERCOIL_H / 2), R1 + HAIR_R + 0.05);
  }
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.castShadow = true;
  hairGroup.add(hair);
  const stud = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.35), steel);
  stud.position.set(Math.cos(escDirLocal) * R1, Math.sin(escDirLocal) * R1, OVERCOIL_H);
  hairGroup.add(stud);
  cage.add(hairGroup);
  const PHI_TOT = TURNS * Math.PI * 2;
  // Осьова крива спіралі. Радіус і висота від кута балансу НЕ залежать —
  // θ_b лише підкручує кут, і то тим слабше, чим ближче до зовнішнього кінця.
  const _axis = Array.from({ length: N + 1 }, () => new THREE.Vector3());
  const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 0, 1);

  function updateHair(thetaB) {
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const ang = thetaB * (1 - f) + f * PHI_TOT - PHI_TOT + escDirLocal;
      let r = R0 + (R1 - R0) * f;
      let z = 0;
      if (f > OVERCOIL_F) {
        const t = (f - OVERCOIL_F) / (1 - OVERCOIL_F);
        const s = t * t * (3 - 2 * t); // smoothstep
        z = s * OVERCOIL_H;
        r = THREE.MathUtils.lerp(r, R1 * 0.92, s * 0.35);
      }
      _axis[i].set(Math.cos(ang) * r, Math.sin(ang) * r, z);
    }
    for (let i = 0; i <= N; i++) {
      // Кадр перерізу будуємо від осі Z, а не за Френе: дотична спіралі ніде
      // не стає вертикальною, тож так стабільніше й без зайвої математики.
      const prev = _axis[i > 0 ? i - 1 : 0], next = _axis[i < N ? i + 1 : N];
      _t.subVectors(next, prev).normalize();
      _n.crossVectors(_t, _up).normalize();
      _b.crossVectors(_t, _n);
      const p = _axis[i];
      for (let j = 0; j <= RADIAL; j++) {
        const v = (j / RADIAL) * Math.PI * 2;
        const c = Math.cos(v), s = Math.sin(v);
        const nx = c * _n.x + s * _b.x, ny = c * _n.y + s * _b.y, nz = c * _n.z + s * _b.z;
        const k = (i * VROW + j) * 3;
        hairPos[k] = p.x + HAIR_R * nx;
        hairPos[k + 1] = p.y + HAIR_R * ny;
        hairPos[k + 2] = p.z + HAIR_R * nz;
        hairNrm[k] = nx;
        hairNrm[k + 1] = ny;
        hairNrm[k + 2] = nz;
      }
    }
    hairGeo.attributes.position.needsUpdate = true;
    hairGeo.attributes.normal.needsUpdate = true;
  }

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
  return { cage, fixed, update, balance, fork, escSub, hairGroup, cageR,
           setCageOpacity, setTopPlateVisible, cagePlates, cagePillars, topPlateGroup, bottomPlateGroup };
}

function mod(a, m) { return ((a % m) + m) % m; }
