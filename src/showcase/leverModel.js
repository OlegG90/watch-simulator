import * as THREE from 'three';
import { wheelAngle, forkAngle, balanceAngle, activePallet } from './motion.js';
import { buildSpring, SPRING_R1 } from './spring.js';

/**
 * Самодостатня модель анкерного спуску — окремий експонат, не модуль руху.
 *
 * Ізоляція за рішенням з власником: ні синхронізації з гніздом спуску, ні
 * вбудовуваності, ні спільних будівельників. Файл імпортує лише three —
 * будь-який імпорт з `movement/`, `escapement/` чи `lesson/` перетворив би
 * вітрину на придаток руху (текстовий тест у `test/showcase.test.js` це стереже).
 *
 * Компоновка (вид зверху, вісь X — лінія центрів):
 *   W=(0,0)     анкерне колесо, 15 клубових зубців, хід проти годинникової;
 *   P=(2.35,0)  вісь вилки: палети з обох боків лінії центрів;
 *   B=(4.35,0)  вісь балансу: ролик з імпульсним каменем у прорізі вилки.
 *
 * Стек по Z (справжній порядок швейцарського ходу, не вигадка):
 *   колесо z≈0 → камені-палети в його площині → тіло вилки вище (z≈0.85) →
 *   ролик під вилкою, камінь стирчить вгору в проріз → баланс над усім →
 *   спіраль над балансом (z≈2.05), зовнішній кінець у нерухомій колодці.
 * Спіраль — ілюстрація дихання, не модель регулятора (див. `spring.js`).
 *
 * Точні кути граней — номінальні: замкова посадка (падіння, притягування)
 * розв'язується наступним кроком разом із фазною машиною. Геометрія віддає їй
 * півотні групи й камені — більше їй нічого не треба.
 */

export const TEETH = 15;
export const WHEEL_R = 1.5;
const WHEEL_ROOT = 1.02;
const WHEEL_T = 0.35;

/** W→P: вісь вилки. P→B: вісь балансу (хід вилки вміщується між ними). */
export const FORK_D = 2.35;
export const BAL_D = 2.0;

/** Камені: вхідний на +26°, центри в смузі зубців; вихідний — посадка падіння. */
const PALLET_ANG = (26 * Math.PI) / 180;
const PALLET_R = 1.3;
// Посадка падіння: нуль вихідного замка мінус нуль вхідного має дорівнювати
// півзубцю — інакше одна фаза не садить обидва. Виміряно: 30.65° (нулі
// 22.45°/10.75°, різниця 11.7° проти потрібних 12° — залишок 0.3° ділиться
// мінімаксом порівну). Дзеркальні ±26° тут не працюють: напрям руху ламає
// симетрію пари, що й показав перший замір.
const EXIT_ANG = (30.65 * Math.PI) / 180;
const EXIT_R = 1.3;
const JEWEL_W = 0.34;
const JEWEL_H = 0.62;
const JEWEL_T = 0.5;
/** Номінальний кут притягування запірної грані від радіуса. */
const LOCK_DRAW = (10 * Math.PI) / 180;
/** Геометрія каменя — тестам посадки, щоб не дублювати числа. */
export const JEWEL_GEOM = { w: JEWEL_W, h: JEWEL_H, lean: Math.tan(LOCK_DRAW) * JEWEL_H };

/** Тіло вилки над колесом; камінь ролика дістає в проріз знизу. */
const FORK_Z = 0.85;
const ROLLER_Z = 0.35;
const ROLLER_R = 0.55;
const PIN_R = 0.42;   // орбіта імпульсного каменя навколо осі балансу
const STONE_R = 0.09;

const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

/**
 * Фаза замка: сталий доворот колеса, щоб вістря сіло на запірну грань.
 * Виміряно мінімаксом по обох замках (колесо між ними йде рівно півзубця —
 * вихідний міряється на δ + півкроку): 22.58°, залишок 0.004. З нулем вістря
 * стоїть на півкроку повз камінь. Постановка першого кадру, не фізика.
 */
export const WHEEL_LOCK_PHASE = 0.3941;

/** Коробка між двома точками XY на заданій висоті. */
function bar(from, to, w, t, z, material) {
  const d = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(d.length(), w, t), material);
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, z);
  mesh.rotation.z = Math.atan2(d.y, d.x);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Колесо з клубовими зубцями: вістря нахилені за ходом, довга спинка —
 * імпульсна грань, коротка підрізана — запірна. Хід — проти годинникової
 * (+кут): матеріал зубця лежить позаду вістря.
 */
function makeClubWheel(material) {
  const step = (Math.PI * 2) / TEETH;
  const shape = new THREE.Shape();
  for (let i = 0; i < TEETH; i++) {
    const a = i * step;
    if (i === 0) shape.moveTo(...polar(WHEEL_R, a));
    else shape.lineTo(...polar(WHEEL_R, a)); // вістря
    shape.lineTo(...polar(WHEEL_ROOT, a - 0.10 * step)); // запірна грань, з підрізом
    shape.lineTo(...polar(WHEEL_ROOT * 0.96, a - 0.30 * step)); // западина
    shape.lineTo(...polar(WHEEL_ROOT, a - 0.52 * step)); // підйом спинки
    // Далі пряма до наступного вістря — довга імпульсна грань.
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.18, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  for (let i = 0; i < 4; i++) {
    const seg = (Math.PI * 2) / 4;
    const w = new THREE.Path();
    w.absarc(0, 0, 0.55, i * seg + 0.3, (i + 1) * seg - 0.3, false);
    w.lineTo(...polar(0.8, (i + 1) * seg - 0.3));
    w.absarc(0, 0, 0.8, (i + 1) * seg - 0.3, i * seg + 0.3, true);
    w.closePath();
    shape.holes.push(w);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: WHEEL_T, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -WHEEL_T / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.club = { teeth: TEETH, outerR: WHEEL_R, rootR: WHEEL_ROOT };
  return mesh;
}

/**
 * Камінь-палета: запірна грань (з притягуванням) + імпульсна (під ~50°).
 * `mirror` розвертає пару: вхідна й вихідна — дзеркальні, як у справжньому ході.
 */
function makePallet(material, mirror) {
  const w = JEWEL_W / 2, h = JEWEL_H / 2;
  const lean = Math.tan(LOCK_DRAW) * JEWEL_H; // зсув верху запірної грані
  const s = new THREE.Shape();
  s.moveTo(mirror * -w, -h);
  s.lineTo(mirror * (-w + lean), h); // запірна грань
  s.lineTo(mirror * w, h - 0.3); // імпульсна грань
  s.lineTo(mirror * w, -h);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: JEWEL_T, bevelEnabled: false });
  geo.translate(0, 0, -JEWEL_T / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function buildShowcase(opts = {}) {
  // Посадка падіння: вихідна палета стоїть не дзеркально (±26°), а там, де її
  // запірна грань лягає рівно на півзубця від вхідної, — інакше одна константа
  // фази не садить обидва замки. Значення — виміряні сканом падіння
  // (мінімакс по обох замках з вилкою в упорах), не окомірні.
  const { exitAng = EXIT_ANG, exitR = EXIT_R } = opts;
  const brass = new THREE.MeshStandardMaterial({ color: 0xcaa84a, roughness: 0.35, metalness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8bec8, roughness: 0.3, metalness: 0.95 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x555a62, roughness: 0.4, metalness: 0.8 });
  const springSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 0.32, metalness: 0.95, side: THREE.DoubleSide });
  const ruby = new THREE.MeshPhysicalMaterial({
    color: 0xc0304a, roughness: 0.12, metalness: 0.0,
    transmission: 0.28, thickness: 0.4, ior: 1.76,
    emissive: 0x1a050a, emissiveIntensity: 0.25,
  });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.85, metalness: 0.2 });

  const group = new THREE.Group();
  const V2 = (x, y) => new THREE.Vector2(x, y);

  // ── Підставка: музейний стенд, а не платина ──
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.5, 1.0, 48), stoneMat);
  pedestal.position.y = -3.2;
  pedestal.receiveShadow = true;
  group.add(pedestal);
  // Стрункі стійки до трьох осей — експонат тримається на виду, а не в плиті.
  const pillar = (x, top) => {
    const h = top + 2.7;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, h, 10), darkSteel);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, 0, -2.7 + h / 2);
    m.castShadow = true;
    group.add(m);
  };
  pillar(0, -0.3);
  pillar(FORK_D, 0.7);
  pillar(FORK_D + BAL_D, -0.3);

  // ── Анкерне колесо на власній осі ──
  const wheelPivot = new THREE.Group();
  const wheel = makeClubWheel(brass);
  wheelPivot.add(wheel);
  const wheelAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 12), darkSteel);
  wheelAxle.rotation.x = Math.PI / 2;
  wheelAxle.position.z = -0.3;
  wheelPivot.add(wheelAxle);
  group.add(wheelPivot);

  // ── Вилка: півот, плечі до каменів, хвіст із прорізом до ролика ──
  const forkPivot = new THREE.Group();
  forkPivot.position.set(FORK_D, 0, 0);
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 16), steel);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = FORK_Z;
  boss.castShadow = true;
  forkPivot.add(boss);

  const jewels = {};
  const jewelZ = 0.1;
  // ОБИДВА камені однакової форми: запірна грань мусить дивитись назустріч
  // зубцям, а напрям руху проти годинникової ламає дзеркальну симетрію пари —
  // віддзеркалений камінь став би до зубців глухою спиною (так і було: посадка
  // виходу не зійшлась ні на якій фазі). Орієнтацію дає розворот, не форма.
  for (const [face, side, ang, rad] of [['entry', 1, PALLET_ANG, PALLET_R], ['exit', -1, exitAng, exitR]]) {
    const a = side * ang;
    const [jx, jy] = polar(rad, a);
    // Матеріал каменя — власний екземпляр: підсвітка активної пари гасить
    // й засвічує камені окремо, спільний матеріал цього не вміє.
    const stone = makePallet(ruby.clone(), 1);
    stone.position.set(jx - FORK_D, jy, jewelZ);
    stone.rotation.z = a + Math.PI / 2; // мінус-u дивиться назустріч зубцям
    stone.userData.pallet = { face };
    forkPivot.add(stone);
    jewels[face] = stone;
    // Плече: горизонтальна штанга в площині вилки + стійка вниз до каменя.
    const top = V2(jx - FORK_D, jy);
    forkPivot.add(bar(V2(0, 0), top, 0.24, 0.26, FORK_Z, steel));
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, FORK_Z - jewelZ), steel);
    post.position.set(top.x, top.y, (FORK_Z + jewelZ) / 2);
    post.castShadow = true;
    forkPivot.add(post);
  }
  // Хвіст до ролика: проріз обіймає імпульсний камінь.
  const tailEnd = FORK_D + BAL_D - PIN_R; // світовий X каменя ролика
  forkPivot.add(bar(V2(0.3, 0), V2(tailEnd - FORK_D - 0.15, 0), 0.26, 0.26, FORK_Z, steel));
  for (const s of [1, -1]) {
    const horn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.26), steel);
    horn.position.set(tailEnd - FORK_D + 0.1, s * 0.165, FORK_Z);
    horn.castShadow = true;
    forkPivot.add(horn);
  }
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), darkSteel);
  guard.rotation.x = Math.PI / 2;
  guard.position.set(tailEnd - FORK_D - 0.35, 0, FORK_Z);
  forkPivot.add(guard);
  const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16), steel);
  counter.rotation.x = Math.PI / 2;
  counter.position.set(-0.55, 0, FORK_Z);
  counter.castShadow = true;
  forkPivot.add(counter);
  group.add(forkPivot);

  // ── Обмежувачі ходу вилки — нерухомі, хвіст б'є в них ──
  // Позиція відповідає розмаху: півширина хвоста + плече·tan(FORK_MAX).
  for (const s of [1, -1]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), darkSteel);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(FORK_D + 1.0, s * 0.2, FORK_Z);
    group.add(pin);
  }

  // ── Баланс: вісь, ролик з каменем, обід. Без спіралі — див. шапку ──
  const balancePivot = new THREE.Group();
  balancePivot.position.set(FORK_D + BAL_D, 0, 0);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 12), darkSteel);
  staff.rotation.x = Math.PI / 2;
  staff.position.z = 0.9;
  balancePivot.add(staff);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(ROLLER_R, ROLLER_R, 0.18, 32), steel);
  roller.rotation.x = Math.PI / 2;
  roller.position.z = ROLLER_Z;
  roller.castShadow = true;
  balancePivot.add(roller);
  const jewel = new THREE.Mesh(new THREE.CylinderGeometry(STONE_R, STONE_R, 0.7, 10), ruby);
  jewel.rotation.x = Math.PI / 2;
  jewel.position.set(-PIN_R, 0, 0.7);
  jewel.castShadow = true;
  balancePivot.add(jewel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.13, 14, 56), brass);
  rim.position.z = 1.55;
  rim.castShadow = true;
  balancePivot.add(rim);
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.15, 0.15), brass);
    spoke.rotation.z = a;
    spoke.position.z = 1.55;
    spoke.castShadow = true;
    balancePivot.add(spoke);
  }
  group.add(balancePivot);

  // ── Спіраль: дихає з балансом; зовнішній кінець тримає міст ──
  // Міст — від нерухомої осі вилки (бос крутиться навколо неї): стояк вгору,
  // рукав над спіраллю, спускна шпилька до колодки зовнішнього кінця.
  const SPRING_Z = 2.05;
  const balX = FORK_D + BAL_D;
  const studX = balX + SPRING_R1;
  const spring = buildSpring({ cx: balX, cy: 0, z: SPRING_Z, material: springSteel });
  group.add(spring.mesh);
  const collet = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12), darkSteel);
  collet.rotation.x = Math.PI / 2;
  collet.position.z = SPRING_Z;
  balancePivot.add(collet); // колодка сидить на осі — їде з балансом
  const arborUp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 10), darkSteel);
  arborUp.rotation.x = Math.PI / 2;
  arborUp.position.set(FORK_D, 0, 1.5);
  group.add(arborUp);
  group.add(bar(V2(FORK_D, 0), V2(studX, 0), 0.14, 0.12, 2.3, steel));
  const dropPin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), darkSteel);
  dropPin.rotation.x = Math.PI / 2;
  dropPin.position.set(studX, 0, 2.15);
  group.add(dropPin);
  const stud = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.22), darkSteel);
  stud.position.set(studX, 0, SPRING_Z);
  stud.castShadow = true;
  group.add(stud);

  // Посадка першого кадру — замок на вхідній (u=0.5: напівціле = замкнений
  // стан, фаза колеса рівно WHEEL_LOCK_PHASE, підсвітка вже на ній).
  update(0.5);

  group.visible = false;

  const home = {
    pos: new THREE.Vector3(5.2, 2.6, 8.0),
    target: new THREE.Vector3(2.0, 0, 0.2),
  };

  /**
   * Крок вітрини: поза за фазовим часом `u` (удари) — колесо, вилка, баланс
   * і підсвітка активної пари. Чиста функція часу: пауза й покроковість панелі —
   * це зупинка й ручне просування `u`, стан ніде не накопичується.
   */
  function update(u) {
    const bal = balanceAngle(u);
    wheelPivot.rotation.z = wheelAngle(u);
    forkPivot.rotation.z = forkAngle(u);
    balancePivot.rotation.z = bal;
    spring.update(bal);
    const active = activePallet(u);
    for (const [face, stone] of Object.entries(jewels))
      stone.material.emissiveIntensity = face === active ? 0.9 : 0.25;
  }

  return { group, home, update, wheelPivot, forkPivot, balancePivot, jewels };
}
