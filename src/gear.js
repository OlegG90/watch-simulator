import * as THREE from 'three';

/**
 * Parametric gear (simplified trapezoidal teeth).
 *
 * @param {object} o
 * @param {number} o.teeth      number of teeth
 * @param {number} o.module     module (tooth pitch); pitch radius = module * teeth / 2
 * @param {number} o.thickness  wheel thickness (along the Z axis)
 * @param {number} o.bore       radius of the central hole
 * @param {number} [o.addendum] tooth height above the pitch circle (× module)
 * @param {number} [o.dedendum] space depth below the pitch circle (× module)
 * @returns {THREE.Shape}       outline for ExtrudeGeometry
 */
export function gearShape({
  teeth,
  module,
  bore,
  addendum = 1.0,
  dedendum = 1.25,
  crossings = 0, // number of windows between hub and rim (spokes)
}) {
  const pitchR = (module * teeth) / 2;
  const outerR = pitchR + module * addendum;
  const rootR = pitchR - module * dedendum;

  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  // The fraction of the pitch taken by the tooth tip (the rest is space + flanks).
  const topFrac = 0.38;
  const botFrac = 0.62;

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const aRootStart = a0;
    const aFlankUp = a0 + step * (1 - botFrac) * 0.5;
    const aTopStart = a0 + step * (1 - topFrac) * 0.5;
    const aTopEnd = a0 + step * (1 + topFrac) * 0.5;
    const aFlankDown = a0 + step * (1 + botFrac) * 0.5;

    const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

    if (i === 0) shape.moveTo(...p(rootR, aRootStart));
    else shape.lineTo(...p(rootR, aRootStart));
    shape.lineTo(...p(rootR, aFlankUp));
    shape.lineTo(...p(outerR, aTopStart));
    shape.lineTo(...p(outerR, aTopEnd));
    shape.lineTo(...p(rootR, aFlankDown));
    shape.lineTo(...p(rootR, a0 + step));
  }
  shape.closePath();

  // The central hole.
  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  // Windows between hub and rim → spokes, as in real wheels.
  if (crossings > 0) {
    const hubR = bore + module * 1.6;
    const rimR = rootR - module * 2.0;
    if (rimR > hubR + module) {
      const spokeW = module * 1.5; // spoke width
      const aSp = spokeW / ((hubR + rimR) / 2);
      const seg = (Math.PI * 2) / crossings;
      for (let i = 0; i < crossings; i++) {
        const a1 = i * seg + aSp / 2;
        const a2 = (i + 1) * seg - aSp / 2;
        const w = new THREE.Path();
        w.absarc(0, 0, hubR, a1, a2, false);
        w.lineTo(Math.cos(a2) * rimR, Math.sin(a2) * rimR);
        w.absarc(0, 0, rimR, a2, a1, true);
        w.closePath();
        shape.holes.push(w);
      }
    }
  }

  return shape;
}

/**
 * Escape wheel: sharp ratchet teeth (a steep locking face and a sloping back).
 * @returns {THREE.Mesh} with metadata in mesh.userData.escape
 */
export function makeEscapeWheel({ teeth, outerR, rootR, thickness, bore, crossings = 4 }, material) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    if (i === 0) shape.moveTo(...p(outerR, a0));
    else shape.lineTo(...p(outerR, a0)); // tip (finishes the long back of the previous tooth)
    // The locking face is undercut beneath the tip: its root lies behind in the
    // direction of travel (the wheel turns anticlockwise), so the tip overhangs and
    // the face reads as an edge for the pallet to land on. Without the slant the lock
    // is lost: the tooth looks symmetrical.
    shape.lineTo(...p(rootR, a0 - 0.22 * step)); // locking face — slanted towards the travel
    shape.lineTo(...p(rootR * 0.96, a0 + 0.34 * step)); // space
    shape.lineTo(...p(rootR, a0 + 0.66 * step)); // start of the long back
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  // Spoke windows.
  if (crossings > 0) {
    const hubR = bore + 0.55;
    const rimR = rootR - 0.75;
    const aSp = 0.5 / ((hubR + rimR) / 2);
    const seg = (Math.PI * 2) / crossings;
    for (let i = 0; i < crossings; i++) {
      const a1 = i * seg + aSp / 2;
      const a2 = (i + 1) * seg - aSp / 2;
      const w = new THREE.Path();
      w.absarc(0, 0, hubR, a1, a2, false);
      w.lineTo(Math.cos(a2) * rimR, Math.sin(a2) * rimR);
      w.absarc(0, 0, rimR, a2, a1, true);
      w.closePath();
      shape.holes.push(w);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.escape = { teeth, outerR, step };
  return mesh;
}

/**
 * Hand: an elongated wedge with a counterweight tail, tip along +X.
 */
export function makeHand({ length, tail = 0.25, width = 0.55, thickness = 0.14 }, material) {
  const T = length * tail;
  const shape = new THREE.Shape();
  shape.moveTo(-T, -width * 0.5);
  shape.lineTo(length * 0.88, -width * 0.14);
  shape.lineTo(length, 0);
  shape.lineTo(length * 0.88, width * 0.14);
  shape.lineTo(-T, width * 0.5);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * A flat spiral ribbon — the mainspring: a vertical wall following an Archimedean
 * spiral whose height runs along the Z axis. A double-sided material shows both
 * faces. Centred at (0,0), in the XY plane.
 */
export function makeSpiralRibbon({ height, segments = 600 }, material) {
  const seg = segments;
  const zT = height / 2, zB = -height / 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(seg * 18), 3));
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Recompute the shape for a given state (the same buffer — safe every frame).
  // Archimedean spiral; coil pitch = (outerR − innerR) / turns: more turns → tighter.
  mesh.userData.setShape = ({ innerR, outerR, turns }) => {
    const thetaMax = turns * Math.PI * 2;
    const pos = geo.attributes.position.array;
    let k = 0, px = 0, py = 0;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const th = t * thetaMax;
      const r = innerR + (outerR - innerR) * t;
      const x = Math.cos(th) * r, y = Math.sin(th) * r;
      if (i > 0) {
        pos[k++] = px; pos[k++] = py; pos[k++] = zB;
        pos[k++] = x;  pos[k++] = y;  pos[k++] = zB;
        pos[k++] = x;  pos[k++] = y;  pos[k++] = zT;
        pos[k++] = px; pos[k++] = py; pos[k++] = zB;
        pos[k++] = x;  pos[k++] = y;  pos[k++] = zT;
        pos[k++] = px; pos[k++] = py; pos[k++] = zT;
      }
      px = x; py = y;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  };
  return mesh;
}

/**
 * A finished gear Mesh.
 * @param {object} o          gearShape parameters plus thickness
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}      with metadata in mesh.userData.gear
 */
export function makeGear(o, material) {
  const shape = gearShape(o);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: o.thickness,
    bevelEnabled: true,
    bevelThickness: o.module * 0.1,
    bevelSize: o.module * 0.1,
    bevelSegments: 1,
    curveSegments: 12,
  });
  geo.translate(0, 0, -o.thickness / 2);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.gear = {
    teeth: o.teeth,
    pitchR: (o.module * o.teeth) / 2,
  };
  return mesh;
}

/**
 * A bevel gear — the same tooth profile, but tapered towards the apex, so the
 * wheel becomes conical. For transmitting rotation at an angle (winding stem ↔
 * crown wheel). Its axis is along +Z: the wide base at z≈−thickness/2, the narrow
 * apex at z≈+thickness/2.
 * @returns {THREE.Mesh} with mesh.userData.gear.pitchR (measured at the base)
 */
export function makeBevelGear({ teeth, module, thickness = 0.4, bore, pitchAngleDeg = 45 }, material) {
  const shape = gearShape({ teeth, module, bore });
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 6,
  });
  // Bending the flat gear onto the pitch cone: apex at (0,0,0), axis +Z, cone angle
  // from the axis = pitchAngleDeg. A point at radius r is lifted along the axis by
  // r / tan(angle) — so the angle between the cone's generator and the axis is exactly pitchAngleDeg.
  const g = 1 / Math.tan((pitchAngleDeg * Math.PI) / 180);
  const pos = geo.attributes.position;
  const z0 = new Float32Array(pos.count);
  const r0 = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { z0[i] = pos.getZ(i); r0[i] = Math.hypot(pos.getX(i), pos.getY(i)); }
  for (let i = 0; i < pos.count; i++) pos.setZ(i, z0[i] + r0[i] * g);
  // Tapering the teeth towards the apex (B2): the top face (initially z = +thickness/2)
  // is scaled to ~0.78, so a tooth thins towards the cone as it does in a real pair.
  // Cone membership is preserved: z = z0 + s·r0·g, so lift = z - r·g == z0.
  const topZ = thickness / 2;
  for (let i = 0; i < pos.count; i++) {
    if (z0[i] > topZ - 1e-4 && r0[i] > bore + 0.1) {
      const s = 0.78;
      pos.setX(i, pos.getX(i) * s);
      pos.setY(i, pos.getY(i) * s);
      pos.setZ(i, z0[i] + s * r0[i] * g);
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.gear = { teeth, pitchR: (module * teeth) / 2 };
  return mesh;
}
