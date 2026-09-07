import * as THREE from 'three';
import { makeEscapeWheel } from '../gear.js';
import { tagModule, tagVariant } from '../common.js';
import { beatPhase } from './beat.js';
import { buildHairspring } from './hairspring.js';

/**
 * Швейцарський анкерний спуск — найпростіший модуль у гнізді.
 *
 * Кліті немає: анкерне колесо сидить прямо на анкерній осі (`arbor4`), тож
 * обертається рівно на β. Вилка й баланс стоять на платині й крутяться навколо
 * власних осей.
 *
 * ЩО МІНЯЄТЬСЯ МІСЦЯМИ. У турбійоні в центрі осі стоїть баланс, а анкерне
 * колесо зсунуте на 2.6 й обкочується навколо нерухомого. Тут навпаки: центр
 * зайняте анкерне колесо (інакше передача його не жене), а баланс зсунутий на
 * ту саму відстань. Ті самі деталі, переставлені ролями — це і є те, що показує
 * заміна.
 *
 * ДОПУЩЕННЯ: у справжньому анкерному спуску баланс стоїть далі від анкерного
 * колеса. Ми тримаємо його на 2.6 й радіусом 1.95 — так само, як у турбійоні, —
 * щоб при заміні не рухалось нічого, крім самої конструкції вузла.
 */

/** Ідентифікатор варіанта в гнізді спуску. */
export const VARIANT_ID = 'lever';

/** Локальні Z-рівні (від основи гнізда). Платівок немає — звідси низький силует. */
export const LAYERS = { escape: 0.55, fork: 0.95, balance: 1.75, hair: 2.25 };

/** Зсув балансу від анкерної осі — там, де в турбійоні анкерне колесо. */
export const BALANCE_OFF = 2.6;
/** Радіус обода балансу — навмисно той самий, що в турбійоні (див. допущення). */
export const BALANCE_R = 1.95;

/** Радіус анкерного колеса — той самий, що в кліті турбійона. */
export const ESC_R = 1.5;

const PALLET_HALF = (30 * Math.PI) / 180; // палети на ±30° від лінії центрів
const ROLLER_R = 0.55;                    // радіус ролика з імпульсним каменем

/** Вісь вилки — між анкерним колесом і балансом. */
export const FORK_PIVOT = BALANCE_OFF * 0.48;
/** Найдальша точка вилки від її осі — розгортка бере півширину звідси. */
export const FORK_REACH = BALANCE_OFF - FORK_PIVOT - ROLLER_R;

const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

/** Коробка між двома точками у площині XY (плечі й стрижень вилки). */
function bar(from, to, w, t, material) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

export function buildLever(
  { steel, brass, springSteel, axleMat },
  { escTeeth = 15, escR = ESC_R, escDirLocal = 0 }
) {
  const rotating = new THREE.Group(); // на анкерній осі — крутиться на β
  const fixed = new THREE.Group();    // на платині — власні осі обертання

  // ── Анкерне колесо: у центрі осі, жорстко на ній ──
  const escWheel = makeEscapeWheel(
    { teeth: escTeeth, outerR: escR, rootR: escR - 0.5, thickness: 0.35, bore: 0.18, crossings: 3 },
    brass
  );
  escWheel.position.z = LAYERS.escape;
  rotating.add(escWheel);
  const escAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 10), axleMat);
  escAxle.rotation.x = Math.PI / 2;
  escAxle.position.z = LAYERS.escape - 0.2;
  rotating.add(escAxle);

  const balCenter = dir2(escDirLocal).multiplyScalar(BALANCE_OFF);

  // ── Вилка: між анкерним колесом і балансом ──
  // Рубінові палети — фізичний матеріал із заломленням, як у турбійоні: камінь
  // має просвічуватись, а не бути матовим блоком.
  const palletMat = new THREE.MeshPhysicalMaterial({
    color: 0xc0304a, roughness: 0.12, metalness: 0.0,
    transmission: 0.28, thickness: 0.4, ior: 1.76,
    emissive: 0x1a050a, emissiveIntensity: 0.25,
    clearcoat: 0.6, clearcoatRoughness: 0.15,
  });
  const impulseRubyMat = palletMat.clone();
  impulseRubyMat.emissiveIntensity = 0.18;

  const fork = new THREE.Group();
  const forkPivot = dir2(escDirLocal).multiplyScalar(FORK_PIVOT);
  fork.position.set(forkPivot.x, forkPivot.y, LAYERS.fork);
  {
    for (const s of [+1, -1]) {
      // Точка на ободі анкерного колеса (його центр — початок координат).
      const rimPt = dir2(escDirLocal + s * PALLET_HALF).multiplyScalar(escR - 0.12);
      const local = rimPt.clone().sub(forkPivot);
      fork.add(bar(new THREE.Vector2(0, 0), local, 0.3, 0.28, steel));
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
      stone.rotation.z = escDirLocal + s * PALLET_HALF;
      stone.castShadow = true;
      fork.add(stone);
    }
    // Стрижень до ролика балансу + ріжки.
    const stemEnd = dir2(escDirLocal).multiplyScalar(FORK_REACH);
    fork.add(bar(new THREE.Vector2(0, 0), stemEnd, 0.26, 0.28, steel));
    for (const s of [+1, -1]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.28), steel);
      const perp = dir2(escDirLocal + Math.PI / 2).multiplyScalar(s * 0.22);
      horn.position.set(stemEnd.x + perp.x, stemEnd.y + perp.y, 0);
      horn.rotation.z = escDirLocal;
      horn.castShadow = true;
      fork.add(horn);
    }
    const forkAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.3, 12), axleMat);
    forkAxle.rotation.x = Math.PI / 2;
    fork.add(forkAxle);
  }
  fixed.add(fork);

  // ── Баланс: зсунутий на BALANCE_OFF, того ж розміру, що в турбійоні ──
  const balance = new THREE.Group();
  balance.position.set(balCenter.x, balCenter.y, LAYERS.balance);
  const balR = BALANCE_R;
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
  const balHub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 16), steel);
  balHub.rotation.x = Math.PI / 2;
  balance.add(balHub);
  const balAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 12), axleMat);
  balAxle.rotation.x = Math.PI / 2;
  balAxle.position.z = -0.5;
  balance.add(balAxle);
  // Імпульсний камінь на ролику — дивиться в бік вилки.
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 10), impulseRubyMat);
  pin.rotation.x = Math.PI / 2;
  const pinPos = dir2(escDirLocal + Math.PI).multiplyScalar(ROLLER_R);
  pin.position.set(pinPos.x, pinPos.y, -0.45);
  pin.castShadow = true;
  balance.add(pin);
  fixed.add(balance);

  // ── Спіраль: над балансом, спільний модуль ──
  const hair = buildHairspring({ balR, dirAngle: escDirLocal, springSteel, steel });
  hair.group.position.set(balCenter.x, balCenter.y, LAYERS.hair);
  fixed.add(hair.group);

  const phase = {};

  function update(t, beatHz, ampDeg) {
    const { thetaB, beta, forkAngle } = beatPhase(t, beatHz, ampDeg, escTeeth, phase);
    // Анкерне колесо не має власного кута: воно жорстко на осі, а вісь уже
    // повернута на β. Саме тому воно робить оберт за 12 с, а не за 6, як у
    // турбійоні, де їде на кліті й додає її оберт до свого.
    fork.rotation.z = forkAngle;
    balance.rotation.z = thetaB;
    hair.update(thetaB);
    return beta;
  }
  update(0, 2.5, 220);

  for (const g of [rotating, fixed]) {
    tagModule(g, 'escapement');
    tagVariant(g, VARIANT_ID);
  }

  return { rotating, fixed, update, balance, fork, escWheel, hairGroup: hair.group, balR };
}
