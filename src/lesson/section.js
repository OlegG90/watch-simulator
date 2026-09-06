/**
 * Вигляд збоку — **розгортка вздовж ланцюга**, а не проекція.
 *
 * Чесна ортогональна проекція тут не працює: вона схлопує вісь Y, і кліть
 * турбійона (за 14 одиниць від барабана) налазить на диференціал. Тому
 * робимо так, як роблять у годинникових розрізах: висоти справжні, а по
 * горизонталі вузли стоять на своїх справжніх міжосьових відстанях уздовж
 * ланцюга. Побічний виграш — кожен тріб дотикається колеса сусіда рівно по
 * ділильних колах, бо відстані не вигадані.
 *
 * Деталі беруться з тих самих `layout…()` і `LAYERS`, що будують сцену:
 * діаграма не може розійтися з механізмом.
 */
import { TRAIN, layoutTrain } from '../train.js';
import { pitchR, WHEEL_T, PINION_T } from '../common.js';
import { LAYERS as BARREL } from '../barrel.js';
import { LAYERS as WIND, RATCHET_T, CROWN_T, RATCH_M } from '../winding.js';
import { LAYERS as PR, PRT_HUB, PRT_P, PRT_W, PRT_G, PRT_M } from '../powerReserve.js';
import { LAYERS as MW, CANNON_T, MINUTE_T, MW_PINION_T, HOUR_T, MW_M1, MW_M2, CS_DRIVE, CS_IDLER, CS_PINION } from '../motionWorks.js';
import { LAYERS as CAGE } from '../tourbillon.js';

const CAGE_R = 4.3;
const V_EXAGGERATION = 2; // інакше шари в 1.1 зливаються; підписано у в'юпорті

/**
 * Деталі розрізу: `u` — місце вздовж ланцюга, `z0..z1` — висота, `r` — півширина.
 * Усе в одиницях механізму.
 */
export function sectionParts() {
  const arbors = layoutTrain();
  const u = [0];
  for (let k = 1; k < TRAIN.length; k++) {
    u.push(u[k - 1] + pitchR(TRAIN[k - 1].wheel) + pitchR(TRAIN[k].pinion));
  }

  const parts = [];
  const add = (p) => parts.push(p);

  // ── Ланцюг передачі: сходинка, де кожен щабель торкається наступного ──
  TRAIN.forEach((spec, k) => {
    if (spec.pinion) {
      add({ u: u[k], z0: arbors[k].pinionZ, z1: arbors[k].pinionZ + PINION_T,
            r: pitchR(spec.pinion), mod: 'train', kind: 'pinion' });
    }
    if (spec.wheel) {
      add({ u: u[k], z0: arbors[k].wheelZ, z1: arbors[k].wheelZ + WHEEL_T,
            r: pitchR(spec.wheel), mod: 'train', kind: 'wheel', labelKey: spec.nameKey });
    }
  });

  // Точки зачеплення — там, де ділильні кола дотикаються.
  const meshes = [];
  for (let k = 1; k < TRAIN.length; k++) {
    meshes.push({
      u: u[k] - pitchR(TRAIN[k].pinion),
      z: (arbors[k].pinionZ + arbors[k - 1].wheelZ + WHEEL_T) / 2,
      text: `${TRAIN[k - 1].wheel}→${TRAIN[k].pinion}`,
    });
  }

  // ── Барабан із пружиною (нижче колеса) ──
  const drumR = pitchR(TRAIN[0].wheel) - 1.2;
  add({ u: 0, z0: BARREL.drumCentre - BARREL.drumHeight / 2, z1: BARREL.drumCentre + BARREL.drumHeight / 2,
        r: drumR, mod: 'barrel', kind: 'drum' });

  // ── Заведення: храповик на осі барабана + коронне колесо на своїй ──
  add({ u: 0, z0: WIND.deck, z1: WIND.deck + 0.5, r: pitchR(RATCHET_T, RATCH_M), mod: 'winding', kind: 'wheel' });
  const uCrown = -((RATCHET_T + CROWN_T) / 2) * RATCH_M;
  add({ u: uCrown, z0: WIND.deck, z1: WIND.deck + 0.5, r: pitchR(CROWN_T, RATCH_M), mod: 'winding', kind: 'wheel',
        labelKey: 'part.winding' });

  // ── Запас ходу: маточинне на осі барабана, компаунд збоку, сонця й шкала ──
  add({ u: 0, z0: PR.hubWheel, z1: PR.hubWheel + 0.5, r: pitchR(PRT_HUB, PRT_M), mod: 'powerReserve', kind: 'wheel' });
  const uIdler = ((PRT_HUB + PRT_P) / 2) * PRT_M;
  add({ u: uIdler, z0: PR.hubWheel, z1: PR.hubWheel + 0.5, r: pitchR(PRT_P, PRT_M), mod: 'powerReserve', kind: 'pinion' });
  add({ u: uIdler, z0: PR.idlerWheel, z1: PR.idlerWheel + 0.5, r: pitchR(PRT_W, PRT_M), mod: 'powerReserve', kind: 'wheel' });
  add({ u: 0, z0: PR.idlerWheel, z1: PR.idlerWheel + 0.5, r: pitchR(PRT_G, PRT_M), mod: 'powerReserve', kind: 'wheel' });
  add({ u: 0, z0: PR.suns - 0.2, z1: PR.suns + 0.2, r: 2.24, mod: 'powerReserve', kind: 'sun' });
  add({ u: 0, z0: PR.dial, z1: PR.dial + 0.1, r: 3.05, mod: 'powerReserve', kind: 'flat' });
  add({ u: 0, z0: PR.hand, z1: PR.hand + 0.14, r: 2.5, mod: 'powerReserve', kind: 'hand', labelKey: 'part.powerReserve' });

  // ── Індикація: канон і годинне на центральній осі, хвилинний вузол збоку ──
  const uc = u[1];
  add({ u: uc, z0: MW.minuteWheel, z1: MW.minuteWheel + 0.8, r: pitchR(CANNON_T, MW_M1), mod: 'motionWorks', kind: 'pinion' });
  const uMinute = uc + ((CANNON_T + MINUTE_T) / 2) * MW_M1;
  add({ u: uMinute, z0: MW.minuteWheel, z1: MW.minuteWheel + 0.55, r: pitchR(MINUTE_T, MW_M1), mod: 'motionWorks', kind: 'wheel' });
  add({ u: uMinute, z0: MW.hourWheel, z1: MW.hourWheel + 0.7, r: pitchR(MW_PINION_T, MW_M2), mod: 'motionWorks', kind: 'pinion' });
  add({ u: uc, z0: MW.hourWheel, z1: MW.hourWheel + 0.5, r: pitchR(HOUR_T, MW_M2), mod: 'motionWorks', kind: 'wheel' });

  // Центральна секунда: ведуче на секундній осі, проміжне між ними, тріб у центрі.
  const csM = 0.29508; // модуль підганяється під фактичну відстань осей
  add({ u: u[3], z0: MW.centralSeconds, z1: MW.centralSeconds + 0.45, r: pitchR(CS_DRIVE, csM), mod: 'motionWorks', kind: 'wheel' });
  add({ u: uc, z0: MW.centralSeconds, z1: MW.centralSeconds + 0.55, r: pitchR(CS_PINION, csM), mod: 'motionWorks', kind: 'pinion' });
  const uCsIdler = uc + ((CS_IDLER + CS_PINION) / 2) * csM;
  add({ u: uCsIdler, z0: MW.centralSeconds, z1: MW.centralSeconds + 0.45, r: pitchR(CS_IDLER, csM), mod: 'motionWorks', kind: 'wheel' });

  // Три стрілки на одній осі — вкладені трубки видно саме тут.
  add({ u: uc, z0: MW.hands.hour, z1: MW.hands.hour + 0.14, r: 5.6, mod: 'motionWorks', kind: 'hand' });
  add({ u: uc, z0: MW.hands.minute, z1: MW.hands.minute + 0.14, r: 7.0, mod: 'motionWorks', kind: 'hand' });
  add({ u: uc, z0: MW.hands.second, z1: MW.hands.second + 0.14, r: 7.4, mod: 'motionWorks', kind: 'hand',
        labelKey: 'part.hands' });

  // ── Кліть турбійона: вежа з двох платівок ──
  const base = arbors[4].wheelZ;
  add({ u: u[4], z0: base + CAGE.bottom, z1: base + CAGE.top, r: CAGE_R, mod: 'tourbillon', kind: 'cage',
        labelKey: 'part.tourbillon' });
  add({ u: u[4], z0: base + CAGE.balance - 0.1, z1: base + CAGE.balance + 0.1, r: 1.5, mod: 'tourbillon', kind: 'flat' });

  // ── Платина ──
  const uMin = Math.min(...parts.map((p) => p.u - p.r));
  const uMax = Math.max(...parts.map((p) => p.u + p.r));
  add({ u: (uMin + uMax) / 2, z0: -3.6, z1: -2.8, r: (uMax - uMin) / 2, mod: 'plate', kind: 'plate' });

  return { parts, meshes, arborU: u, bounds: { uMin, uMax } };
}

/** Z-рівні для шкали ліворуч — беруться з тих самих даних. */
export function zTicks() {
  const arbors = layoutTrain();
  const t = arbors.map((a) => a.wheelZ);
  return [...new Set([...t, PR.suns, MW.minuteWheel, MW.centralSeconds, MW.hands.second])]
    .sort((a, b) => a - b);
}

export const V_SCALE = V_EXAGGERATION;
