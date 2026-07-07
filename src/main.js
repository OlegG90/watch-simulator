import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import { buildMovement } from './movement.js';
import { buildLabels, createCameraFly } from './ui.js';

// ── Сцена / рендер ────────────────────────────────────────────────
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c20);

// Оточення для відблисків на металі.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ── Освітлення ────────────────────────────────────────────────────
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

// ── Матеріали ─────────────────────────────────────────────────────
const brass = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 0.35, metalness: 0.9 });
const steel = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.95 });
const axleMat = new THREE.MeshStandardMaterial({ color: 0x666a72, roughness: 0.4, metalness: 0.8 });
const ruby = new THREE.MeshStandardMaterial({ color: 0xc0304a, roughness: 0.2, metalness: 0.1, emissive: 0x30040a });
const springMat = new THREE.LineBasicMaterial({ color: 0x5b7fd4 });
const plateMat = new THREE.MeshStandardMaterial({ color: 0x8a7440, roughness: 0.55, metalness: 0.7 });
const bluedMat = new THREE.MeshStandardMaterial({ color: 0x24418f, roughness: 0.3, metalness: 0.85 });
const springSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.32, metalness: 0.95, side: THREE.DoubleSide });

// ── Механізм (передача + спуск) ───────────────────────────────────
const movement = buildMovement({ brass, steel, axleMat, ruby, springMat, plateMat, bluedMat, springSteel });
scene.add(movement.root);

// Підписи вузлів.
const labels = buildLabels(movement.focusPoints);
movement.root.add(labels);

// ── Тло-плита ─────────────────────────────────────────────────────
const plateR = Math.max(movement.size.w, movement.size.h) / 2 + 10;
const plate = new THREE.Mesh(
  new THREE.CircleGeometry(plateR, 64),
  new THREE.MeshStandardMaterial({ color: 0x222530, roughness: 0.9, metalness: 0.1 })
);
plate.rotation.x = -Math.PI / 2;
plate.position.y = -movement.size.h / 2 - 2.5;
plate.receiveShadow = true;
scene.add(plate);

// ── Камера: вписати механізм у кадр (з урахуванням аспекту) ───────
const fitR = Math.hypot(movement.size.w, movement.size.h) / 2;
const viewDir = new THREE.Vector3(0.12, 0.22, 1).normalize();
const fly = createCameraFly(camera, controls);
let userOrbited = false;
controls.addEventListener('start', () => {
  userOrbited = true;
  fly.cancel(); // ручне орбітання перериває переліт
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
gui.add(params, 'running').name('Рух');
gui.add(params, 'timeMode', {
  'Демонстраційний час': 'demo',
  'Реальний час': 'real',
}).name('Режим часу');
gui.add(params, 'speed', 0, 10, 0.1).name('Швидкість');
gui.add(params, 'beatHz', 0.5, 6, 0.1).name('Хід, уд/с');
gui.add(params, 'amplitude', 90, 270, 5).name('Амплітуда, °');
gui.add(params, 'wireframe').name('Каркас').onChange((v) => {
  brass.wireframe = v;
  steel.wireframe = v;
});
gui.add({ wind: () => movement.winder.wind() }, 'wind').name('⟳ Завести пружину');
gui.add(labels, 'visible').name('Підписи');
const nodes = gui.addFolder('Вузли');
for (const a of movement.arbors) nodes.add(a.group, 'visible').name(a.name);
nodes.add(movement.escapement.fork, 'visible').name('Анкер (вилка)');
nodes.add(movement.escapement.balance, 'visible').name('Баланс');
nodes.add(movement.escapement.springGroup, 'visible').name('Спіраль');
const mwVis = { hands: true, winding: true };
nodes.add(mwVis, 'hands').name('Стрілки + моторний мех.').onChange((v) => {
  for (const g of Object.values(movement.motionWorks)) g.visible = v;
});
nodes.add(mwVis, 'winding').name('Заведення').onChange((v) => (movement.winder.group.visible = v));

// Пресети камери.
const worldOf = (name) => {
  const fp = movement.focusPoints.find((f) => f.name === name);
  return new THREE.Vector3(fp.pos.x, fp.pos.y, fp.z).add(movement.root.position);
};
const goto = (target, back, up = 2) =>
  fly.flyTo(target.clone().add(new THREE.Vector3(0, up, back)), target);
const cams = {
  'Загальний вид': () => {
    const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hTan = vTan * camera.aspect;
    fly.flyTo(viewDir.clone().multiplyScalar((fitR / Math.min(vTan, hTan)) * 1.05), new THREE.Vector3());
  },
  'Барабан': () => goto(worldOf('Барабан'), 26),
  'Передача': () => goto(worldOf('Проміжне колесо'), 34, 4),
  'Спуск': () => goto(worldOf('Анкер'), 22),
  'Баланс': () => goto(worldOf('Баланс'), 16, 1),
  'Стрілки': () => goto(worldOf('Стрілки'), 22, 4),
  'Заведення': () => goto(worldOf('Заведення'), 18),
};
const camF = gui.addFolder('Камера');
for (const k of Object.keys(cams)) camF.add(cams, k);

// ── Ресайз ────────────────────────────────────────────────────────
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!userOrbited) fitCamera(); // тримати механізм у кадрі, поки користувач не орбітав сам
}
window.addEventListener('resize', resize);
resize();

// ── Цикл ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let simT = 0; // час симуляції; механізм рухається від спуску («тік-так»)

function tick() {
  const dt = clock.getDelta();
  if (params.running) {
    if (params.timeMode === 'real') {
      simT += dt; // хід балансу в реальному темпі (beatHz), незалежно від «Швидкість»
      movement.setClockTime(new Date(), simT, params);
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

// Дебаг-хук: ручне просування й рендер (для перевірки, коли вкладка прихована).
window.__simwatch = {
  movement, params, renderer, scene, camera,
  setTime(t) { simT = t; return movement.setTime(t, params); },
  setClockTime(date = new Date(), beatT = simT) { return movement.setClockTime(date, beatT, params); },
  getTime() { return simT; },
  setDrive(a) { movement.update(a); },
};
