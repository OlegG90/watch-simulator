import * as THREE from 'three';

/**
 * Спіраль балансу (волосок) — об'ємна трубка з кінцевою кривою Бреге.
 *
 * Спільна для всіх варіантів спуску: баланс скрізь один і той самий, тож
 * тримати три копії цих шістдесяти рядків було б тією ж помилкою, що й три
 * копії математики удару.
 *
 * Сітка будується ОДИН раз — індекси й UV незмінні, щокадру переписуються
 * лише позиції та нормалі. Перебудова `TubeGeometry` на кожен кадр коштувала
 * ~5.7 КБ сміття й ~285 мкс, більше за весь інший механізм разом.
 */

const N = 120;              // сегментів уздовж витка
const RADIAL = 8;           // граней у перерізі трубки
const VROW = RADIAL + 1;
const TURNS = 4;
const R0 = 0.32;            // внутрішній кінець (на балансі)
export const HAIR_R = 0.034;     // товщина дроту
export const OVERCOIL_F = 0.85;  // з якої частки витка починається крива Бреге
export const OVERCOIL_H = 0.18;  // на скільки вона підіймається

const PHI_TOT = TURNS * Math.PI * 2;

/** Зовнішній радіус витка при даному радіусі балансу. */
export const hairOuterR = (balR) => Math.min(1.65, balR - 0.08);

/**
 * @param balR      радіус обода балансу — з нього виводиться зовнішній виток
 * @param dirAngle  напрямок, у якому стоїть колодка (stud)
 * @param springSteel матеріал пружинної сталі (клонується)
 * @param steel     матеріал колодки
 * @returns `{ group, update(thetaB), mesh }`
 */
export function buildHairspring({ balR, dirAngle, springSteel, steel }) {
  const R1 = hairOuterR(balR);
  const group = new THREE.Group();

  // Матеріал трубки — власний клон пружинної сталі: спіраль об'ємна, тож це
  // звичайний метал, а не матеріал лінії. Трохи світліший і холодніший
  // відтінок, щоб тонкий дріт не губився на темному тлі.
  const hairMat = springSteel.clone();
  hairMat.color.setHex(0xbfd4ff);
  hairMat.roughness = 0.22;
  hairMat.metalness = 0.95;

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((N + 1) * VROW * 3);
  const nrm = new Float32Array((N + 1) * VROW * 3);
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
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    // Спіраль дихає всередині сталих меж, тож сферу рахуємо раз і не чіпаємо —
    // інакше довелося б обходити всі вершини щокадру заради відсікання.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, OVERCOIL_H / 2), R1 + HAIR_R + 0.05);
  }
  const mesh = new THREE.Mesh(geo, hairMat);
  mesh.castShadow = true;
  group.add(mesh);

  const stud = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.35), steel);
  stud.position.set(Math.cos(dirAngle) * R1, Math.sin(dirAngle) * R1, OVERCOIL_H);
  group.add(stud);

  // Осьова крива. Радіус і висота від кута балансу НЕ залежать — θ_b лише
  // підкручує кут, і то тим слабше, чим ближче до зовнішнього кінця.
  const _axis = Array.from({ length: N + 1 }, () => new THREE.Vector3());
  const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 0, 1);

  function update(thetaB) {
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const ang = thetaB * (1 - f) + f * PHI_TOT - PHI_TOT + dirAngle;
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
        pos[k] = p.x + HAIR_R * nx;
        pos[k + 1] = p.y + HAIR_R * ny;
        pos[k + 2] = p.z + HAIR_R * nz;
        nrm[k] = nx;
        nrm[k + 1] = ny;
        nrm[k + 2] = nz;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  }

  return { group, update, mesh };
}
