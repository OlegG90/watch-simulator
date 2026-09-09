import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import { buildMovement } from './movement.js';
import { buildLabels, createCameraFly } from './ui.js';

// ── Scene / renderer ──────────────────────────────────────────────
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c20);

// An environment map for the highlights on the metal.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ── Lighting ──────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.15));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(25, 35, 30);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 120;
key.shadow.camera.left = -32;
key.shadow.camera.right = 32;
key.shadow.camera.top = 32;
key.shadow.camera.bottom = -32;
scene.add(key);
const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
fill.position.set(-20, 8, -12);
scene.add(fill);

// ── Materials ─────────────────────────────────────────────────────
const brass = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 0.35, metalness: 0.9 });
const steel = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.95 });
const axleMat = new THREE.MeshStandardMaterial({ color: 0x666a72, roughness: 0.4, metalness: 0.8 });
const ruby = new THREE.MeshStandardMaterial({ color: 0xc0304a, roughness: 0.2, metalness: 0.1, emissive: 0x30040a });
const springMat = new THREE.LineBasicMaterial({ color: 0x5b7fd4 });
const plateMat = new THREE.MeshStandardMaterial({ color: 0x8a7440, roughness: 0.55, metalness: 0.7 });
const bluedMat = new THREE.MeshStandardMaterial({ color: 0x24418f, roughness: 0.3, metalness: 0.85 });

// ── The movement (train + escapement) ─────────────────────────────
const movement = buildMovement({ brass, steel, axleMat, ruby, springMat, plateMat, bluedMat });
scene.add(movement.root);

// Node labels.
const labels = buildLabels(movement.focusPoints);
movement.root.add(labels);

// ── Backdrop plate ────────────────────────────────────────────────
const plateR = Math.max(movement.size.w, movement.size.h) / 2 + 10;
const plate = new THREE.Mesh(
  new THREE.CircleGeometry(plateR, 64),
  new THREE.MeshStandardMaterial({ color: 0x222530, roughness: 0.9, metalness: 0.1 })
);
plate.rotation.x = -Math.PI / 2;
plate.position.y = -movement.size.h / 2 - 2.5;
plate.receiveShadow = true;
scene.add(plate);

// ── Camera: fit the movement into the frame (allowing for the aspect) ─
const fitR = Math.hypot(movement.size.w, movement.size.h) / 2;
const viewDir = new THREE.Vector3(0.12, 0.22, 1).normalize();
const fly = createCameraFly(camera, controls);
let userOrbited = false;
controls.addEventListener('start', () => {
  userOrbited = true;
  fly.cancel(); // orbiting by hand interrupts a flight
});

function fitCamera() {
  const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const hTan = vTan * camera.aspect;
  const dist = (fitR / Math.min(vTan, hTan)) * 1.05;
  camera.position.copy(viewDir).multiplyScalar(dist);
}

// ── UI ────────────────────────────────────────────────────────────
const params = {
  running: true,
  timeMode: 'demo',
  speed: 1.0,
  beatHz: 2.5,
  amplitude: 220,
  wireframe: false,
};
const gui = new GUI({ title: 'SimWatch' });
gui.add(params, 'running').name('Running');
gui.add(params, 'timeMode', {
  'Demo time': 'demo',
  'Real time': 'real',
}).name('Time mode');
gui.add(params, 'speed', 0, 10, 0.1).name('Speed');
gui.add(params, 'beatHz', 0.5, 6, 0.1).name('Rate, beats/s');
gui.add(params, 'amplitude', 90, 270, 5).name('Amplitude, °');
gui.add(params, 'wireframe').name('Wireframe').onChange((v) => {
  brass.wireframe = v;
  steel.wireframe = v;
});
gui.add({ wind: () => movement.winder.wind() }, 'wind').name('⟳ Wind the spring');
gui.add(labels, 'visible').name('Labels');
const nodes = gui.addFolder('Nodes');
for (const a of movement.arbors) nodes.add(a.group, 'visible').name(a.name);
nodes.add(movement.escapement.fork, 'visible').name('Pallet fork (lever)');
nodes.add(movement.escapement.balance, 'visible').name('Balance');
nodes.add(movement.escapement.springGroup, 'visible').name('Hairspring');
const mwVis = { hands: true, winding: true };
nodes.add(mwVis, 'hands').name('Hands + motion works').onChange((v) => {
  for (const g of Object.values(movement.motionWorks)) g.visible = v;
});
nodes.add(mwVis, 'winding').name('Winding').onChange((v) => (movement.winder.group.visible = v));

// Camera presets.
const worldOf = (name) => {
  const fp = movement.focusPoints.find((f) => f.name === name);
  return new THREE.Vector3(fp.pos.x, fp.pos.y, fp.z).add(movement.root.position);
};
const goto = (target, back, up = 2) =>
  fly.flyTo(target.clone().add(new THREE.Vector3(0, up, back)), target);
const cams = {
  'Overview': () => {
    const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hTan = vTan * camera.aspect;
    fly.flyTo(viewDir.clone().multiplyScalar((fitR / Math.min(vTan, hTan)) * 1.05), new THREE.Vector3());
  },
  'Barrel': () => goto(worldOf('Barrel'), 26),
  'Going train': () => goto(worldOf('Third wheel'), 34, 4),
  'Escapement': () => goto(worldOf('Pallet fork'), 22),
  'Balance': () => goto(worldOf('Balance'), 16, 1),
  'Hands': () => goto(worldOf('Hands'), 22, 4),
  'Winding': () => goto(worldOf('Winding'), 18),
};
const camF = gui.addFolder('Camera');
for (const k of Object.keys(cams)) camF.add(cams, k);

// ── Resize ────────────────────────────────────────────────────────
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!userOrbited) fitCamera(); // keep the movement in frame until the user orbits themselves
}
window.addEventListener('resize', resize);
resize();

// ── Loop ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let simT = 0; // simulation time; the movement is driven by the escapement (the «tick-tock»)

function tick() {
  const dt = clock.getDelta();
  if (params.running) {
    if (params.timeMode === 'real') {
      movement.setClockTime(new Date(), params);
    } else {
      simT += dt * params.speed;
      movement.setTime(simT, params);
    }
  }
  movement.winder.update(dt);
  fly.update();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Debug hook: manual advance and render (for checking when the tab is hidden).
window.__simwatch = {
  movement, params, renderer, scene, camera,
  setTime(t) { simT = t; return movement.setTime(t, params); },
  setClockTime(date = new Date()) { return movement.setClockTime(date, params); },
  getTime() { return simT; },
  setDrive(a) { movement.update(a); },
};
