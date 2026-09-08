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
 * Точні кути граней — розв'язані, не номінальні: камінь стоїть стовпчиком
 * над колесом, запірний ріжок сідає на вістря замка (seatPallet), далі
 * імпульсна площина вздовж відходу вістря. Геометрія віддає фазній машині
 * півотні групи й камені — більше їй нічого не треба.
 */

export const TEETH = 15;
export const WHEEL_R = 1.5;
const WHEEL_ROOT = 0.95;
const WHEEL_T = 0.35;
/** Зубець-паличка: ширина вістря/основи й нахил за ходом, частки кроку. */
const CLUB_TOOTH = { tw: 0.18, bw: 0.3, lean: 0.5 };

/** W→P: вісь вилки. P→B: вісь балансу (хід вилки вміщується між ними). */
export const FORK_D = 2.35;
export const BAL_D = 2.0;

/**
 * Камені стоять стовпчиком НАД колесом і дістають смугу лише запірним
 * ріжком: попередня посадка (центр у смузі) ховала вістря всередину тіла
 * (−0.46 у замку) — жоден розворот цілого каменя це не лікував, бо тіло
 * 0.34×0.62 впоперек шляху зубців. Контакт — ріжком A з мікрозазором EPS.
 *
 * Зона (кут) каже, ЯКЕ вістря ловити: найближче до зони в момент замка.
 * Точну позицію і розворот дає seatPallet() розв'язком, а не числами:
 * ріжок сідає на вістря, грань — з притягуванням DRAW.
 */
const PALLET_ANG = (26 * Math.PI) / 180;
const EXIT_ANG = (30.65 * Math.PI) / 180;
// Посадка падіння (чому вихідна не дзеркальна ±26°): нуль вихідного замка
// мінус нуль вхідного має дорівнювати півзубцю — інакше одна фаза не садить
// обидва. Виміряно: 30.65° (нулі 22.45°/10.75°, різниця 11.7° проти потрібних
// 12° — залишок 0.3° ділиться мінімаксом порівну). Напрям руху проти
// годинникової ламає дзеркальну симетрію пари.
const JEWEL_W = 0.28;
const JEWEL_H = 0.62;
const JEWEL_T = 0.5;
/** Номінальний кут притягування запірної грані від радіуса. */
const LOCK_DRAW = (10 * Math.PI) / 180;
/** Довжина запірного фаска від ріжка; далі — імпульсна площина. */
const LOCK_LEN = 0.07;
/** Довжина імпульсної площини: вістря з'їжджає нею весь зрив. */
const IMP_LEN = 0.35;
/** Мікрозазор контакту: грань торкається, тіла не перетинаються. */
const SEAT_EPS = 0.004;
/**
 * Виміряні розвороти каменя в рамі вилки й кути імпульсних площин
 * (локальні, від +x контура). Метод: скан .openchamber/seat10.mjs —
 * посадка ріжком на вістря замка, мінімакс перетину за ПОВНИЙ цикл
 * (вхідна й вихідна половини окремо — оптимум тримає вхідний зачеп).
 * Вхідна −31°/128° (цикл −0.024, навпроти +0.025), вихідна −110°/122°
 * (цикл −0.040, навпроти +0.058). Лишок — постановочний дотик у момент
 * падіння/зриву, не наскрізне проходження: тіла не ховають зубців.
 * Асиметрія — від нахилу зубців за ходом: дзеркала тут нема, як не було
 * його й у зоні виходу.
 */
const SEAT = {
  entry: { rot: (-31 * Math.PI) / 180, imp: (128 * Math.PI) / 180 },
  exit: { rot: (-110 * Math.PI) / 180, imp: (122 * Math.PI) / 180 },
};
/** Геометрія каменя — тестам посадки, щоб не дублювати числа. */
export const JEWEL_GEOM = { w: JEWEL_W, h: JEWEL_H, lean: Math.tan(LOCK_DRAW) * JEWEL_H, lockLen: LOCK_LEN };

/** Тіло вилки над колесом; камінь ролика дістає в проріз знизу. */
const FORK_Z = 0.85;
const ROLLER_Z = 0.35;
const ROLLER_R = 0.55;
const PIN_R = 0.42;   // орбіта імпульсного каменя навколо осі балансу
const STONE_R = 0.09;

const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
const rot2 = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/**
 * Локальний контур каменя: A (запірний ріжок) → K (кінець фаска
 * з притягуванням) → M (імпульсна площина вздовж відходу вістря —
 * напрям виміряно трасуванням відносного руху, seat8.mjs: 134°/124°) →
 * зовнішнє тіло. Власна фігура модуля: гарди в тестах компонують
 * з неї, а не дублюють контур.
 */
export function palletOutline(imp) {
  const w = JEWEL_W / 2, h = JEWEL_H / 2;
  const lean = Math.tan(LOCK_DRAW) * JEWEL_H;
  const A = [-w, -h];
  const e = norm2([lean, 2 * h]);
  const K = [A[0] + (lean / e) * LOCK_LEN, A[1] + ((2 * h) / e) * LOCK_LEN];
  const M = [K[0] + Math.cos(imp) * IMP_LEN, K[1] + Math.sin(imp) * IMP_LEN];
  return [A, K, M, [-w + lean, h], [w, h - 0.3], [w, -h]];
}
const norm2 = ([x, y]) => Math.hypot(x, y);

/** Зубець колеса в рамі колеса (опукла четвірка виступу): фігура для гардів. */
export function clubToothQuad(i) {
  const step = (Math.PI * 2) / TEETH;
  const { tw: TW, bw: BW, lean: LEAN } = CLUB_TOOTH;
  const a = i * step;
  return [
    polar(WHEEL_ROOT, a - (LEAN + BW / 2) * step),
    polar(WHEEL_R, a - (TW / 2) * step),
    polar(WHEEL_R, a + (TW / 2) * step),
    polar(WHEEL_ROOT, a - (LEAN - BW / 2) * step),
  ];
}

/**
 * Посадка каменя в рамі вилки розв'язком: яке вістря — найближче до зони
 * в момент замка; ріжок A сідає на нього з мікрозазором по зовнішній
 * нормалі фаска; розворот і імпульс — виміряні (SEAT). Плечі вилки
 * тягнуться до цієї ж точки, тож збірка не розходиться з посадкою.
 */
function seatPallet(face) {
  // Вихідна зона — під лінією центрів (−EXIT_ANG): мінус лишається від
  // старого side, без нього посадка ловить зубець верхньої половини.
  const zone = face === 'entry' ? PALLET_ANG : -EXIT_ANG;
  const lockU = face === 'entry' ? 0.5 : 1.5;
  const { rot, imp } = SEAT[face];
  const wAng = wheelAngle(lockU), fAng = forkAngle(lockU);
  const step = (Math.PI * 2) / TEETH;
  let tip = 0, best = Infinity;
  for (let i = 0; i < TEETH; i++) {
    // Повне коло, не mod кроку: (зона − зубець_i) mod крок від i не залежить.
    const raw = (zone - (wAng + i * step)) % (Math.PI * 2);
    const d = Math.abs(raw > Math.PI ? raw - Math.PI * 2 : raw < -Math.PI ? raw + Math.PI * 2 : raw);
    if (d < best) { best = d; tip = i; }
  }
  const T = polar(WHEEL_R, wAng + tip * step);
  // Зовнішня нормаль — з самого фаска A→K, не з формули lean: одне джерело.
  const [A, K] = palletOutline(imp);
  const ex = K[0] - A[0], ey = K[1] - A[1];
  const el = Math.hypot(ex, ey);
  let nl = [ey / el, -ex / el];
  if (nl[0] * (0 - A[0]) + nl[1] * (-0.075 - A[1]) > 0) nl = [-nl[0], -nl[1]];
  const nw = rot2(rot2(nl, rot), fAng);
  const target = [T[0] - SEAT_EPS * nw[0], T[1] - SEAT_EPS * nw[1]];
  const rel = rot2([target[0] - FORK_D, target[1]], -fAng);
  const off = rot2(A, rot);
  return { x: rel[0] - off[0], y: rel[1] - off[1], rot, imp, tip };
}

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
 * Колесо із зубами-паличками: тонкі довгі трапеції, нахилені в бік руху
 * (хід — проти годинникової, +кут): основа товща, вістря трохи вужче,
 * основа зсунута назад на півкроку — паличка випереджає вістрям за ходом;
 * між зубцями симетрична западина з прогином.
 *
 * Середина вістря лишається точно на (WHEEL_R, i·крок): посадка замка
 * міряється лише по ній, тож перепрофілювання граней і западин її не чіпає.
 */
function makeClubWheel(material) {
  const step = (Math.PI * 2) / TEETH;
  // Частки кроку: TW — ширина вістря, BW — ширина основи, LEAN — зсув
  // основи назад (нахил палички за ходом). Числа — в CLUB_TOOTH: контур
  // колеса й четвірка для гардів з одного джерела, інакше тест перевіряє
  // здорову копію.
  const { tw: TW, bw: BW, lean: LEAN } = CLUB_TOOTH;
  const VALLEY_R = WHEEL_ROOT * 0.88;
  const shape = new THREE.Shape();
  for (let i = 0; i < TEETH; i++) {
    const a = i * step;
    const tbc = polar(WHEEL_ROOT, a - (LEAN + BW / 2) * step); // задня основа
    const ttc = polar(WHEEL_R, a - (TW / 2) * step); // задній кут вістря
    const ltc = polar(WHEEL_R, a + (TW / 2) * step); // передній кут вістря
    const lbc = polar(WHEEL_ROOT, a - (LEAN - BW / 2) * step); // передня основа
    const dip = polar(VALLEY_R, a + (0.5 - LEAN) * step); // дно западини
    if (i === 0) shape.moveTo(...tbc);
    else shape.lineTo(...tbc); // задня грань вгору до вістря
    shape.lineTo(...ttc);
    shape.lineTo(...ltc); // плоске вістря, середина точно на (WHEEL_R, a)
    shape.lineTo(...lbc); // передня грань вниз
    shape.lineTo(...dip); // западина до наступного зубця
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.18, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  for (let i = 0; i < 4; i++) {
    const seg = (Math.PI * 2) / 4;
    const w = new THREE.Path();
    w.absarc(0, 0, 0.55, i * seg + 0.3, (i + 1) * seg - 0.3, false);
    w.lineTo(...polar(0.7, (i + 1) * seg - 0.3));
    w.absarc(0, 0, 0.7, (i + 1) * seg - 0.3, i * seg + 0.3, true);
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
 * Камінь-палета зламаним контуром: запірний фасок з притягуванням,
 * імпульсна площина вздовж відходу вістря, глухе зовнішнє тіло.
 * Обидва камені однієї форми (дзеркальний клав би глуху спину —
 * посадка виходу не сходилась ні на якій фазі); орієнтацію дає
 * розворот з посадки, не форма.
 */
function makePallet(material, imp) {
  const pts = palletOutline(imp);
  const s = new THREE.Shape();
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: JEWEL_T, bevelEnabled: false });
  geo.translate(0, 0, -JEWEL_T / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function buildShowcase() {
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
  // Посадка кожного каменя — розв'язок seatPallet(): ріжок на вістрі замка.
  // Плечі йдуть до тієї ж точки — збірка не розходиться з посадкою.
  for (const face of ['entry', 'exit']) {
    const seat = seatPallet(face);
    // Матеріал каменя — власний екземпляр: підсвітка активної пари гасить
    // й засвічує камені окремо, спільний матеріал цього не вміє.
    const stone = makePallet(ruby.clone(), seat.imp);
    stone.position.set(seat.x, seat.y, jewelZ);
    stone.rotation.z = seat.rot;
    stone.userData.pallet = { face, imp: seat.imp };
    forkPivot.add(stone);
    jewels[face] = stone;
    // Плече: горизонтальна штанга в площині вилки + стійка вниз до каменя.
    const top = V2(seat.x, seat.y);
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
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.11, 14, 56), brass);
  rim.position.z = 1.55;
  rim.castShadow = true;
  balancePivot.add(rim);
  // Обід — дві половини штифтів: у кожному півколі групи по 2, 3, 4 штифти
  // з відступом між групами (пор. демонстраційну модель). Кожна половина
  // центрується у своєму півколі, тож стик півколів лишається вільним.
  const pinGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.14, 10);
  const groupSizes = [2, 3, 4];
  const pitch = 0.16; // крок усередині групи
  const gap = 0.5;    // відступ між групами
  const totalPins = groupSizes.reduce((s, n) => s + n, 0);
  const span = (totalPins - 1) * pitch + (groupSizes.length - 1) * gap;
  for (const start of [0, Math.PI]) {
    let a = start + (Math.PI - span) / 2;
    for (const n of groupSizes) {
      for (let i = 0; i < n; i++) {
        const pin = new THREE.Mesh(pinGeo, brass);
        pin.position.set(Math.cos(a) * 1.22, Math.sin(a) * 1.22, 1.55);
        pin.rotation.z = a - Math.PI / 2; // вісь вздовж радіуса
        pin.castShadow = true;
        balancePivot.add(pin);
        a += pitch;
      }
      a += gap;
    }
  }
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
