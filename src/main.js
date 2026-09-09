import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';
import { buildMovement } from './movement.js';
import { PLANNED_IDS } from './escapement/index.js';
import { buildShowcase } from './showcase/leverModel.js';
import { mountShowcaseBar } from './showcase/bar.js';
import { BEAT_HZ } from './showcase/motion.js';
import { buildLabels, createCameraFly } from './ui.js';
import { t, getLang, setLang, onLangChange, LANGS } from './i18n.js';
import { createHighlighter } from './lesson/highlight.js';
import { mountLesson } from './lesson/panel.js';
import { createSettings } from './settings.js';

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
scene.environmentIntensity = 0.72;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ── Lighting ──────────────────────────────────────────────────────
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
// A spot on the tourbillon — it picks out the chamfers of the blued cage and the rubies without blowing out the brass.
const cageSpot = new THREE.SpotLight(0xffffff, 6.0, 30, Math.PI / 6, 0.45, 1.1);
cageSpot.castShadow = false;
scene.add(cageSpot);
scene.add(cageSpot.target);

// ── Materials ─────────────────────────────────────────────────────
const brass = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 0.35, metalness: 0.9 });
const steel = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.95 });
const axleMat = new THREE.MeshStandardMaterial({ color: 0x666a72, roughness: 0.4, metalness: 0.8 });
const ruby = new THREE.MeshStandardMaterial({ color: 0xc0304a, roughness: 0.2, metalness: 0.1, emissive: 0x30040a });
const plateMat = new THREE.MeshStandardMaterial({ color: 0x8a7440, roughness: 0.55, metalness: 0.7 });
const bluedMat = new THREE.MeshStandardMaterial({ color: 0x24418f, roughness: 0.3, metalness: 0.85 });
const springSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.32, metalness: 0.95, side: THREE.DoubleSide });
// The back plate — dark and cool, so the movement's brass/steel and the tourbillon cage stand out against it.
const backdropMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.7, metalness: 0.4 });
// The tourbillon cage — blued steel: it reads clearly against the golden ground and among the brass wheels.
const cageMat = new THREE.MeshStandardMaterial({ color: 0x2f4b8c, roughness: 0.22, metalness: 0.92 });
cageMat.envMapIntensity = 1.15;

// ── The movement (train + escapement) ─────────────────────────────
const movement = buildMovement({ brass, steel, axleMat, ruby, plateMat, bluedMat, springSteel, backdropMat, cageMat });
scene.add(movement.root);
// Aim the spot at the centre of the cage (after root has been centred).
const escFocus = movement.focusPoints.find((f) => f.id === 'escapement');
{
  const cageWorld = new THREE.Vector3(escFocus.pos.x, escFocus.pos.y, 2.0)
                                      .add(movement.root.position);
  cageSpot.position.set(cageWorld.x + 6, cageWorld.y + 8, cageWorld.z + 14);
  cageSpot.target.position.set(cageWorld.x, cageWorld.y, cageWorld.z + 1.0);
}

// Node labels. The text is baked into a texture, so on a language change they have
// to be rebuilt — the group itself stays the same.
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

// ── Showcase: a self-contained exhibit, not a module of the movement ─
// Hidden until its mode is chosen. Nothing from the movement looks in here and
// nothing is read out of it: there is no synchronisation, by decision.
const showcase = buildShowcase();
scene.add(showcase.group);
// The showcase's phase time (in beats) lives here, not in the model: the panel's pause
// and step are a stop and a manual advance, and the model stays a pure function of time.
const show = { t: 0.5, playing: true, speed: 0.5 };
const showBar = mountShowcaseBar(document.getElementById('showcase-bar'), show);

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
  controls.target.set(0, 0, 0); // otherwise the target stays on the previous node
}

// ── UI ────────────────────────────────────────────────────────────
// The free-mode panel is an adapter over the settings table: it takes bounds, step and
// label from there rather than keeping a copy of its own.
const settings = createSettings();
const params = settings.values;
let gui = null;
let guiVariant = null;  // which escapement module the node panel was built for
let uiMode = 'lesson'; // the free-mode panel stays hidden while the lesson runs
const powerUI = { power: 75 };
// The escape arbor IS the tourbillon cage (the cage sits on its arbor), so it appears
// once in the list, under the name «Tourbillon»: the toggle hides the whole node along
// with the cage. The fixed wheel stands separately in the scene, the balance inside the cage.
const cageArbor = movement.arbors.find((a) => a.spec.escapeTeeth);

/**
 * Where the camera looks — one place.
 *
 * Until now three parties shared this one job: `movement` held the points, `main` a
 * list of presets keyed differently (`nameKey` instead of `id`), and the panel a
 * fourth copy of the answer in `state.cam`. Half the stations named a point that was
 * not in that list, and the flight silently fell back to the overview: the card said
 * «Winding» while the camera showed the whole movement.
 */
const focus = (() => {
  let current = null;   // null = the overview

  const worldOf = (f) => new THREE.Vector3(f.pos.x, f.pos.y, f.z).add(movement.root.position);

  /** The points the scene chrome offers as buttons. */
  const targets = () => movement.focusPoints.filter((f) => f.preset)
    .map(({ id, nameKey }) => ({ id, nameKey }));

  function overview() {
    current = null;
    userOrbited = false; // the overview brings the movement back into frame and re-enables fitting
    const vTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hTan = vTan * camera.aspect;
    fly.flyTo(viewDir.clone().multiplyScalar((fitR / Math.min(vTan, hTan)) * 1.05), new THREE.Vector3());
  }

  /**
   * Point the camera at a focus point by its stable `id`.
   *
   * An unknown id is an error, not a quiet overview: it was exactly that silence that
   * hid the fact that three of the six stations had nowhere to fly.
   */
  function goto(id) {
    const f = movement.focusPoints.find((x) => x.id === id);
    if (!f) throw new Error(`unknown focus point: ${id}`);
    current = id;
    // A flight to a node switches off automatic framing: otherwise a resize (and a mode
    // switch is a resize) would yank the camera away from the node.
    userOrbited = true;
    const target = worldOf(f);
    fly.flyTo(target.clone().add(new THREE.Vector3(0, f.up, f.back)), target);
  }

  return { targets, goto, overview, get current() { return current; } };
})();

/** One node knob, from its owner's declaration. */
function addNode(folder, n) {
  const c = n.kind === 'range'
    ? folder.add(n.obj, n.prop, n.min, n.max, n.step)
    : folder.add(n.obj, n.prop);
  c.name(t(n.labelKey));
  if (n.onChange) c.onChange(n.onChange);
  return c;
}

/** One knob from the settings table: kind, bounds and label — all from there. */
function addParam(gui, name) {
  const s = settings.spec(name);
  const c = s.kind === 'range' ? gui.add(params, name, s.min, s.max, s.step)
    : s.kind === 'choice' ? gui.add(params, name,
      Object.fromEntries(s.options.map(([value, key]) => [t(key), value])))
      : gui.add(params, name);
  return c.name(t(s.labelKey));
}

/** lil-gui bakes labels in at creation time, so a language change = rebuilding the panel. */
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

  // Nodes: the train arbors, then whatever the movement itself declared, then the knobs
  // of the INSTALLED escapement module. The panel names no variant — until now it kept
  // the tourbillon's toggles and showed that module's parts beside the lever
  // escapement, even though the movement holds exactly one module.
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
  // A language change rebuilds the panel — it must inherit the mode, otherwise the
  // free-mode interface surfaces during the lesson.
  gui.domElement.style.display = uiMode === 'free' ? '' : 'none';
}
buildGui();

onLangChange(() => {
  rebuildLabels();
  buildGui();
  document.getElementById('hint').textContent = t('hint.controls');
});

// ── Resize ────────────────────────────────────────────────────────
// The canvas lives in a grid cell, so the size is taken from it rather than from the
// window: a mode switch changes the cell without any window event.
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!userOrbited) fitCamera(); // keep the movement in frame until the user orbits themselves
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
resize();

// ── Lesson ────────────────────────────────────────────────────────
let freeLabels = true; // the state of the labels in free mode
const highlighter = createHighlighter(movement.root);
const statusOut = { real: false, speed: 1, charge: 0, time: 0 };
const lesson = mountLesson({
  highlighter,
  escapement: movement.escapement,
  planned: PLANNED_IDS,
  camera: focus,
  settings,
  run: (action) => { if (action === 'wind') movement.winder.wind(); },
  // Called from the render loop, so it fills the same object: it is read synchronously
  // and not stored.
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
    // The showcase swaps the scene's contents with the movement's: the exhibit is
    // visible only here, the movement everywhere but here. The camera flies to the showcase's home point.
    const inShowcase = mode === 'showcase';
    movement.root.visible = !inShowcase;
    plate.visible = !inShowcase;
    showcase.group.visible = inShowcase;
    if (inShowcase) {
      userOrbited = true; // do not let frame fitting yank the camera back
      fly.flyTo(showcase.home.pos, showcase.home.target);
      // The entry is from the lock: time is pulled to the nearest half-integer, where the
      // wheel stands at the measured phase rather than mid-unlocking.
      show.t = Math.round(show.t - 0.5) + 0.5;
      document.getElementById('showcase-bar').hidden = false;
    } else {
      document.getElementById('showcase-bar').hidden = true;
    }
    // Both panels write into one table, but lil-gui shows what it read at creation time.
    // Without this, a knob moved on a station card would leave the old number in free
    // mode — beside a live movement already running on the new one.
    // The node panel is built for the installed escapement module, so after a swap it
    // has to be assembled again. Otherwise: refresh the display — lil-gui shows what it
    // read at creation, and the knob may have been moved on a station card.
    if (mode === 'free') {
      if (guiVariant !== movement.escapement.installed) buildGui();
      else for (const c of gui.controllersRecursive()) c.updateDisplay();
    }
    // The sprite labels have a fixed world size: from close up they cover the very node
    // they name. In the lesson the card names the station, so the labels are hidden —
    // in free mode they come back exactly as they were.
    if (mode === 'lesson') { freeLabels = labels.visible; labels.visible = false; }
    else labels.visible = freeLabels;
    resize();
  },
});
lesson.setMode('lesson');
document.getElementById('hint').textContent = t('hint.controls');

// ── Loop ──────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let simT = 0; // simulation time; the movement is driven by the escapement (the «tick-tock»)

function tick() {
  const dt = clock.getDelta();
  if (params.running) {
    if (params.timeMode === 'real') {
      simT += dt; // the balance beats at real tempo (beatHz), independent of «Speed»
      movement.setClockTime(new Date(), simT, params);
    } else if (movement.winder.charge > 0) {
      // A demo run is possible only while there is wind; the differential counts the
      // consumption itself (the lower sun is driven by the barrel wheel's rotation).
      simT += dt * params.speed;
      movement.setTime(simT, params);
    }
  }
  movement.winder.update(dt);
  powerUI.power = Math.round(movement.winder.charge * 100);
  if (uiMode === 'showcase') {
    if (show.playing) show.t += dt * BEAT_HZ * show.speed;
    showcase.update(show.t);
    showBar.update();
  }
  lesson.update();
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
  setClockTime(date = new Date(), beatT = simT) { return movement.setClockTime(date, beatT, params); },
  getTime() { return simT; },
  setDrive(a) { movement.update(a); },
};
