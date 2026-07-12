import * as THREE from 'three';
import { makeGear, makeEscapeWheel, makeHand, makeSpiralRibbon, makeBevelGear } from './gear.js';
import { buildEscapement } from './escapement.js';

// ── Параметри механізму ───────────────────────────────────────────
const M = 0.35;        // модуль зубців (спільний для всіх зчеплень)
const WHEEL_T = 0.7;   // товщина коліс
const PINION_T = 1.2;  // товщина трібів (довші, бо зчеплення на іншій площині)
const Z_STEP = 1.1;    // крок між z-площинами сусідніх вузлів
const AXLE_R = 0.3;    // радіус осей

/**
 * Колісна передача: кожен вузол (arbor) несе тріб (ведений попереднім
 * колесом) та власне колесо (веде наступний тріб). Барабан має лише колесо,
 * анкерний вузол — тріб + анкерне колесо (поки заглушка, спуск у Фазі 3).
 */
const TRAIN = [
  { name: 'Барабан',           wheel: 48, axleTop: 2.3, crossings: 5 },    // вище — трубки диференціала запасу ходу
  { name: 'Центральне колесо', pinion: 12, wheel: 40, crossings: 4, axleTop: 7.4 }, // вісь до канонного триба
  { name: 'Проміжне колесо',   pinion: 12, wheel: 36, crossings: 4 },
  { name: 'Секундне колесо',   pinion: 12, wheel: 32, crossings: 3, axleTop: 5.15 }, // вісь під секундну стрілку
  { name: 'Анкерне колесо',    pinion: 12, escapeTeeth: 15 },
];

// Напрям (у площині XY) від осі k до осі k+1 — передачу скручено в тісну петлю
// (компактна компоновка): кожен крок повертає сильніше, тож хвіст майже змикається
// з барабаном. Колеса лежать на різних Z-площинах, тож перекриття по XY безпечне.
const MESH_ANGLES = [0, 78, 150, 214].map((d) => (d * Math.PI) / 180);

const pitchR = (z) => (M * z) / 2;
const mod = (a, m) => ((a % m) + m) % m;

/**
 * Початкова фаза веденого триба: його зубець має стояти у западині ведучого
 * колеса вздовж лінії центрів (theta — напрям від ведучого до веденого).
 * Виводиться з умови: коли западина ведучого дивиться на theta, зубець
 * веденого дивиться на theta + PI.
 */
function meshPhase(theta, ZA, ZB, phiA) {
  const stepA = (2 * Math.PI) / ZA;
  const stepB = (2 * Math.PI) / ZB;
  const tau = mod(theta - phiA, stepA); // докрут ведучого до вирівнювання западини
  return theta + Math.PI - stepB / 2 + (ZA / ZB) * tau;
}

export function buildMovement({ brass, steel, axleMat, ruby, springMat, plateMat, bluedMat, springSteel }) {
  const root = new THREE.Group();
  const arbors = [];
  const handRefs = {};

  // ── Розстановка осей + кінематика (швидкість і фаза кожного вузла) ──
  let pos = new THREE.Vector2(0, 0);
  TRAIN.forEach((spec, k) => {
    let omega = 1; // швидкість відносно барабана (барабан = 1)
    let phi = 0;
    if (k > 0) {
      const prev = arbors[k - 1];
      const ZA = TRAIN[k - 1].wheel;
      const ZB = spec.pinion;
      const theta = MESH_ANGLES[k - 1];
      const d = pitchR(ZA) + pitchR(ZB); // міжосьова відстань по ділильних колах
      pos = prev.pos
        .clone()
        .add(new THREE.Vector2(Math.cos(theta), Math.sin(theta)).multiplyScalar(d));
      omega = -prev.omega * (ZA / ZB); // зовнішнє зчеплення міняє напрям
      phi = meshPhase(theta, ZA, ZB, prev.phi);
    }
    arbors.push({
      name: spec.name,
      spec,
      pos,
      omega,
      phi,
      pinionZ: (k - 1) * Z_STEP, // тріб у площині колеса попереднього вузла
      wheelZ: k * Z_STEP,
    });
  });

  // ── Розкладка спуску: анкер і баланс продовжують дугу механізму ──
  const ESC_R = 4.9; // зовнішній радіус анкерного колеса
  const escDir = (330 * Math.PI) / 180; // спуск дивиться всередину петлі
  const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));
  const escPos = arbors[4].pos;
  const anchorPos = escPos.clone().add(dir2(escDir).multiplyScalar(7.0));
  const balancePos = anchorPos.clone().add(dir2(escDir).multiplyScalar(5.5)); // баланс тулиться в порожнину петлі (свій Z-шар)

  // ── Розкладка моторного механізму (стрілки) і заведення ──
  // Канонний тріб (12) → хвилинне колесо (36); тріб хвилинного (10) → годинне (40) → ×12.
  const P1 = arbors[1].pos;
  const MW_M1 = 0.28;                  // модуль пари канон → хвилинне
  const MW_M2 = (MW_M1 * 48) / 50;     // модуль пари тріб → годинне (та сама міжосьова)
  const MW_ANGLE = (120 * Math.PI) / 180; // хвилинне колесо — над петлею (Z-шар 7.2)
  const mwPos = P1.clone().add(dir2(MW_ANGLE).multiplyScalar(((12 + 36) / 2) * MW_M1));
  // Центральна секунда: додатковий верхній місток від секундного колеса до центру.
  const CS_DRIVE = 48, CS_IDLER = 20, CS_PINION = 8;
  const csFrom = arbors[3].pos;
  const csTo = P1;
  const csVec = csTo.clone().sub(csFrom);
  const csDist = csVec.length();
  const CS_M = csDist / (((CS_DRIVE + CS_PINION) / 2) + CS_IDLER);
  const csDir = csVec.clone().normalize();
  const csIdlerPos = csFrom.clone().add(csDir.multiplyScalar(((CS_DRIVE + CS_IDLER) / 2) * CS_M));
  const csTheta1 = Math.atan2(csIdlerPos.y - csFrom.y, csIdlerPos.x - csFrom.x);
  const csTheta2 = Math.atan2(csTo.y - csIdlerPos.y, csTo.x - csIdlerPos.x);
  const csRatio = CS_DRIVE / CS_PINION; // 6×: секундна вісь → центральна секундна вісь
  // Заведення: храповик на осі барабана → коронне колесо → вал із заводною головкою.
  const RATCH_M = 0.33;
  const CW_ANGLE = (225 * Math.PI) / 180;
  const cwPos = arbors[0].pos.clone().add(dir2(CW_ANGLE).multiplyScalar(((28 + 18) / 2) * RATCH_M));
  const bevelPinionPos = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(2.64)); // центр вінця конічного триба (для меж)
  const crownPos = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(5.6));        // головка на периферії, поза барабаном
  // Індикатор запасу ходу: КОАКСІАЛЬНИЙ диференціал НАД БАРАБАНОМ.
  // Обидва входи вже на осі барабана: храповик (w) веде верхнє сонце напряму
  // (RA = 1), барабанне колесо (β) — нижнє сонце через ×4 передачу:
  // маточинне колесо (32) → компаунд-проміжне (тріб 8 + колесо 20) → колесо
  // на трубці нижнього сонця (20). Міжосьова однакова для обох пар:
  // (32+8)·m/2 = (20+20)·m/2 = 6.0.
  const PRT_M = 0.3;
  const PRT_HUB = 32, PRT_P = 8, PRT_W = 20, PRT_G = 20;
  const RA = 1;                                   // храповик → верхнє сонце (пряма трубка)
  const RB = (PRT_HUB / PRT_P) * (PRT_W / PRT_G); // барабан → нижнє сонце = 4
  const prtIdlerPos = arbors[0].pos.clone()
    .add(dir2((160 * Math.PI) / 180).multiplyScalar(((PRT_HUB + PRT_P) / 2) * PRT_M));

  // ── Центрування механізму навколо початку координат ──
  const outerR = (s) => (s.escapeTeeth ? ESC_R + 0.3 : pitchR(s.wheel) + M * 1.3);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const extents = [
    ...arbors.map((a) => ({ pos: a.pos, r: outerR(a.spec) })),
    { pos: anchorPos, r: 1.5 },
    { pos: balancePos, r: 3.8 },
    { pos: P1, r: 7.9 },        // розмах найдовшої центральної стрілки (секундної)
    { pos: mwPos, r: 5.6 },     // хвилинне колесо
    { pos: csFrom, r: (CS_DRIVE * CS_M) / 2 + CS_M * 1.3 }, // ведуче колесо центральної секунди
    { pos: csIdlerPos, r: (CS_IDLER * CS_M) / 2 + CS_M * 1.3 },
    { pos: cwPos, r: 3.4 },          // коронне + конічне колесо
    { pos: bevelPinionPos, r: 1.3 }, // конічний триб на валу
    { pos: crownPos, r: 1.5 },       // заводна головка
    { pos: prtIdlerPos, r: ((PRT_W * PRT_M) / 2) + PRT_M * 1.3 }, // компаунд-проміжне запасу ходу
  ];
  for (const e of extents) {
    minX = Math.min(minX, e.pos.x - e.r); maxX = Math.max(maxX, e.pos.x + e.r);
    minY = Math.min(minY, e.pos.y - e.r); maxY = Math.max(maxY, e.pos.y + e.r);
  }
  root.position.set(-(minX + maxX) / 2, -(minY + maxY) / 2, 0);
  const size = { w: maxX - minX, h: maxY - minY };

  // ── Меші ──
  let mainspring = null, mainspringOuterR = 0; // пружина барабана + її зовн. радіус у розслабленому стані
  arbors.forEach((a, k) => {
    const g = new THREE.Group();
    g.position.set(a.pos.x, a.pos.y, 0);

    if (a.spec.pinion) {
      const p = makeGear(
        { teeth: a.spec.pinion, module: M, thickness: PINION_T, bore: AXLE_R * 0.9 },
        steel
      );
      p.position.z = a.pinionZ;
      g.add(p);
    }
    if (a.spec.wheel) {
      const w = makeGear(
        { teeth: a.spec.wheel, module: M, thickness: WHEEL_T, bore: AXLE_R * 0.9, crossings: a.spec.crossings || 0 },
        brass
      );
      w.position.z = a.wheelZ;
      g.add(w);
    }
    if (a.spec.escapeTeeth) {
      const e = makeEscapeWheel(
        { teeth: a.spec.escapeTeeth, outerR: ESC_R, rootR: 3.8, thickness: 0.5, bore: AXLE_R * 0.9 },
        brass
      );
      e.position.z = a.wheelZ;
      // Фазування: при E=0 вістря зубця стоїть проти вхідної палети
      // (світовий кут колеса = phi + E, палета на escDir + 30°).
      const stepE = (2 * Math.PI) / a.spec.escapeTeeth;
      e.rotation.z = mod(escDir + Math.PI / 6 - a.phi, stepE);
      g.add(e);
    }
    if (k === 0) {
      // Відкритий барабан пружини — видно змотаний мейнспринг усередині.
      const R = pitchR(48) - 1.2; // 7.2 — внутрішній радіус барабана
      const zC = -1.5, drumH = 2.0;
      // Стінка барабана — відкритий циліндр (без кришки), отвір дивиться на +Z.
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R, drumH, 48, 1, true),
        brass
      );
      wall.rotation.x = Math.PI / 2;
      wall.position.z = zC;
      wall.castShadow = true;
      wall.receiveShadow = true;
      g.add(wall);
      // Дно барабана (дальня грань, −Z).
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.2, 48), brass);
      floor.rotation.x = Math.PI / 2;
      floor.position.z = zC - drumH / 2 + 0.1;
      floor.receiveShadow = true;
      g.add(floor);
      // Втулка барабанної осі, навколо якої змотана пружина.
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, drumH * 0.9, 24), steel);
      core.rotation.x = Math.PI / 2;
      core.position.z = zC;
      core.castShadow = true;
      g.add(core);
      // Мейнспринг — спіральна стрічка від втулки до стінки (стан задає setShape).
      mainspringOuterR = R - 0.4;
      const spring = makeSpiralRibbon({ height: drumH - 0.5, segments: 600 }, springSteel);
      spring.position.z = zC;
      spring.userData.setShape({ innerR: 1.05, outerR: mainspringOuterR, turns: 3.4 }); // розслаблена
      g.add(spring);
      mainspring = spring;
    }

    // Вісь: від нижньої до верхньої деталі вузла.
    const zFrom = k === 0 ? -2.6 : a.pinionZ - 1.0;
    const zTo = a.spec.axleTop ?? a.wheelZ + 1.0;
    const axle = new THREE.Mesh(
      new THREE.CylinderGeometry(AXLE_R, AXLE_R, zTo - zFrom, 20),
      axleMat
    );
    axle.rotation.x = Math.PI / 2;
    axle.position.z = (zFrom + zTo) / 2;
    axle.castShadow = true;
    g.add(axle);

    root.add(g);
    a.group = g;
  });

  // ── Спусковий вузол (анкер + баланс) ──
  const escapement = buildEscapement(
    { brass, steel, ruby, springMat, axleMat },
    {
      wheelPos: escPos,
      dirAngle: escDir,
      wheelR: ESC_R,
      zW: arbors[4].wheelZ,
      anchorPos,
      balancePos,
      escTeeth: TRAIN[4].escapeTeeth,
    }
  );
  root.add(escapement.group);

  // ── Платина (задня плита) + рубінові камені під осями ──
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const plateMargin = 1.8;
  let plateR = Math.hypot(size.w, size.h) * 0.5 + plateMargin;
  for (const e of extents) {
    plateR = Math.max(plateR, Math.hypot(e.pos.x - cx, e.pos.y - cy) + e.r + plateMargin);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(plateR, plateR, 0.8, 96), plateMat);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(cx, cy, -3.2);
  plate.receiveShadow = true;
  root.add(plate);

  const jewelPts = [...arbors.map((a) => a.pos), anchorPos];
  if (Math.hypot(balancePos.x - cx, balancePos.y - cy) < plateR - 1) jewelPts.push(balancePos);
  for (const p of jewelPts) {
    const jewel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 20), ruby);
    jewel.rotation.x = Math.PI / 2;
    jewel.position.set(p.x, p.y, -2.65);
    root.add(jewel);
  }

  // ── Моторний механізм + стрілки ──
  // Канонний тріб і хвилинна стрілка сидять на осі центрального колеса
  // (обертаються з ним); годинне колесо — коаксіально, у 12 разів повільніше.
  const Z_MW = 7.2, Z_HR = 7.9;
  const phi1 = arbors[1].phi;

  const cannonSub = new THREE.Group(); // канонний тріб + трубка + хвилинна стрілка
  {
    const cannon = makeGear({ teeth: 12, module: MW_M1, thickness: 0.8, bore: AXLE_R * 0.9 }, steel);
    cannon.position.z = Z_MW;
    cannonSub.add(cannon);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3.1, 16), steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = 8.7; // подовжений канонний вал до верху
    cannonSub.add(pipe);
    const minuteHandG = new THREE.Group();
    const minuteHand = makeHand({ length: 7.0, width: 0.6 }, bluedMat);
    minuteHand.position.z = 10.25; // над годинною
    minuteHandG.add(minuteHand);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.28, 16), bluedMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 10.25;
    minuteHandG.add(hub);
    cannonSub.add(minuteHandG);
    handRefs.minute = minuteHandG;
  }
  arbors[1].group.add(cannonSub);

  const mwArbor = new THREE.Group(); // хвилинне колесо + його тріб
  mwArbor.position.set(mwPos.x, mwPos.y, 0);
  {
    const wheel = makeGear({ teeth: 36, module: MW_M1, thickness: 0.55, bore: 0.2, crossings: 4 }, brass);
    wheel.position.z = Z_MW;
    mwArbor.add(wheel);
    const pinion = makeGear({ teeth: 10, module: MW_M2, thickness: 0.7, bore: 0.2 }, steel);
    pinion.position.z = Z_HR;
    mwArbor.add(pinion);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.9, 16), axleMat);
    axle.rotation.x = Math.PI / 2;
    axle.position.z = (Z_MW + Z_HR) / 2 + 0.05;
    mwArbor.add(axle);
  }
  root.add(mwArbor);

  const hourGroup = new THREE.Group(); // годинне колесо + годинна стрілка
  hourGroup.position.set(P1.x, P1.y, 0);
  {
    const wheel = makeGear({ teeth: 40, module: MW_M2, thickness: 0.5, bore: 0.68, crossings: 4 }, brass);
    wheel.position.z = Z_HR;
    hourGroup.add(wheel);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.0, 16), brass);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = 8.9; // подовжений годинний вал — стрілку винесено на верх
    hourGroup.add(pipe);
    const hourHandG = new THREE.Group();
    const hourHand = makeHand({ length: 5.6, width: 0.7 }, bluedMat);
    hourHand.position.z = 9.9; // над усіма колесами (найвище z≈9.45)
    hourHandG.add(hourHand);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.24, 16), bluedMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 9.9;
    hourHandG.add(hub);
    hourGroup.add(hourHandG);
    handRefs.hour = hourHandG;
  }
  root.add(hourGroup);

  // Фазування моторних зчеплень (та сама умова «зубець у западину»).
  const phiMW = meshPhase(MW_ANGLE, 12, 36, phi1);
  const phiHW = meshPhase(MW_ANGLE + Math.PI, 10, 40, phiMW);

  // Центральна секундна передача: секундне колесо → проміжне → центральний тріб.
  const Z_CS = 9.45;
  const csDriveGear = makeGear(
    { teeth: CS_DRIVE, module: CS_M, thickness: 0.45, bore: AXLE_R * 0.9, crossings: 4 },
    brass
  );
  csDriveGear.position.z = Z_CS;
  arbors[3].group.add(csDriveGear);

  const csDriveAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5.8, 16), axleMat);
  csDriveAxle.rotation.x = Math.PI / 2;
  csDriveAxle.position.z = 7.2;
  arbors[3].group.add(csDriveAxle);

  const csIdlerGroup = new THREE.Group();
  csIdlerGroup.position.set(csIdlerPos.x, csIdlerPos.y, 0);
  {
    const idler = makeGear(
      { teeth: CS_IDLER, module: CS_M, thickness: 0.45, bore: 0.18, crossings: 3 },
      steel
    );
    idler.position.z = Z_CS;
    csIdlerGroup.add(idler);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.5, 14), axleMat);
    axle.rotation.x = Math.PI / 2;
    axle.position.z = Z_CS;
    csIdlerGroup.add(axle);
  }
  root.add(csIdlerGroup);

  const centralSecondsGroup = new THREE.Group();
  centralSecondsGroup.position.set(P1.x, P1.y, 0);
  {
    const pinion = makeGear({ teeth: CS_PINION, module: CS_M, thickness: 0.55, bore: 0.18 }, steel);
    pinion.position.z = Z_CS;
    centralSecondsGroup.add(pinion);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.2, 16), steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = 10.0;
    centralSecondsGroup.add(pipe);

    const secondHandG = new THREE.Group();
    const secondHand = makeHand({ length: 7.4, width: 0.32, tail: 0.18 }, bluedMat);
    secondHand.position.z = 10.7; // лишається зверху над хвилинною
    secondHandG.add(secondHand);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.24, 16), bluedMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 10.7;
    secondHandG.add(hub);
    centralSecondsGroup.add(secondHandG);
    handRefs.second = secondHandG;
  }
  root.add(centralSecondsGroup);

  const phiCSIdler = meshPhase(csTheta1, CS_DRIVE, CS_IDLER, arbors[3].phi);
  const phiCSCenter = meshPhase(csTheta2, CS_IDLER, CS_PINION, phiCSIdler);

  // ── Заведення: храповик → коронне колесо → КОНІЧНА пара → горизонтальний вал → головка ──
  const winderGroup = new THREE.Group();
  const WIND_Z = 2.6; // палуба заведення піднята над маточинним колесом диференціала (z 1.85)

  // Храповик на осі барабана (тримається собачкою).
  const ratchetG = new THREE.Group();
  ratchetG.position.set(arbors[0].pos.x, arbors[0].pos.y, 0);
  const ratchet = makeGear({ teeth: 28, module: RATCH_M, thickness: 0.5, bore: AXLE_R * 0.9, crossings: 4 }, steel);
  ratchet.position.z = WIND_Z;
  ratchetG.add(ratchet);
  winderGroup.add(ratchetG);

  // Коронний вузол: плоске коронне колесо (зчеплене з храповиком) + конічне
  // колесо коаксіально зверху (приймає обертання від заводного вала під 90°).
  //
  // Конічна пара 90°, як у реальному заведенні: кути ділильних конусів
  // доповнюють один одного (δ_w + δ_p = 90°, tan δ_w = Zw/Zp), а вершини обох
  // конусів сходяться в одній точці на перетині осей (Z_APEX на осі коронного
  // вузла) — тоді конуси дотикаються вздовж спільної твірної і «обіймають»
  // один одного, а не торкаються краями.
  const BEVEL_W = 16, BEVEL_P = 8; // 2:1
  const DELTA_W = Math.atan(BEVEL_W / BEVEL_P); // ≈63.4° — конічне колесо
  const DELTA_P = Math.atan(BEVEL_P / BEVEL_W); // ≈26.6° — триб на валу
  const Z_APEX = WIND_Z + 0.35;                 // спільна вершина конусів
  const stepBW = (2 * Math.PI) / BEVEL_W, stepBP = (2 * Math.PI) / BEVEL_P;

  const cwG = new THREE.Group();
  cwG.position.set(cwPos.x, cwPos.y, 0);
  const crownWheel = makeGear({ teeth: 18, module: RATCH_M, thickness: 0.5, bore: 0.2 }, steel);
  crownWheel.position.z = WIND_Z;
  cwG.add(crownWheel);
  const phiCW = meshPhase(CW_ANGLE, 28, 18, 0);
  const bevelWheel = makeBevelGear(
    { teeth: BEVEL_W, module: RATCH_M, thickness: 0.45, bore: 0.2, pitchAngleDeg: (DELTA_W * 180) / Math.PI },
    steel
  );
  bevelWheel.position.z = Z_APEX;
  bevelWheel.rotation.z = mod(CW_ANGLE - phiCW, stepBW); // западина — проти лінії контакту
  cwG.add(bevelWheel);
  const cwAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.0, 12), axleMat);
  cwAxle.rotation.x = Math.PI / 2;
  cwAxle.position.z = WIND_Z + 0.5;
  cwG.add(cwAxle);
  cwG.rotation.z = phiCW;
  winderGroup.add(cwG);

  // Собачка (клік) — тримає храповик.
  {
    const clickPivot = arbors[0].pos.clone().add(dir2((120 * Math.PI) / 180).multiplyScalar(6.0));
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 12), axleMat);
    post.rotation.x = Math.PI / 2;
    post.position.set(clickPivot.x, clickPivot.y, WIND_Z - 0.4);
    winderGroup.add(post);
    const tip = arbors[0].pos.clone().add(dir2((104 * Math.PI) / 180).multiplyScalar(4.45));
    const d = tip.clone().sub(clickPivot);
    const clickBar = new THREE.Mesh(new THREE.BoxGeometry(d.length(), 0.32, 0.3), steel);
    clickBar.position.set((clickPivot.x + tip.x) / 2, (clickPivot.y + tip.y) / 2, WIND_Z);
    clickBar.rotation.z = Math.atan2(d.y, d.x);
    winderGroup.add(clickBar);
  }

  // Конічний триб на валу: вершина його конуса — у ТІЙ САМІЙ точці Z_APEX на осі
  // коронного вузла (спільний апекс пари), вісь горизонтальна, дивиться назовні
  // до головки. Вінець триба сам стає на своє місце: axial = R_p/tan(δ_p) = 2.64.
  const stemDir = new THREE.Vector3(Math.cos(CW_ANGLE), Math.sin(CW_ANGLE), 0);
  const pinionG = new THREE.Group();
  pinionG.position.set(cwPos.x, cwPos.y, Z_APEX);
  pinionG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), stemDir);
  const bevelPinion = makeBevelGear(
    { teeth: BEVEL_P, module: RATCH_M, thickness: 0.6, bore: 0.15, pitchAngleDeg: (DELTA_P * 180) / Math.PI },
    steel
  );
  const PSI_P = mod(CW_ANGLE + Math.PI - stepBP / 2, stepBP); // зубець триба — у западину колеса
  bevelPinion.rotation.z = PSI_P;
  pinionG.add(bevelPinion);
  winderGroup.add(pinionG);

  // Горизонтальний вал від триба до головки + сама головка (на периферії).
  const stemStart = cwPos.clone().add(dir2(CW_ANGLE).multiplyScalar(2.2));
  const stemMid = stemStart.clone().add(crownPos).multiplyScalar(0.5);
  const stemLen = crownPos.clone().sub(stemStart).length() + 0.6;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, stemLen, 12), axleMat);
  stem.rotation.z = CW_ANGLE - Math.PI / 2;
  stem.position.set(stemMid.x, stemMid.y, Z_APEX);
  winderGroup.add(stem);

  const crownOrient = new THREE.Group();
  crownOrient.position.set(crownPos.x, crownPos.y, Z_APEX);
  crownOrient.rotation.z = CW_ANGLE - Math.PI / 2;
  const knurl = steel.clone();
  knurl.flatShading = true;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.5, 14), knurl);
  crown.castShadow = true;
  crownOrient.add(crown);
  winderGroup.add(crownOrient);
  root.add(winderGroup);

  // ── Індикатор запасу ходу: КОАКСІАЛЬНИЙ ДИФЕРЕНЦІАЛ НАД БАРАБАНОМ ──
  // Класика: S_up + S_low = 2·водило. Весь вузол сидить на осі барабана —
  // обидва входи вже там: храповик (w) веде верхнє сонце прямою трубкою
  // (RA = 1), барабанне колесо (β) — нижнє через маточинне колесо (32) →
  // компаунд-проміжне (8/20) → колесо трубки нижнього сонця (20), RB = 4.
  // Стрілка на водилі-«клітці», кільцева шкала висить просто над барабаном.
  // Заряд ПОХІДНИЙ: c(w, β) = c₀ + (RA·w − RB·β) / (2·SWEEP)
  const PR_EMPTY = (150 * Math.PI) / 180;
  const PR_FULL = (30 * Math.PI) / 180;
  const SWEEP = PR_EMPTY - PR_FULL; // 120°
  const DIFF_M = 0.28;              // модуль конічних коліс диференціала
  const SUN_T = 16, PLANET_T = 10;  // δ_сонця = atan(16/10) ≈ 58°, δ_планети ≈ 32°
  const DELTA_SUN = Math.atan(SUN_T / PLANET_T);
  const DELTA_PL = Math.atan(PLANET_T / SUN_T);
  const Z_DIFF = 5.8;               // спільний апекс сонць/планет — над храповиком і передавальними колесами

  const powerReserveGroup = new THREE.Group();
  powerReserveGroup.position.set(arbors[0].pos.x, arbors[0].pos.y, 0);

  // Маточинне колесо (вхід ходу, β) — на трубці барабанного колеса, під храповиком.
  {
    const hubWheel = makeGear({ teeth: PRT_HUB, module: PRT_M, thickness: 0.5, bore: 0.62, crossings: 4 }, brass);
    hubWheel.position.z = 1.85;
    arbors[0].group.add(hubWheel);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.3, 12), brass);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = 1.05;
    arbors[0].group.add(pipe);
  }

  // Компаунд-проміжне: тріб (8, площина маточинного) + колесо (20, площина g20).
  const prIdlerG = new THREE.Group();
  prIdlerG.position.set(prtIdlerPos.x - arbors[0].pos.x, prtIdlerPos.y - arbors[0].pos.y, 0);
  {
    const p = makeGear({ teeth: PRT_P, module: PRT_M, thickness: 0.5, bore: 0.14 }, steel);
    p.position.z = 1.85;
    prIdlerG.add(p);
    const w = makeGear({ teeth: PRT_W, module: PRT_M, thickness: 0.5, bore: 0.14, crossings: 3 }, steel);
    w.position.z = 3.3;
    prIdlerG.add(w);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.1, 10), axleMat);
    post.rotation.x = Math.PI / 2;
    post.position.z = 2.45;
    prIdlerG.add(post);
  }
  powerReserveGroup.add(prIdlerG);

  // Нижнє сонце + колесо його трубки (вхід ходу ×4).
  const slowG = new THREE.Group();
  {
    const sun = makeBevelGear(
      { teeth: SUN_T, module: DIFF_M, thickness: 0.4, bore: 0.72, pitchAngleDeg: (DELTA_SUN * 180) / Math.PI },
      steel
    );
    sun.position.z = Z_DIFF;
    sun.rotation.x = Math.PI; // перевернуте: вінець знизу (z≈4.4), зубці до планет
    slowG.add(sun);
    const g = makeGear({ teeth: PRT_G, module: PRT_M, thickness: 0.5, bore: 0.72, crossings: 3 }, steel);
    g.position.z = 3.3;
    slowG.add(g);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 1.6, 14), steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = 4.2;
    slowG.add(pipe);
  }
  powerReserveGroup.add(slowG);

  // Верхнє сонце — на трубці від храповика (вхід заведення, RA = 1).
  const supG = new THREE.Group();
  {
    const sun = makeBevelGear(
      { teeth: SUN_T, module: DIFF_M, thickness: 0.4, bore: 0.5, pitchAngleDeg: (DELTA_SUN * 180) / Math.PI },
      steel
    );
    sun.position.z = Z_DIFF; // апекс у центрі, вінець зверху (z≈7.2)
    supG.add(sun);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.3, 12), steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.z = 4.55; // від храповика (2.9) до сонця (6.2)
    supG.add(pipe);
  }
  powerReserveGroup.add(supG);

  // Водило-«клітка»: кільце навколо сонць, стійки, місток над верхнім сонцем,
  // вал зі стрілкою; планети на внутрішніх цапфах (не перетинають центр).
  const carrierG = new THREE.Group();
  const planetMeshes = [];
  {
    const cage = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.12, 10, 48), axleMat);
    cage.position.z = Z_DIFF;
    carrierG.add(cage);
    for (const s of [+1, -1]) {
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.75, 10), axleMat);
      stub.rotation.z = Math.PI / 2;
      stub.position.set(s * 1.97, 0, Z_DIFF);
      carrierG.add(stub);
      const pg = new THREE.Group();
      pg.position.z = Z_DIFF;
      pg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(s, 0, 0));
      const planet = makeBevelGear(
        { teeth: PLANET_T, module: DIFF_M, thickness: 0.38, bore: 0.4, pitchAngleDeg: (DELTA_PL * 180) / Math.PI },
        brass
      );
      planet.userData.dir = s;
      pg.add(planet);
      planetMeshes.push(planet);
      carrierG.add(pg);
      const postV = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.15, 10), axleMat);
      postV.rotation.x = Math.PI / 2;
      postV.position.set(s * 3.35, 0, Z_DIFF + 1.08);
      carrierG.add(postV);
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.24, 0.12), axleMat);
    arm.position.z = Z_DIFF + 2.15; // місток над верхнім сонцем (7.95)
    carrierG.add(arm);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.9, 12), axleMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = Z_DIFF + 2.6;
    carrierG.add(shaft);
    const hand = makeHand({ length: 2.5, width: 0.32, tail: 0.3 }, bluedMat);
    hand.position.z = Z_DIFF + 3.05; // 8.85 — над шкалою
    carrierG.add(hand);
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 14), bluedMat);
    hubCap.rotation.x = Math.PI / 2;
    hubCap.position.z = Z_DIFF + 3.05;
    carrierG.add(hubCap);
  }
  powerReserveGroup.add(carrierG);

  // Кільцева шкала — висить просто над барабаном (відкритий центр: диференціал видно).
  {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 3.05, 48), plateMat);
    ring.position.z = Z_DIFF + 2.75; // 8.55
    powerReserveGroup.add(ring);
    const arc = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.85, 48, 1, PR_FULL, SWEEP), brass);
    arc.position.z = Z_DIFF + 2.77;
    powerReserveGroup.add(arc);
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const a = PR_EMPTY - SWEEP * f;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.06), f === 0 ? ruby : steel);
      tick.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, Z_DIFF + 2.81);
      tick.rotation.z = a;
      powerReserveGroup.add(tick);
    }
  }
  root.add(powerReserveGroup);

  // Фазування пар входу ходу (та сама умова «зубець у западину»).
  const thHI = Math.atan2(prtIdlerPos.y - arbors[0].pos.y, prtIdlerPos.x - arbors[0].pos.x);
  const phiP8 = meshPhase(thHI, PRT_HUB, PRT_P, arbors[0].phi); // маточинне (β) → тріб компаунда
  const phiG20 = meshPhase(thHI + Math.PI, PRT_W, PRT_G, phiP8); // колесо компаунда → трубка сонця
  // Водило: стала обрана так, щоб початковий заряд = 0.75 (стрілка на 60°).
  const KC = (PR_EMPTY - 0.75 * SWEEP) - phiG20 / 2;

  // Анімація заведення: головка і храповик крутяться, барабанне колесо — ні
  // (в реальності заводиться вісь барабана відносно його корпуса), а пружина
  // стискається — витки ущільнюються й трохи відходять від стінки барабана.
  // Завод — ПОХІДНИЙ від диференціала (жодної окремої змінної стану):
  //   c(w, β) = c₀ + (RA·w − RB·β) / (2·SWEEP),
  // де w — кут храповика (заведення), β — кут барабанного колеса (хід).
  // Заведення крутить верхнє сонце (нижнє тримає передача), хід — нижнє
  // (верхнє тримає собачка); водило-стрілка показує різницю.
  let windPending = 0, windAngle = 0, crownSpin = 0, lastDrive = 0;
  const chargeOf = () => 0.75 + (RA * windAngle - RB * lastDrive) / (2 * SWEEP);

  // Синхронізація диференціала, стрілки та пружини зі станом (w, β).
  function syncDiff() {
    // RA = 1: верхнє сонце прямо на трубці храповика. Знак «−»: реверс, що його
    // раніше давала зубчаста пара, тепер у напрямі обертання осі заведення
    // (вісь контр-обертається відносно ходу барабанного колеса).
    supG.rotation.z = -windAngle;
    prIdlerG.rotation.z = phiP8 - (PRT_HUB / PRT_P) * lastDrive;
    slowG.rotation.z = phiG20 + RB * lastDrive;
    carrierG.rotation.z = (supG.rotation.z + slowG.rotation.z) / 2 + KC; // умова диференціала
    const spin = ((supG.rotation.z - slowG.rotation.z) / 2) * (SUN_T / PLANET_T);
    for (const p of planetMeshes) p.rotation.z = spin * p.userData.dir;
    const c = Math.min(1, Math.max(0, chargeOf()));
    if (mainspring) {
      mainspring.userData.setShape({
        innerR: 1.05,
        outerR: mainspringOuterR - 1.2 * c, // тугіша пружина відходить від стінки
        turns: 3.4 + 3.6 * c,               // більше витків = щільніший пакет
      });
    }
  }

  const winder = {
    group: winderGroup,
    ratchet: ratchetG,
    get charge() { return Math.min(1, Math.max(0, chargeOf())); },
    wind() { windPending += Math.PI / 2; }, // один «клік» = чверть оберту храповика (+0.375 заряду при RA=1)
    update(dt) {
      if (windPending <= 0) return;
      let d = Math.min(dt * 5, windPending);
      // Упор повного заводу: головка перестає споживати оберти при c = 1.
      const maxDw = Math.max(0, ((1 - chargeOf()) * 2 * SWEEP) / RA);
      if (d >= maxDw) { d = maxDw; windPending = 0; } else windPending -= d;
      if (d <= 0) return;
      windAngle += d;
      ratchetG.rotation.z = -windAngle; // контр-обертання (див. syncDiff)
      cwG.rotation.z = phiCW + windAngle * (28 / 18);       // коронне + конічне колесо
      crownSpin += d * (28 / 18) * (BEVEL_W / BEVEL_P);     // вал: конічне колесо (16) → триб (8) = ×2
      bevelPinion.rotation.z = PSI_P - crownSpin;            // конічний триб на валу
      crown.rotation.y = -crownSpin;                         // головка на тій самій осі
      syncDiff();
    },
  };

  // ── Точки фокуса (для підписів і пресетів камери) ──
  const focusPoints = [
    ...arbors.map((a) => ({ name: a.name, pos: a.pos, z: a.wheelZ, r: outerR(a.spec) })),
    { name: 'Анкер', pos: anchorPos, z: arbors[4].wheelZ, r: 2.2 },
    { name: 'Баланс', pos: balancePos, z: arbors[4].wheelZ + 1.3, r: 3.6 },
    { name: 'Стрілки', pos: P1, z: 10.0, r: 4.5 },
    { name: 'Заведення', pos: cwPos, z: 2.0, r: 4.5 },
    { name: 'Запас ходу', pos: arbors[0].pos, z: 8.6, r: 3.2 },
  ];

  // ── Кінематика: кут кожного вузла з кута барабана ──
  function update(driveAngle) {
    lastDrive = driveAngle; // β для диференціала запасу ходу
    for (const a of arbors) a.group.rotation.z = a.phi + a.omega * driveAngle;
    handRefs.hour.rotation.z = 0;
    handRefs.minute.rotation.z = 0;
    handRefs.second.rotation.z = 0;
    // Моторний механізм: від центрального колеса (канон = вісь центрального).
    const dR1 = arbors[1].omega * driveAngle; // R1 - phi1
    mwArbor.rotation.z = phiMW - (12 / 36) * dR1;
    hourGroup.rotation.z = phiHW + (10 / 40) * (12 / 36) * dR1; // = центральне / 12

    // Центральна секунда: дві зовнішні пари зчеплення зберігають напрям,
    // а 48→8 дає потрібний множник 6× від поточної секундної осі.
    const dR3 = arbors[3].omega * driveAngle;
    csIdlerGroup.rotation.z = phiCSIdler - (CS_DRIVE / CS_IDLER) * dR3;
    centralSecondsGroup.rotation.z = phiCSCenter + csRatio * dR3;

    syncDiff(); // диференціал запасу ходу (нижнє сонце живиться від β)
  }
  update(0);

  // Головний вхід: час → баланс/анкер → кут анкерного колеса → вся передача.
  function setTime(t, { beatHz, amplitude }) {
    const E = escapement.update(t, beatHz, amplitude);
    update(E / arbors[4].omega);
    return E;
  }

  function clockAngle(unit) {
    return Math.PI / 2 - unit * Math.PI * 2;
  }

  // Режим реального часу: спуск і вся передача рухаються від власного ходу
  // балансу (як у демо — анкерне колесо ↔ вилка зчеплені й коректні), а всі три
  // стрілки накладаються поверх на істинний час годинника через handRefs.
  // beatT — безперервна фаза ходу (реальний час), окремо від годинника на стрілках.
  function setClockTime(date, beatT, { beatHz, amplitude }) {
    // 1) Спуск веде передачу — точно тим самим шляхом, що й демо-режим.
    const E = escapement.update(beatT, beatHz, amplitude);
    // Автопідзавод: докручуємо храповик рівно так, щоб водило диференціала
    // (стрілка запасу ходу) стояло: dθ_C = 0 ⇔ dw = (RB/RA)·dβ.
    const nd = E / arbors[4].omega;
    if (nd > lastDrive) {
      windAngle += (RB / RA) * (nd - lastDrive);
      ratchetG.rotation.z = -windAngle; // контр-обертання (див. syncDiff)
    }
    update(nd);

    // 2) Стрілки накладаємо на істинний час (передача під ними «проковзує»).
    const h = date.getHours() % 12;
    const m = date.getMinutes();
    const s = date.getSeconds();
    const ms = date.getMilliseconds();
    const secondUnit = (s + ms / 1000) / 60;
    const minuteUnit = (m + secondUnit) / 60;
    const hourUnit = (h + minuteUnit) / 12;

    handRefs.second.rotation.z = clockAngle(secondUnit) - centralSecondsGroup.rotation.z;
    handRefs.minute.rotation.z = clockAngle(minuteUnit) - arbors[1].group.rotation.z;
    handRefs.hour.rotation.z = clockAngle(hourUnit) - hourGroup.rotation.z;
    return { secondUnit, minuteUnit, hourUnit };
  }

  return {
    root, arbors, update, setTime, setClockTime, escapement, size, focusPoints, winder,
    bounds: { minX, maxX, minY, maxY, cx, cy, plateR },
    centralSeconds: { drive: csDriveGear, idler: csIdlerGroup, center: centralSecondsGroup },
    motionWorks: { cannonSub, mwArbor, hourGroup, csDriveGear, csIdlerGroup, centralSecondsGroup },
    powerReserve: {
      group: powerReserveGroup, hand: carrierG, carrier: carrierG,
      sunUp: supG, sunLow: slowG, idler: prIdlerG,
      emptyAngle: PR_EMPTY, fullAngle: PR_FULL,
    },
  };
}
