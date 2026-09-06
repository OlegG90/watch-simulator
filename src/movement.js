import * as THREE from 'three';
import { TRAIN, layoutTrain, buildTrain, arborOuterR } from './train.js';
import { tagModule } from './common.js';
import { buildBarrel } from './barrel.js';
import { layoutMotionWorks, buildMotionWorks } from './motionWorks.js';
import { layoutWinding, buildWinding } from './winding.js';
import { layoutPowerReserve, buildPowerReserve, chargeOf, windRoomAt, autoWindDelta } from './powerReserve.js';
import { buildTourbillon } from './tourbillon.js';

const CAGE_R = 4.3;       // радіус кліті турбійона (перевірено прототипом на 170°)
const WIND_RATE = 5;      // швидкість анімації заведення, рад/с
const WIND_CLICK = Math.PI / 2; // один «клік» = чверть оберту храповика (+0.375 заряду)

/**
 * Складання механізму: розкладка → межі сцени → меші модулів → кінематика.
 *
 * Порядок важливий: спершу чиста геометрія розкладки (де що стоїть) — з неї
 * рахуються межі й радіус платини; аж потім будуються меші.
 *
 * Модулі (кожен у своєму файлі): `train` — колісна передача, `barrel` — енергія,
 * `motionWorks` — індикація часу, `winding` — заведення, `powerReserve` —
 * диференціал запасу ходу, `tourbillon` — спуск у обертовій кліті.
 */
export function buildMovement({ brass, steel, axleMat, ruby, springMat, plateMat, bluedMat, springSteel, backdropMat, cageMat }) {
  backdropMat = backdropMat || plateMat; // сумісність, якщо не передано
  cageMat = cageMat || plateMat;
  const root = new THREE.Group();
  const mats = { brass, steel, axleMat, ruby, springMat, plateMat, bluedMat, springSteel };

  // ── 1. Розкладка (без мешів) ──────────────────────────────────────
  const arbors = layoutTrain();
  const barrelPos = arbors[0].pos;
  const cagePos = arbors[4].pos;            // центр кліті = місце анкерного вузла
  const CAGE_ZBASE = arbors[4].wheelZ;      // низ кліті над передачею
  const mwL = layoutMotionWorks(arbors);
  const windL = layoutWinding(barrelPos);
  const prL = layoutPowerReserve(barrelPos);

  // ── 2. Межі сцени й центрування ───────────────────────────────────
  const extents = [
    ...arbors.map((a) => ({ pos: a.pos, r: arborOuterR(a.spec, CAGE_R) })),
    { pos: cagePos, r: CAGE_R }, // обертова кліть турбійона
    ...mwL.extents, ...windL.extents, ...prL.extents,
  ];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const e of extents) {
    minX = Math.min(minX, e.pos.x - e.r); maxX = Math.max(maxX, e.pos.x + e.r);
    minY = Math.min(minY, e.pos.y - e.r); maxY = Math.max(maxY, e.pos.y + e.r);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  root.position.set(-cx, -cy, 0);
  const size = { w: maxX - minX, h: maxY - minY };

  // ── 3. Меші модулів ───────────────────────────────────────────────
  buildTrain(mats, arbors, root);

  const barrel = buildBarrel(mats, { wheelTeeth: TRAIN[0].wheel });
  arbors[0].group.add(barrel.group);

  // Турбійон: кліть — дочірня до arbor4 (обертається на θ_cage), нерухоме
  // колесо — окремо в root, тож стоїть на місці.
  const tourbillon = buildTourbillon(
    { ...mats, plateMat: cageMat },
    { escTeeth: TRAIN[4].escapeTeeth, fixedTeeth: 10, pinionTeeth: 10, moduleT: 0.26, cageR: CAGE_R, escDirLocal: 0 }
  );
  tourbillon.cage.position.z = CAGE_ZBASE;
  arbors[4].group.add(tourbillon.cage);
  tourbillon.fixed.position.set(cagePos.x, cagePos.y, CAGE_ZBASE);
  root.add(tourbillon.fixed);

  const motionWorks = buildMotionWorks(mats, mwL, arbors, root);
  const winding = buildWinding(mats, windL, barrelPos);
  root.add(winding.group);
  const powerReserve = buildPowerReserve(
    { ...mats, plateMat }, prL,
    { barrelPos, barrelGroup: arbors[0].group, barrelPhi: arbors[0].phi }
  );
  root.add(powerReserve.group);

  // ── 4. Платина (задня плита) + рубінові камені під осями ──────────
  const plateMargin = 1.8;
  let plateR = Math.hypot(size.w, size.h) * 0.5 + plateMargin;
  for (const e of extents) {
    plateR = Math.max(plateR, Math.hypot(e.pos.x - cx, e.pos.y - cy) + e.r + plateMargin);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(plateR, plateR, 0.8, 96), backdropMat);
  plate.rotation.x = Math.PI / 2;
  plate.position.set(cx, cy, -3.2);
  plate.receiveShadow = true;
  tagModule(plate, 'plate');
  root.add(plate);
  for (const a of arbors) {
    const jewel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.4, 20), ruby);
    jewel.rotation.x = Math.PI / 2;
    jewel.position.set(a.pos.x, a.pos.y, -2.65);
    tagModule(jewel, 'plate');
    root.add(jewel);
  }

  // ── 5. Стан заводу (похідний) і кінематика ────────────────────────
  // Заряд не зберігається окремо: c(w, β) рахує диференціал із кута храповика (w)
  // та кута барабанного колеса (β). Тут тримаємо лише самі кути.
  let windAngle = 0, windPending = 0, lastDrive = 0;

  /** Синхронізація диференціала й форми пружини зі станом (w, β). */
  function syncCharge() {
    barrel.setCharge(powerReserve.update(windAngle, lastDrive));
  }

  const winder = {
    group: winding.group,
    ratchet: winding.ratchet,
    click: winding.click,
    get charge() { return Math.min(1, Math.max(0, chargeOf(windAngle, lastDrive))); },
    wind() { windPending += WIND_CLICK; },
    update(dt) {
      if (windPending <= 0) return;
      let d = Math.min(dt * WIND_RATE, windPending);
      // Упор повного заводу: головка перестає споживати оберти при c = 1.
      const room = windRoomAt(windAngle, lastDrive);
      if (d >= room) { d = room; windPending = 0; } else windPending -= d;
      if (d <= 0) return;
      windAngle += d;
      winding.setAngle(windAngle); // храповик + собачка + коронне/конічне/головка
      syncCharge();
    },
  };

  /** Кінематика: кут кожного вузла — з кута барабана (β). */
  function update(driveAngle) {
    lastDrive = driveAngle;
    for (const a of arbors) a.group.rotation.z = a.phi + a.omega * driveAngle;
    motionWorks.resetHands();
    motionWorks.update(arbors[1].omega * driveAngle, arbors[3].omega * driveAngle);
    syncCharge();
  }
  update(0);

  // Головний вхід: час → баланс/спуск у кліті → кут кліті θ_cage → вся передача.
  // θ_cage = β (Zf = Zp), і arbor4.group (кліть) обертається на phi4 + β.
  function setTime(t, { beatHz, amplitude }) {
    const beta = tourbillon.update(t, beatHz, amplitude);
    update(beta / arbors[4].omega);
    return beta;
  }

  const clockAngle = (unit) => Math.PI / 2 - unit * Math.PI * 2;

  /**
   * Режим реального часу: спуск і вся передача рухаються від власного ходу
   * балансу (як у демо), а три стрілки накладаються поверх на істинний час
   * годинника. `beatT` — безперервна фаза ходу, окремо від годинника на стрілках.
   */
  function setClockTime(date, beatT, { beatHz, amplitude }) {
    // 1) Спуск (у кліті) веде передачу — точно тим самим шляхом, що й демо.
    const beta = tourbillon.update(beatT, beatHz, amplitude);
    const nd = beta / arbors[4].omega;
    // Автопідзавід: докручуємо храповик рівно так, щоб стрілка запасу стояла.
    // Головка при цьому не крутиться (spinCrown: false) — як у реальному калібрі.
    if (nd > lastDrive) {
      windAngle += autoWindDelta(nd - lastDrive);
      winding.setAngle(windAngle, { spinCrown: false });
    }
    update(nd);

    // 2) Стрілки накладаємо на істинний час (передача під ними «проковзує»).
    const h = date.getHours() % 12;
    const m = date.getMinutes();
    const s = date.getSeconds();
    const secondUnit = (s + date.getMilliseconds() / 1000) / 60;
    const minuteUnit = (m + secondUnit) / 60;
    const hourUnit = (h + minuteUnit) / 12;
    motionWorks.setHandAngles({
      hour: clockAngle(hourUnit),
      minute: clockAngle(minuteUnit),
      second: clockAngle(secondUnit),
    }, arbors);
    return { secondUnit, minuteUnit, hourUnit };
  }

  // ── Точки фокуса (для підписів і пресетів камери) ─────────────────
  const focusPoints = [
    // Анкерний вузол окремо не підписуємо: це і є кліть турбійона — та сама вісь,
    // тож два підписи в одній точці накладалися б. Його позначає «Турбійон».
    ...arbors.filter((a) => !a.spec.escapeTeeth)
      .map((a) => ({ nameKey: a.nameKey, pos: a.pos, z: a.wheelZ, r: arborOuterR(a.spec, CAGE_R) })),
    { nameKey: 'part.tourbillon', pos: cagePos, z: CAGE_ZBASE + 1.8, r: CAGE_R },
    { nameKey: 'part.hands', pos: mwL.P1, z: 10.0, r: 4.5 },
    { nameKey: 'part.winding', pos: windL.cwPos, z: 2.0, r: 4.5 },
    { nameKey: 'part.click', pos: windL.clickPivot, z: windL.windZ, r: 1.4 },
    { nameKey: 'part.powerReserve', pos: barrelPos, z: 8.6, r: 3.2 },
  ];

  return {
    root, arbors, update, setTime, setClockTime, tourbillon, size, focusPoints, winder,
    bounds: { minX, maxX, minY, maxY, cx, cy, plateR },
    centralSeconds: {
      drive: motionWorks.csDriveGear,
      idler: motionWorks.csIdlerGroup,
      center: motionWorks.centralSecondsGroup,
    },
    motionWorks: {
      cannonSub: motionWorks.cannonSub,
      mwArbor: motionWorks.mwArbor,
      hourGroup: motionWorks.hourGroup,
      csDriveGear: motionWorks.csDriveGear,
      csIdlerGroup: motionWorks.csIdlerGroup,
      centralSecondsGroup: motionWorks.centralSecondsGroup,
    },
    powerReserve,
  };
}
