import * as THREE from 'three';

// ── Константи спуску ──────────────────────────────────────────────
const FORK_MAX = 0.14;      // розмах анкера, рад (~8°)
const FLIP_W = 0.12;        // пів-ширина вікна перекидання, частка удару
const PALLET_HALF = (30 * Math.PI) / 180; // палети на ±30° від лінії анкера
const PIN_R = 1.0;          // радіус імпульсного пальця на ролику балансу

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

/** Коробка між двома точками у площині XY (для плечей і стрижня анкера). */
function bar(from, to, w, t, material) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Спусковий вузол: анкер (вилка з палетами) + баланс зі спіраллю.
 * Кінематика скриптована: баланс — синусоїда, анкер перекидається на
 * кожному нулі балансу, анкерне колесо просувається на пів-кроку за удар.
 *
 * update(t, beatHz, ampDeg) → кут анкерного колеса E (ним рухається вся передача).
 */
export function buildEscapement(
  { steel, brass, ruby, springMat, axleMat },
  { wheelPos, dirAngle, wheelR, zW, anchorPos, balancePos, escTeeth }
) {
  const group = new THREE.Group();
  const halfStep = Math.PI / escTeeth; // пів-кроку зубців за удар

  // ── Анкер (вилка) ──
  const fork = new THREE.Group();
  fork.position.set(anchorPos.x, anchorPos.y, zW);

  // Палети — на ободі колеса, ±30° від лінії центрів (розмах 2.5 зубця).
  for (const s of [+1, -1]) {
    // Точка на ободі колеса під кутом (dirAngle ± 30°) від його центра:
    const rimPt = wheelPos.clone().add(dir2(dirAngle + s * PALLET_HALF).multiplyScalar(wheelR - 0.15));
    const local = rimPt.sub(anchorPos);
    fork.add(bar(new THREE.Vector2(0, 0), local, 0.45, 0.35, steel));
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.5), ruby);
    stone.position.set(local.x, local.y, 0);
    stone.rotation.z = dirAngle + s * PALLET_HALF;
    stone.castShadow = true;
    fork.add(stone);
  }

  // Стрижень до балансу + ріжки вилки.
  const stemLen = balancePos.clone().sub(anchorPos).length() - PIN_R;
  const stemEnd = dir2(dirAngle).multiplyScalar(stemLen);
  fork.add(bar(new THREE.Vector2(0, 0), stemEnd, 0.4, 0.35, steel));
  for (const s of [+1, -1]) {
    const horn = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.35), steel);
    const perp = dir2(dirAngle + Math.PI / 2).multiplyScalar(s * 0.3);
    horn.position.set(stemEnd.x + perp.x + Math.cos(dirAngle) * 0.35, stemEnd.y + perp.y + Math.sin(dirAngle) * 0.35, 0);
    horn.rotation.z = dirAngle;
    horn.castShadow = true;
    fork.add(horn);
  }

  // Вісь анкера.
  const forkAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 16), axleMat);
  forkAxle.rotation.x = Math.PI / 2;
  fork.add(forkAxle);
  group.add(fork);

  // ── Баланс ──
  const zBal = zW + 1.3;
  const balance = new THREE.Group();
  balance.position.set(balancePos.x, balancePos.y, zBal);

  const balR = 3.2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(balR, 0.28, 12, 48), brass);
  rim.castShadow = true;
  balance.add(rim);
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(balR * 2 - 0.3, 0.32, 0.28), brass);
    spoke.rotation.z = a;
    spoke.castShadow = true;
    balance.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 20), steel);
  hub.rotation.x = Math.PI / 2;
  balance.add(hub);
  // Вісь балансу.
  const balAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.0, 16), axleMat);
  balAxle.rotation.x = Math.PI / 2;
  balAxle.position.z = -0.3;
  balance.add(balAxle);
  // Імпульсний палець — вниз, у площину вилки.
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.6, 12), ruby);
  pin.rotation.x = Math.PI / 2;
  const pinPos = dir2(dirAngle + Math.PI).multiplyScalar(PIN_R);
  pin.position.set(pinPos.x, pinPos.y, -0.9);
  pin.castShadow = true;
  balance.add(pin);
  group.add(balance);

  // ── Спіраль (волосок): лінія, що «дихає» — зовнішній кінець у колонці,
  // внутрішній обертається з балансом. ──
  const N = 200, TURNS = 4.5, R0 = 0.5, R1 = 2.7;
  const springGroup = new THREE.Group();
  springGroup.position.set(balancePos.x, balancePos.y, zBal + 0.7);
  const springGeo = new THREE.BufferGeometry();
  springGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const spring = new THREE.Line(springGeo, springMat);
  springGroup.add(spring);
  const stud = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.5), steel);
  stud.position.set(Math.cos(dirAngle) * R1, Math.sin(dirAngle) * R1, 0);
  springGroup.add(stud);
  group.add(springGroup);

  const PHI_TOT = TURNS * Math.PI * 2;
  function updateSpring(thetaB) {
    const pos = springGeo.attributes.position;
    for (let j = 0; j < N; j++) {
      const f = j / (N - 1);
      const ang = thetaB * (1 - f) + f * PHI_TOT - PHI_TOT + dirAngle;
      const r = R0 + (R1 - R0) * f;
      pos.setXYZ(j, Math.cos(ang) * r, Math.sin(ang) * r, 0);
    }
    pos.needsUpdate = true;
  }

  // ── Кінематика удару ──
  // u — час у ударах; нуль балансу на цілих u, перекидання у вікні ±FLIP_W.
  function update(t, beatHz, ampDeg) {
    const u = t * beatHz;
    const A = (ampDeg * Math.PI) / 180;
    const thetaB = A * Math.sin(Math.PI * u);

    const n = Math.round(u);
    const x = (u - n) / (2 * FLIP_W) + 0.5; // 0 → до перекидання, 1 → після
    const ss = smooth(x);
    const sigma = ((n % 2) + 2) % 2 === 0 ? 1 : -1;

    fork.rotation.z = -FORK_MAX * sigma * (2 * ss - 1); // «−»: вилка слідує за пальцем
    balance.rotation.z = thetaB;
    updateSpring(thetaB);

    return halfStep * (n - 1 + ss); // кут анкерного колеса
  }

  update(0, 2.5, 220);

  return { group, fork, balance, springGroup, update };
}
