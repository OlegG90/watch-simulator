import * as THREE from 'three';

/**
 * A variant's cost of complexity — measured, not typed.
 *
 * The model does not reproduce WHAT a tourbillon gives: averaging out gravitational
 * error does not arise in scripted kinematics. But it does honestly show what the
 * thing costs, and that is what is counted here — by walking the variant's own
 * scene graph.
 *
 * Not one number by hand: try changing the construction and the numbers follow it.
 *
 * WHAT EXACTLY IS MEASURED
 * - `parts`   — how many parts the node has;
 * - `moving`  — how many of them move (in the tourbillon: all of them, the cage
 *               carries the whole escapement);
 * - `axes`    — how many levels of rotation are nested inside one another: lever — 1,
 *               tourbillon — 2 (the cage, and the escapement inside it), double-axis — 3;
 * - `r`, `h`  — half-width of the recess and the height of the stack, i.e. the space taken.
 */

const T1 = 0.21, T2 = 0.63;   // two asymmetric moments of the beat
const BEAT = 2.5, AMP = 220;

/** The node's local pose — it shows whether the node moves. */
const pose = (o) => `${o.rotation.x},${o.rotation.y},${o.rotation.z},` +
                    `${o.position.x},${o.position.y},${o.position.z}`;

/**
 * @param variant `{ rotating, fixed, update }` — as the socket hands it out
 * @returns `{ parts, moving, axes, r, h }`
 */
export function measureVariant({ rotating, fixed, update }) {
  const roots = [rotating, fixed];

  // ── 1. Who moves: compare poses at two different moments ──
  const before = new Map();
  update(T1, BEAT, AMP);
  for (const root of roots) root.traverse((o) => before.set(o, pose(o)));
  update(T2, BEAT, AMP);
  const spins = new Set();
  for (const root of roots) root.traverse((o) => { if (before.get(o) !== pose(o)) spins.add(o); });

  // ── 2. Parts, motion and the depth of nested rotations ──
  let parts = 0, moving = 0, axes = 0;
  const vtx = new THREE.Vector3();
  const toLocal = new THREE.Matrix4();
  const inRoot = new THREE.Matrix4();
  let rMax = 0, zMin = Infinity, zMax = -Infinity;

  update(0, BEAT, AMP); // the pose for measuring the envelope — the same as at build time
  for (const root of roots) {
    // Everything under `rotating` is carried by the escape arbor: it always turns, so
    // that is a separate, outer level of rotation.
    const carried = root === rotating ? 1 : 0;
    root.updateMatrixWorld(true);
    // The envelope is measured in the SOCKET's coordinates, not the scene's: the socket
    // stands far from the centre of the plate, and world coordinates would give the
    // recess radius plus the distance to it.
    toLocal.copy(root.matrixWorld).invert();
    root.traverse((o) => {
      if (!o.isMesh) return;
      parts++;

      // How many levels of rotation are above this part (counting the part itself).
      let levels = carried;
      for (let p = o; p && p !== root.parent; p = p.parent) if (spins.has(p)) levels++;
      if (levels > 0) moving++;
      axes = Math.max(axes, levels);

      // The envelope — over the vertices themselves, in the socket's coordinates.
      // Bounding volumes lie in both directions here: a box around a torus contributes
      // its own corner (√2 × R), a sphere around a tall pillar its own height, and the
      // cage «grows» from 4.3 to 5.6. There are few vertices, and it is measured once.
      inRoot.multiplyMatrices(toLocal, o.matrixWorld);
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        vtx.fromBufferAttribute(pos, i).applyMatrix4(inRoot);
        rMax = Math.max(rMax, Math.hypot(vtx.x, vtx.y));
        zMin = Math.min(zMin, vtx.z);
        zMax = Math.max(zMax, vtx.z);
      }
    });
  }

  return {
    parts,
    moving,
    axes,
    r: Math.round(rMax * 100) / 100,
    h: Math.round((zMax - zMin) * 100) / 100,
  };
}
