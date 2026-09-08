import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import { buildMovement } from './movement.js';
import { PLANNED_IDS } from './escapement/index.js';
import { buildLabels, createCameraFly } from './ui.js';
import { t, getLang, setLang, onLangChange, LANGS } from './i18n.js';
import { createHighlighter } from './lesson/highlight.js';
import { mountLesson } from './lesson/panel.js';
import { createSettings } from './settings.js';

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
const plateMat = new THREE.MeshStandardMaterial({ color: 0x8a7440, roughness: 0.55, metalness: 0.7 });
const bluedMat = new THREE.MeshStandardMaterial({ color: 0x24418f, roughness: 0.3, metalness: 0.85 });
const springSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.32, metalness: 0.95, side: THREE.DoubleSide });
// Задня платина — темна й прохолодна, щоб латунь/сталь механізму й кліть турбійона контрастували.
const backdropMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.7, metalness: 0.4 });
// Кліть турбійона — воронена сталь: виразно виділяється на золотому тлі й серед латунних коліс.
const cageMat = new THREE.MeshStandardMaterial({ color: 0x2f4b8c, roughness: 0.22, metalness: 0.92 });
cageMat.envMapIntensity = 1.15;

// ── Механізм (передача + спуск) ───────────────────────────────────
const movement = buildMovement({ brass, steel, axleMat, ruby, plateMat, bluedMat, springSteel, backdropMat, cageMat });
scene.add(movement.root);
// Націлити спот на центр кліті (після центрування root).
const escFocus = movement.focusPoints.find((f) => f.id === 'escapement');
{
  const cageWorld = new THREE.Vector3(escFocus.pos.x, escFocus.pos.y, 2.0)
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
// Панель вільного режиму — адаптер над таблицею налаштувань: межі, крок і
// підпис бере звідти, а не тримає власну копію.
const settings = createSettings();
const params = settings.values;
let gui = null;
let guiVariant = null;  // з яким модулем спуску побудовано панель вузлів
let uiMode = 'lesson'; // панель вільного режиму схована, поки триває урок
const powerUI = { power: 75 };
// Анкерний вузол — це і є кліть турбійона (кліть сидить на його осі), тож у
// списку він один раз, під назвою «Турбійон»: тумблер ховає весь вузол разом
// із кліттю. Нерухоме колесо стоїть окремо в сцені, баланс — усередині кліті.
const cageArbor = movement.arbors.find((a) => a.spec.escapeTeeth);

/**
 * Куди дивиться камера — одне місце.
 *
 * Доти цю саму дію ділили троє: `movement` тримав точки, `main` — список
 * пресетів під іншим ключем (`nameKey` замість `id`), а панель — четверту
 * копію відповіді у `state.cam`. Половина станцій називала точку, якої в тому
 * списку не було, і переліт мовчки підмінявся загальним видом: картка казала
 * «Заведення», а камера показувала весь механізм.
 */
const focus = (() => {
  let current = null;   // null = загальний вид

  const worldOf = (f) => new THREE.Vector3(f.pos.x, f.pos.y, f.z).add(movement.root.position);

  /** Точки, які хром сцени показує кнопками. */
  const targets = () => movement.focusPoints.filter((f) => f.preset)
    .map(({ id, nameKey }) => ({ id, nameKey }));

  function overview() {
    current = null;
    userOrbited = false; // загальний вид повертає механізм у кадр і дозволяє підгонку
    const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hTan = vTan * camera.aspect;
    fly.flyTo(viewDir.clone().multiplyScalar((fitR / Math.min(vTan, hTan)) * 1.05), new THREE.Vector3());
  }

  /**
   * Навести камеру на точку за її стабільним `id`.
   *
   * Невідомий id — помилка, а не тихий загальний вид: саме тиша й ховала те,
   * що трьом станціям із шести не було куди летіти.
   */
  function goto(id) {
    const f = movement.focusPoints.find((x) => x.id === id);
    if (!f) throw new Error(`невідома точка фокуса: ${id}`);
    current = id;
    // Переліт до вузла зупиняє автопідгонку кадру: інакше ресайз (а
    // перемикання режиму — це ресайз) відсмикнув би камеру від вузла.
    userOrbited = true;
    const target = worldOf(f);
    fly.flyTo(target.clone().add(new THREE.Vector3(0, f.up, f.back)), target);
  }

  return { targets, goto, overview, get current() { return current; } };
})();

/** Одна ручка вузла з оголошення власника. */
function addNode(folder, n) {
  const c = n.kind === 'range'
    ? folder.add(n.obj, n.prop, n.min, n.max, n.step)
    : folder.add(n.obj, n.prop);
  c.name(t(n.labelKey));
  if (n.onChange) c.onChange(n.onChange);
  return c;
}

/** Одна ручка з таблиці налаштувань: вид, межі й підпис — усе звідти. */
function addParam(gui, name) {
  const s = settings.spec(name);
  const c = s.kind === 'range' ? gui.add(params, name, s.min, s.max, s.step)
    : s.kind === 'choice' ? gui.add(params, name,
      Object.fromEntries(s.options.map(([value, key]) => [t(key), value])))
      : gui.add(params, name);
  return c.name(t(s.labelKey));
}

/** lil-gui вшиває підписи при створенні, тож зміна мови = перебудова панелі. */
function buildGui() {
  gui?.destroy();
  gui = new GUI({ title: 'SimWatch' });
  for (const name of settings.names) {
    const c = addParam(gui, name);
    if (name === 'wireframe') {
      c.onChange((v) => { brass.wireframe = v; steel.wireframe = v; });
    }
  }
  gui.add({ wind: () => movement.winder.wind() }, 'wind').name(t('gui.wind'));
  gui.add(powerUI, 'power', 0, 100, 1).name(t('gui.charge')).listen().disable();
  gui.add(labels, 'visible').name(t('gui.labels'));

  // Вузли: осі передачі, далі те, що оголосив сам механізм, далі ручки
  // ВСТАНОВЛЕНОГО модуля спуску. Панель не називає жодного варіанта — доти
  // вона тримала тумблери турбійона й показувала його деталі поряд із
  // анкерним спуском, хоч у механізмі стоїть рівно один модуль.
  const nodes = gui.addFolder(t('gui.nodes'));
  for (const a of movement.arbors) {
    if (a !== cageArbor) nodes.add(a.group, 'visible').name(t(a.nameKey));
  }
  nodes.add(cageArbor.group, 'visible').name(t(escFocus.nameKey));
  for (const n of movement.escapement.nodes()) addNode(nodes, n);
  for (const n of movement.nodes) addNode(nodes, n);
  guiVariant = movement.escapement.installed;

  const camF = gui.addFolder(t('gui.camera'));
  camF.add({ f: () => focus.overview() }, 'f').name(t('cam.overview'));
  for (const { id, nameKey } of focus.targets()) {
    camF.add({ f: () => focus.goto(id) }, 'f').name(t(nameKey));
  }

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
  escapement: movement.escapement,
  planned: PLANNED_IDS,
  camera: focus,
  settings,
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
    // Обидві панелі пишуть в одну таблицю, але lil-gui показує те, що
    // прочитав при створенні. Без цього ручка, зрушена на картці станції,
    // лишала б у вільному режимі старе число — при живому механізмі, що вже
    // йде за новим.
    // Панель вузлів будується під встановлений модуль спуску, тож після заміни
    // її треба зібрати наново. Інакше — оновити показ: lil-gui показує те, що
    // прочитав при створенні, а ручку могли зрушити на картці станції.
    if (mode === 'free') {
      if (guiVariant !== movement.escapement.installed) buildGui();
      else for (const c of gui.controllersRecursive()) c.updateDisplay();
    }
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
