import * as THREE from 'three';

/**
 * The balance spring (hairspring) — a solid tube with a Breguet overcoil at the end.
 *
 * Shared by every escapement variant: the balance is the same everywhere, so
 * keeping three copies of these sixty lines would be the same mistake as three
 * copies of the beat maths.
 *
 * The mesh is built ONCE — indices and UVs never change, only positions and
 * normals are rewritten each frame. Rebuilding `TubeGeometry` every frame cost
 * ~5.7 KB of garbage and ~285 µs, more than the whole rest of the movement together.
 */

const N = 120;              // segments along a coil
const RADIAL = 8;           // faces in the tube's cross-section
const VROW = RADIAL + 1;
const TURNS = 4;
const R0 = 0.32;            // the inner end (at the balance)
export const HAIR_R = 0.034;     // wire thickness
export const OVERCOIL_F = 0.85;  // the fraction of the coil at which the Breguet curve starts
export const OVERCOIL_H = 0.18;  // how high it rises

const PHI_TOT = TURNS * Math.PI * 2;

/** The outer coil's radius for a given balance radius. */
export const hairOuterR = (balR) => Math.min(1.65, balR - 0.08);

/**
 * @param balR      the balance rim's radius — the outer coil is derived from it
 * @param dirAngle  the direction the stud stands in
 * @param springSteel spring-steel material (cloned)
 * @param steel     the stud's material
 * @returns `{ group, update(thetaB), mesh }`
 */
export function buildHairspring({ balR, dirAngle, springSteel, steel }) {
  const R1 = hairOuterR(balR);
  const group = new THREE.Group();

  // The tube's material — its own clone of the spring steel: the hairspring is solid,
  // so this is ordinary metal, not a line material. A slightly lighter and cooler
  // shade, so the thin wire does not get lost against the dark background.
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
    // The hairspring breathes inside fixed bounds, so the sphere is computed once and
    // left alone — otherwise every vertex would be walked each frame just for culling.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, OVERCOIL_H / 2), R1 + HAIR_R + 0.05);
  }
  const mesh = new THREE.Mesh(geo, hairMat);
  mesh.castShadow = true;
  group.add(mesh);

  const stud = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.35), steel);
  stud.position.set(Math.cos(dirAngle) * R1, Math.sin(dirAngle) * R1, OVERCOIL_H);
  group.add(stud);

  // The axial curve. Radius and height do NOT depend on the balance angle — θ_b only
  // twists the angle, and the more weakly the closer to the outer end.
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
      // The cross-section frame is built from the Z axis rather than by Frenet: the
      // hairspring's tangent never becomes vertical, so this is steadier and needs less maths.
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
