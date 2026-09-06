import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import { buildMovement } from './movement.js';
import { buildLabels, createCameraFly } from './ui.js';
import { t, getLang, setLang, onLangChange, LANGS } from './i18n.js';
import { createHighlighter } from './lesson/highlight.js';
import { mountLesson } from './lesson/panel.js';

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
scene.environmentIntensity = 0.72;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ── Освітлення ────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.18));
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
const fill = new THREE.DirectionalLight(0x88aaff, 0.55);
fill.position.set(-20, 8, -12);
scene.add(fill);
// Точкове підсвічування турбійона — виділяє фаски вороненої кліті та рубіни без пересвіту латуні.
const cageSpot = new THREE.SpotLight(0xffffff, 6.0, 30, Math.PI / 6, 0.45, 1.1);
cageSpot.castShadow = false;
scene.add(cageSpot);
scene.add(cageSpot.target);

// ── Матеріали ─────────────────────────────────────────────────────
const brass = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 0.35, metalness: 0.9 });
const steel = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.95 });
const axleMat = new THREE.MeshStandardMaterial({ color: 0x666a72, roughness: 0.4, metalness: 0.8 });
const ruby = new THREE.MeshStandardMaterial({ color: 0xc0304a, roughness: 0.2, metalness: 0.1, emissive: 0x30040a });
const springMat = new THREE.LineBasicMaterial({ color: 0x5b7fd4 });
const plateMat = new THREE.MeshStandardMaterial({ color: 0x8a7440, roughness: 0.55, metalness: 0.7 });
const bluedMat = new THREE.MeshStandardMaterial({ color: 0x24418f, roughness: 0.3, metalness: 0.85 });
const springSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.32, metalness: 0.95, side: THREE.DoubleSide });
// Задня платина — темна й прохолодна, щоб латунь/сталь механізму й кліть турбійона контрастували.
const backdropMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.7, metalness: 0.4 });
// Кліть турбійона — воронена сталь: виразно виділяється на золотому тлі й серед латунних коліс.
const cageMat = new THREE.MeshStandardMaterial({ color: 0x2f4b8c, roughness: 0.22, metalness: 0.92 });
cageMat.envMapIntensity = 1.15;

// ── Механізм (передача + спуск) ───────────────────────────────────
const movement = buildMovement({ brass, steel, axleMat, ruby, springMat, plateMat, bluedMat, springSteel, backdropMat, cageMat });
scene.add(movement.root);
// Націлити спот на центр кліті (після центрування root).
{
  const cageWorld = new THREE.Vector3(movement.focusPoints.find((f) => f.nameKey === 'part.tourbillon').pos.x,
                                      movement.focusPoints.find((f) => f.nameKey === 'part.tourbillon').pos.y, 2.0)
                                      .add(movement.root.position);
  cageSpot.position.set(cageWorld.x + 6, cageWorld.y + 8, cageWorld.z + 14);
  cageSpot.target.position.set(cageWorld.x, cageWorld.y, cageWorld.z + 1.0);
}

// Підписи вузлів. Текст запікається в текстуру, тож при зміні мови їх
// доводиться будувати наново — сама група лишається тією ж.
let labels = buildLabels(movement.focusPoints);
movement.root.add(labels);

function rebuildLabels() {
  const visible = labels.visible;
  movement.root.remove(labels);
  labels.traverse((o) => { o.material?.map?.dispose?.(); o.material?.dispose?.(); });
  labels = buildLabels(movement.focusPoints);
  labels.visible = visible;
  movement.root.add(labels);
}

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
  controls.target.set(0, 0, 0); // інакше ціль лишиться на попередньому вузлі
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
let gui = null;
let uiMode = 'lesson'; // панель вільного режиму схована, поки триває урок
const powerUI = { power: 75 };
const mwVis = { hands: true, winding: true };
// Анкерний вузол — це і є кліть турбійона (кліть сидить на його осі), тож у
// списку він один раз, під назвою «Турбійон»: тумблер ховає весь вузол разом
// із кліттю. Нерухоме колесо стоїть окремо в сцені, баланс — усередині кліті.
const cageArbor = movement.arbors.find((a) => a.spec.escapeTeeth);

const worldOf = (key) => {
  const fp = movement.focusPoints.find((f) => f.nameKey === key);
  return new THREE.Vector3(fp.pos.x, fp.pos.y, fp.z).add(movement.root.position);
};
// Переліт до вузла зупиняє автопідгонку кадру: інакше ресайз (а перемикання
// режиму — це ресайз) відсмикнув би камеру від щойно наведеного вузла.
const goto = (target, back, up = 2) => {
  userOrbited = true;
  fly.flyTo(target.clone().add(new THREE.Vector3(0, up, back)), target);
};
const overview = () => {
  userOrbited = false; // загальний вид повертає механізм у кадр і дозволяє підгонку
  const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const hTan = vTan * camera.aspect;
  fly.flyTo(viewDir.clone().multiplyScalar((fitR / Math.min(vTan, hTan)) * 1.05), new THREE.Vector3());
};
const CAMS = [
  ['cam.overview', overview],
  ['part.hands', () => goto(worldOf('part.hands'), 22, 4)],
  ['part.powerReserve', () => goto(worldOf('part.powerReserve'), 13, 1)],
  ['part.tourbillon', () => goto(worldOf('part.tourbillon'), 15, 3)],
];

/** lil-gui вшиває підписи при створенні, тож зміна мови = перебудова панелі. */
function buildGui() {
  gui?.destroy();
  gui = new GUI({ title: 'SimWatch' });
  gui.add(params, 'running').name(t('gui.running'));
  gui.add(params, 'timeMode', {
    [t('gui.timeDemo')]: 'demo',
    [t('gui.timeReal')]: 'real',
  }).name(t('gui.timeMode'));
  gui.add(params, 'speed', 0, 10, 0.1).name(t('gui.speed'));
  gui.add(params, 'beatHz', 0.5, 6, 0.1).name(t('gui.beat'));
  gui.add(params, 'amplitude', 90, 270, 5).name(t('gui.amplitude'));
  gui.add(params, 'wireframe').name(t('gui.wireframe')).onChange((v) => {
    brass.wireframe = v;
    steel.wireframe = v;
  });
  gui.add({ wind: () => movement.winder.wind() }, 'wind').name(t('gui.wind'));
  gui.add(powerUI, 'power', 0, 100, 1).name(t('gui.charge')).listen().disable();
  gui.add(labels, 'visible').name(t('gui.labels'));

  const tourbillonVis = { cageOpacity: 1.0, topPlate: true };
  const nodes = gui.addFolder(t('gui.nodes'));
  for (const a of movement.arbors) {
    if (a !== cageArbor) nodes.add(a.group, 'visible').name(t(a.nameKey));
  }
  nodes.add(cageArbor.group, 'visible').name(t('part.tourbillon'));
  nodes.add(movement.tourbillon.fixed, 'visible').name(t('part.fixedWheel'));
  nodes.add(movement.tourbillon.balance, 'visible').name(t('part.balance'));
  nodes.add(tourbillonVis, 'cageOpacity', 0.15, 1.0, 0.05).name('Кліть — прозорість').onChange((v) => movement.tourbillon.setCageOpacity(v));
  nodes.add(tourbillonVis, 'topPlate').name('Кліть — верхня платівка').onChange((v) => movement.tourbillon.setTopPlateVisible(v));
  nodes.add(mwVis, 'hands').name(t('gui.handsAndMotionWorks')).onChange((v) => {
    for (const g of Object.values(movement.motionWorks)) g.visible = v;
  });
  nodes.add(mwVis, 'winding').name(t('part.winding')).onChange((v) => (movement.winder.group.visible = v));
  nodes.add(movement.powerReserve.group, 'visible').name(t('part.powerReserve'));

  const camF = gui.addFolder(t('gui.camera'));
  for (const [key, fn] of CAMS) camF.add({ [key]: fn }, key).name(t(key));

  gui.add({ lang: () => setLang(getLang() === 'ua' ? 'en' : 'ua') }, 'lang')
     .name(getLang() === 'ua' ? 'EN' : 'УКР');
  // Зміна мови будує панель наново — вона мусить успадкувати режим,
  // інакше в уроці зринає інтерфейс вільного режиму.
  gui.domElement.style.display = uiMode === 'free' ? '' : 'none';
}
buildGui();

onLangChange(() => {
  rebuildLabels();
  buildGui();
  document.getElementById('hint').textContent = t('hint.controls');
});

// ── Ресайз ────────────────────────────────────────────────────────
// Полотно живе в клітинці сітки, тож розмір беремо з нього, а не з вікна:
// перемикання режиму міняє клітинку без жодної події вікна.
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!userOrbited) fitCamera(); // тримати механізм у кадрі, поки користувач не орбітав сам
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
resize();

// ── Урок ──────────────────────────────────────────────────────────
let freeLabels = true; // стан підписів у вільному режимі
const highlighter = createHighlighter(movement.root);
const statusOut = { real: false, speed: 1, charge: 0, time: 0 };
const lesson = mountLesson({
  highlighter,
  camera: {
    presets: CAMS,
    overview,
    toKey: (key) => (CAMS.find(([k]) => k === key)?.[1] ?? overview)(),
  },
  params,
  run: (action) => { if (action === 'wind') movement.winder.wind(); },
  // Кличеться з циклу рендеру, тому заповнює той самий об'єкт: читають його
  // синхронно й не зберігають.
  status: () => {
    statusOut.real = params.timeMode === 'real';
    statusOut.speed = params.speed;
    statusOut.charge = movement.winder.charge;
    statusOut.time = simT;
    return statusOut;
  },
  onMode: (mode) => {
    uiMode = mode;
    gui.domElement.style.display = mode === 'free' ? '' : 'none';
    // Підписи-спрайти мають сталий світовий розмір: зблизька вони закривають
    // сам вузол. В уроці станцію називає картка, тож підписи ховаємо —
    // у вільному режимі вони повертаються такими, як були.
    if (mode === 'lesson') { freeLabels = labels.visible; labels.visible = false; }
    else labels.visible = freeLabels;
    resize();
  },
});
lesson.setMode('lesson');
document.getElementById('hint').textContent = t('hint.controls');

// ── Цикл ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let simT = 0; // час симуляції; механізм рухається від спуску («тік-так»)

function tick() {
  const dt = clock.getDelta();
  if (params.running) {
    if (params.timeMode === 'real') {
      simT += dt; // хід балансу в реальному темпі (beatHz), незалежно від «Швидкість»
      movement.setClockTime(new Date(), simT, params);
    } else if (movement.winder.charge > 0) {
      // Демо-хід можливий лише поки є завод; витрату рахує сам диференціал
      // (нижнє сонце живиться від обертання барабанного колеса).
      simT += dt * params.speed;
      movement.setTime(simT, params);
    }
  }
  movement.winder.update(dt);
  powerUI.power = Math.round(movement.winder.charge * 100);
  lesson.update();
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
