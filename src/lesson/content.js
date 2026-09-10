/**
 * The copy for the station cards. Lifted out of `i18n.js` so that file stays the
 * interface chrome: here is what the lesson says about the mechanism.
 *
 * `%1`, `%2` are the slots for live numbers from `readouts.js`. Not one number is
 * written out as text: they all come from the same constants that build the geometry.
 */
export const CONTENT = {
  ua: {
    'card.idea': 'ГОЛОВНА ДУМКА',
    'card.formula': 'ЯК ЦЕ РАХУЄТЬСЯ',
    'card.try': 'СПРОБУЙТЕ',
    'card.verified': 'перевірено тестом',
    'card.simplified': 'спрощення моделі',

    'st.winding.prose': 'Тут у механізм заходить уся енергія — з вашої руки. Вал лежить поперек механізму, тож конічна пара має повернути обертання на 90°, щоб потрапити в площину коліс.',
    'st.winding.idea': 'Собачка — зворотний клапан. Вона пропускає обертання в бік заведення й блокує назад, тому в пружини лишається єдиний вихід: у передачу.',
    'st.winding.hint': 'Дивіться на барабанне колесо: воно не зрушить. Ви крутите вісь барабана відносно його корпусу — колесо тримає передача.',
    'st.winding.f1': 'кут собачки = 0.07 · (w mod %1°) / %1°',
    'st.winding.s1': 'кути конусів',
    'st.winding.s2': 'один клік',

    'st.energy.prose': 'Пружина зберігає роботу вашої руки й віддає її годинами. Барабан — найповільніша деталь механізму: поки кліть робить %1 обертів, він робить один.',
    'st.energy.idea': 'Тугіша пружина дає довший хід, а не швидший. Темп визначає баланс — до нього ми дійдемо на четвертій зупинці.',
    'st.energy.hint': 'Розженіть час і дивіться, як витки розходяться: за поточної швидкості повного заводу вистачає на ≈%1 хв, потім механізм стане.',
    'st.energy.f1': 'витків = 3.4 + 3.6 · c',
    'st.energy.f2': 'зараз c = %1 → %2 витка',
    'st.energy.s1': 'витків зараз',
    'st.energy.s2': 'повний завод',
    'st.energy.simp': 'форма витків — візуальна, момент пружини не рахується',

    'st.train.prose': 'Барабан обертається дуже повільно й дуже сильно. Стрілці ж потрібне протилежне. Передача — це розмін: сила міняється на швидкість, крок за кроком.',
    'st.train.idea': 'Передача нічого не додає — вона лише розмінює момент на швидкість. А мінус на кожному кроці означає, що зовнішнє зачеплення завжди міняє напрям.',
    'st.train.hint': 'Розженіть час: барабан ледь зрушить, а кліть встигне зробити сотню обертів. Це і є розмін сили на швидкість.',
    'st.train.f1': 'ω_k = − ω_k−1 · z_w / z_p',

    'st.escapement.prose': 'Пружина тягне передачу безперервно — а годинник мусить рахувати час порціями. Спуск розриває цей потік: анкерне колесо просувається рівно на пів зубця за кожен удар балансу.',
    'st.escapement.idea': 'Темп ходу задає баланс, а не пружина. Сильніший завод не пришвидшує годинник — він лише подовжує запас.',
    'st.escapement.hint': 'Змініть хід — обидва числа поруч зміняться разом: їхнє відношення від ходу не залежить. А «Варіанти» міняють саму конструкцію спуску — і жодне з цих чисел не ворухнеться.',
    'st.escapement.f1': 'θ_вісь = β — привід усього механізму',
    'st.escapement.n1': 'хоч який модуль стоїть у гнізді, передачу жене той самий кут',
    'st.escapement.f2': '1 удар = π/15 рад = %1°',
    'st.escapement.s1': 'оберт анкерної осі',
    'st.escapement.s2': 'секундне колесо',
    'st.escapement.simp': 'перекидання вилки — плавна крива у вікні ±0.12 удару, а не наслідок удару зубця об палету',

    'st.timeDisplay.prose': 'Три стрілки на одній осі — і жодна не має власної. Вони сидять на вкладених трубках, одна в одній: годинна найширша й найнижча, секундна найтонша й найвища.',
    'st.timeDisplay.idea': '12 : 1 — це не одна шестерня, а дві пари підряд. Модулі пар навмисно різні, щоб міжосьова вийшла однакова: тоді хвилинний вузол один і меншить в обидва боки.',
    'st.timeDisplay.hint': 'Перемкніть на реальний час — стрілки стануть на справжній годинник, а колеса під ними лишаться зчепленими.',
    'st.timeDisplay.f1': 'год = 12/36 · 10/40 = 1/12',
    'st.timeDisplay.f2': 'сек = 10 · 48/8 = 60',
    'st.timeDisplay.n1': 'міжосьова обох пар: %1 = %2 — саме тому модулі різні',
    'st.timeDisplay.simp': 'у реальному часі стрілки «проковзують» відносно своїх коліс',

    'st.powerReserve.prose': 'Стрілка запасу не «читає» пружину — таких датчиків у механіці немає. Вона віднімає два рухи: скільки ви накрутили і скільки годинник відходив.',
    'st.powerReserve.idea': 'Прибрати «змінну заряду» і лишити тільки два кути — це не оптимізація коду, а те, як влаштований справжній механізм.',
    'st.powerReserve.hint': 'Заводьте й дивіться: верхнє сонце крутиться, нижнє стоїть — водило їде вгору по шкалі рівно на половину різниці.',
    'st.powerReserve.f1': 'θ_водило = ( θ_верх + θ_низ ) / 2',
    'st.powerReserve.f2': 'c = c₀ + ( w − 4β ) / 2·%1°',
    'st.powerReserve.n1': 'заряд ніде не зберігається — він похідний',
    'st.powerReserve.s1': 'заряд зараз',
    'st.powerReserve.s2': 'міжосьова пар',
    'st.powerReserve.simp': 'У реальному часі пружина не витрачається: модель підкручує барабан рівно на стільки, скільки спожив удар, — щоб стрілка запасу стояла, поки стрілки йдуть за справжнім часом. Тому в цьому режимі годинник не стає ніколи. Витрачається пружина лише в демонстраційному, і там її видно до нуля.',

    // ── the sentence a stop leaves behind: same text in rail and summary ──
    'st.winding.line': 'Собачка не пускає храповик назад — тому в енергії лишається єдиний вихід: у передачу.',
    'st.energy.line': 'Пружина зберігає роботу руки: тугіша дає довший хід, а не швидший.',
    'st.train.line': 'Чотири зачеплення розмінюють повільний сильний оберт на швидкий слабкий — у 107 разів.',
    'st.escapement.line': 'Спуск ділить потік на порції — пів зубця за удар. Темп задає баланс, а не пружина.',
    'st.timeDisplay.line': 'Моторний механізм ділить оберт на 12, а окремий місток множить на 60 — і все на одній осі.',
    'st.powerReserve.line': 'Диференціал віднімає накручене від відходженого: стрілка показує різницю, а не залишок.',

    // ── summary ──
    'finish.eyebrow': 'ЛАНЦЮГ ПРОЙДЕНО',
    'finish.title': 'Як працює цей механізм',
    'finish.lead': 'Шість речень, які ви зібрали — по одному на кожній зупинці. Разом вони й описують хід.',
    'finish.loop': 'Зверніть увагу на пунктир: баланс керує спуском, який його ж і живить. Це єдина петля в усьому механізмі — і саме вона робить його годинником, а не просто передачею.',
    'finish.next': 'КУДИ ДАЛІ',
    'finish.side': 'Розібрати по шарах',
    'finish.sideBody': 'Перемкнути будь-яку станцію в розріз і побачити, чому колеса вільно перекриваються в плані.',
    'finish.freeBody': 'Усі ручки одразу: швидкість, хід, амплітуда, видимість вузлів, пресети камери.',
    'finish.again': 'Пройти ще раз',
    'finish.goFree': 'Перейти у вільний режим',
    'finish.footnote': 'кожне твердження вище закріплене тестом у репозиторії',
  },

  en: {
    'card.idea': 'KEY IDEA',
    'card.formula': 'HOW IT IS COMPUTED',
    'card.try': 'TRY IT',
    'card.verified': 'locked by a test',
    'card.simplified': 'model simplification',

    'st.winding.prose': 'All the energy enters the movement here — from your hand. The stem lies across the movement, so a bevel pair has to turn the rotation through 90° to reach the plane of the wheels.',
    'st.winding.idea': 'The click is a one-way valve. It passes rotation in the winding direction and blocks the way back, so the spring is left with one way out: into the train.',
    'st.winding.hint': 'Watch the barrel wheel: it will not move. You are turning the barrel arbor against its housing — the wheel is held by the train.',
    'st.winding.f1': 'click angle = 0.07 · (w mod %1°) / %1°',
    'st.winding.s1': 'cone angles',
    'st.winding.s2': 'one click',

    'st.energy.prose': 'The mainspring stores the work of your hand and gives it back over hours. The barrel is the slowest part of the movement: for every %1 turns of the cage it makes one.',
    'st.energy.idea': 'A tighter spring buys a longer run, not a faster one. The rate is set by the balance — we reach it at the fourth stop.',
    'st.energy.hint': 'Speed time up and watch the coils spread: at the current speed a full wind lasts about %1 min, then the movement stops.',
    'st.energy.f1': 'coils = 3.4 + 3.6 · c',
    'st.energy.f2': 'now c = %1 → %2 coils',
    'st.energy.s1': 'coils now',
    'st.energy.s2': 'full wind',
    'st.energy.simp': 'coil shape is visual only; spring torque is not computed',

    'st.train.prose': 'The barrel turns very slowly and very strongly. A hand needs the opposite. The train is a trade: force for speed, step by step.',
    'st.train.idea': 'The train adds nothing — it only trades torque for speed. And the minus at every step means that an external mesh always reverses direction.',
    'st.train.hint': 'Speed time up: the barrel barely stirs while the cage turns a hundred times. That is the trade of force for speed.',
    'st.train.f1': 'ω_k = − ω_k−1 · z_w / z_p',

    'st.escapement.prose': 'The mainspring pulls on the train continuously — but a watch has to count time in portions. The escapement breaks that flow: the escape wheel advances exactly half a tooth per beat of the balance.',
    'st.escapement.idea': 'The balance sets the rate, not the mainspring. Winding harder will not make the watch run faster — only longer.',
    'st.escapement.hint': 'Change the rate and both figures move together: their ratio does not depend on it. And the Variants button changes the escapement itself — without moving either number.',
    'st.escapement.f1': 'θ_arbor = β — what drives the whole movement',
    'st.escapement.n1': 'whichever module sits in the socket, the train is driven by the same angle',
    'st.escapement.f2': '1 beat = π/15 rad = %1°',
    'st.escapement.s1': 'escape arbor turn',
    'st.escapement.s2': 'fourth wheel',
    'st.escapement.simp': 'the fork flips along a smooth curve inside a ±0.12-beat window, not because a tooth strikes a pallet',

    'st.timeDisplay.prose': 'Three hands on one axis — and not one of them has its own. They sit on nested tubes, one inside another: the hour tube widest and lowest, the seconds tube thinnest and highest.',
    'st.timeDisplay.idea': '12 : 1 is not one gear but two pairs in series. The modules differ on purpose so that both pairs span the same centre distance — then a single minute arbor can drive both ways.',
    'st.timeDisplay.hint': 'Switch to real time — the hands jump to the true clock while the wheels beneath them stay meshed.',
    'st.timeDisplay.f1': 'hr = 12/36 · 10/40 = 1/12',
    'st.timeDisplay.f2': 'sec = 10 · 48/8 = 60',
    'st.timeDisplay.n1': 'centre distance of both pairs: %1 = %2 — which is why the modules differ',
    'st.timeDisplay.simp': 'in real time the hands slip relative to their wheels',

    'st.powerReserve.prose': 'The reserve hand does not read the spring — mechanics has no such sensor. It subtracts two motions: how much you have wound and how much the watch has run.',
    'st.powerReserve.idea': 'Dropping the charge variable and keeping only two angles is not a code optimisation — it is how the real mechanism works.',
    'st.powerReserve.hint': 'Wind and watch: the upper sun turns, the lower stays put — the carrier travels up the scale by exactly half the difference.',
    'st.powerReserve.f1': 'θ_carrier = ( θ_up + θ_low ) / 2',
    'st.powerReserve.f2': 'c = c₀ + ( w − 4β ) / 2·%1°',
    'st.powerReserve.n1': 'the charge is stored nowhere — it is derived',
    'st.powerReserve.s1': 'charge now',
    'st.powerReserve.s2': 'pair centre distance',
    'st.powerReserve.simp': 'In real time the mainspring is never spent: the model tops the barrel up by exactly what each beat consumes, so that the reserve hand stands still while the hands follow the wall clock. The watch therefore never stops in that mode. The spring is only spent in demo time, and there you can watch it reach zero.',

    // ── the sentence a stop leaves behind: same text in rail and summary ──
    'st.winding.line': 'The click will not let the ratchet run back — so the energy has one way out: into the train.',
    'st.energy.line': 'The mainspring stores the work of your hand: a tighter spring runs longer, not faster.',
    'st.train.line': 'Four meshes trade a slow strong turn for a fast weak one — 107 times over.',
    'st.escapement.line': 'The escapement breaks the flow into portions — half a tooth per beat. The balance sets the rate, not the mainspring.',
    'st.timeDisplay.line': 'The motion works divide the turn by 12 while a separate bridge multiplies it by 60 — all on one axis.',
    'st.powerReserve.line': 'The differential subtracts what was spent from what was wound: the hand shows the difference, not the remainder.',

    // ── summary ──
    'finish.eyebrow': 'CHAIN COMPLETE',
    'finish.title': 'How this movement works',
    'finish.lead': 'Six sentences you collected — one at every stop. Together they describe the going.',
    'finish.loop': 'Note the dashed line: the balance governs the escapement that drives it. It is the only loop in the whole movement — and it is what makes this a watch rather than just a gear train.',
    'finish.next': 'WHERE NEXT',
    'finish.side': 'Explode the layers',
    'finish.sideBody': 'Switch any stop to the section and see why the wheels may overlap in plan.',
    'finish.freeBody': 'Every control at once: speed, rate, amplitude, node visibility, camera presets.',
    'finish.again': 'Run through again',
    'finish.goFree': 'Go to free mode',
    'finish.footnote': 'every statement above is locked by a test in the repository',
  },
};
