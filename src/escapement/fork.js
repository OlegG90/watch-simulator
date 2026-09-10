import * as THREE from 'three';

/**
 * The pallet fork — one builder for every escapement module.
 *
 * Unlike the balance, this is not the same part in three places: it is the same PARTS in
 * three arrangements. Where the fork's arbor stands, how far its stem reaches and which
 * way the balance lies all follow from the module, and that is exactly what the escapement
 * socket exists to allow. So those are inputs.
 *
 * What is NOT an input is everything nobody decided: the stones' proportions, the sections
 * of the arms and the stem, the axle. Those were typed out three times and drifted — two
 * modules had a bevelled ruby prism and the third a plain box — and nothing went red,
 * because no test had an opinion about a stone's shape.
 *
 * **The sections follow the wheel.** A fork belongs to its escape wheel: the same fork on a
 * wheel a third the size would be a club. So every section is proportional to `escR`,
 * against the 1.5 the movement's two modules share — which means those two are unchanged to
 * the last decimal, and a module with a smaller wheel gets a fork in the same proportions
 * rather than one somebody sized by eye.
 */

/** The reference wheel: the radius the sections below are quoted at. */
const REF_R = 1.5;

/** Sections at the reference radius — the numbers the movement's fork has always had. */
const SECTION = {
  arm: { w: 0.3, t: 0.28 },
  stem: { w: 0.26, t: 0.28 },
  stone: { w: 0.3, h: 0.6, depth: 0.4, bevel: 0.04, bevelSize: 0.035 },
  horn: { len: 0.4, w: 0.14, t: 0.28, off: 0.22 },
  axle: { r: 0.15, len: 1.3 },
  /** How far inside the wheel's rim the stones act. */
  rimInset: 0.12,
};

/** The pallets stand this far either side of the line from the wheel to the balance. */
export const PALLET_HALF = (30 * Math.PI) / 180;

const dir2 = (a) => new THREE.Vector2(Math.cos(a), Math.sin(a));

/** A bar between two points of the fork's plane. */
function bar(from, to, w, t, material) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

/**
 * @param wheelCentre  the escape wheel's centre, in the same frame as `pivot`
 * @param pivot        where the fork's arbor stands
 * @param toBalance    the direction from the wheel towards the balance, in radians
 * @param escR         the escape wheel's radius: the stones act just inside it, and every
 *                     section of the fork is proportional to it
 * @param reach        how far the stem runs from the pivot towards the balance
 * @param horns        the notch's horns — built only where something rides in the notch
 */
export function buildPalletFork({
  wheelCentre, pivot, toBalance, escR, reach, horns = false,
  steel, axleMat, palletMat,
}) {
  const k = escR / REF_R;
  const group = new THREE.Group();
  // The scale is declared on the group, so the guard can normalise the three forks
  // against it and compare what is left — the sections — rather than trust that they
  // came from here.
  group.userData.forkScale = k;
  const origin = new THREE.Vector2(0, 0);

  for (const s of [+1, -1]) {
    const rimPt = wheelCentre.clone()
      .add(dir2(toBalance + s * PALLET_HALF).multiplyScalar(escR - SECTION.rimInset * k));
    const local = rimPt.clone().sub(pivot);
    group.add(bar(origin, local, SECTION.arm.w * k, SECTION.arm.t * k, steel));

    // A faceted prism rather than a box: a stone should catch the light on an edge.
    const pw = SECTION.stone.w * k, ph = SECTION.stone.h * k;
    const shape = new THREE.Shape();
    shape.moveTo(-pw / 2, -ph / 2);
    shape.lineTo(pw / 2, -ph / 2);
    shape.lineTo(pw / 2, ph / 2);
    shape.lineTo(-pw / 2, ph / 2);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: SECTION.stone.depth * k, bevelEnabled: true,
      bevelThickness: SECTION.stone.bevel * k, bevelSize: SECTION.stone.bevelSize * k,
      bevelSegments: 2,
    });
    geo.translate(0, 0, (-SECTION.stone.depth / 2) * k);
    const stone = new THREE.Mesh(geo, palletMat);
    stone.position.set(local.x, local.y, 0);
    stone.rotation.z = toBalance + s * PALLET_HALF;
    stone.castShadow = true;
    group.add(stone);
  }

  const stemEnd = dir2(toBalance).multiplyScalar(reach);
  group.add(bar(origin, stemEnd, SECTION.stem.w * k, SECTION.stem.t * k, steel));

  if (horns) {
    for (const s of [+1, -1]) {
      const horn = new THREE.Mesh(
        new THREE.BoxGeometry(SECTION.horn.len * k, SECTION.horn.w * k, SECTION.horn.t * k),
        steel,
      );
      const perp = dir2(toBalance + Math.PI / 2).multiplyScalar(s * SECTION.horn.off * k);
      horn.position.set(stemEnd.x + perp.x, stemEnd.y + perp.y, 0);
      horn.rotation.z = toBalance;
      horn.castShadow = true;
      group.add(horn);
    }
  }

  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(SECTION.axle.r * k, SECTION.axle.r * k, SECTION.axle.len * k, 12),
    axleMat,
  );
  axle.rotation.x = Math.PI / 2;
  group.add(axle);

  return group;
}
