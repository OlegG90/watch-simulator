import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { buildMovement } from '../src/movement.js';
import { createHighlighter } from '../src/lesson/highlight.js';
import { STATIONS } from '../src/lesson/stations.js';
import { LANGS, dictKeys, t, getLang, setLang, onLangChange } from '../src/i18n.js';

const mat = () => new THREE.MeshStandardMaterial();
const build = () => buildMovement({
  brass: mat(), steel: mat(), axleMat: mat(), ruby: mat(),
  springMat: new THREE.LineBasicMaterial(), plateMat: mat(), bluedMat: mat(),
  springSteel: mat(), backdropMat: mat(), cageMat: mat(),
});

describe('i18n', () => {
  beforeEach(() => setLang('ua'));

  it('набори ключів однакові в усіх мовах', () => {
    const base = [...dictKeys(LANGS[0])].sort();
    for (const l of LANGS) expect([...dictKeys(l)].sort(), `мова ${l}`).toEqual(base);
  });

  it('жодне значення не порожнє', () => {
    for (const l of LANGS) {
      setLang(l);
      for (const k of dictKeys(l)) expect(t(k).trim(), `${l}/${k}`).not.toBe('');
    }
  });

  it('setLang перемикає переклад і сповіщає підписників', () => {
    const seen = [];
    const off = onLangChange((l) => seen.push(l));
    expect(t('part.third')).toBe('Проміжне колесо');
    setLang('en');
    expect(t('part.third')).toBe('Third wheel'); // не «intermediate» — горологічна назва
    expect(seen).toEqual(['en']);
    off();
    setLang('ua');
    expect(seen).toEqual(['en']); // після відписки більше не сповіщає
  });

  it('невідомий ключ повертається як є — щоб пропуск було видно', () => {
    expect(t('нема.такого')).toBe('нема.такого');
    expect(getLang()).toBe('ua');
  });
});

describe('станції уроку', () => {
  it('усі точки фокуса існують у механізмі', () => {
    const keys = new Set(build().focusPoints.map((f) => f.nameKey));
    for (const s of STATIONS) {
      if (s.focus === null) continue; // загальний вид
      expect(keys, `станція ${s.id}`).toContain(s.focus);
    }
  });

  it('усі назви станцій мають переклад в обох мовах', () => {
    const keys = new Set(dictKeys('ua'));
    for (const s of STATIONS) expect(keys, s.id).toContain(s.nameKey);
  });

  it('кожен тест, на який посилається станція, справді існує в наборі', () => {
    const names = new Set();
    const quoted = /\bit\(\s*'([^']*)'/g;
    for (const f of readdirSync('test').filter((n) => n.endsWith('.test.js'))) {
      const src = readFileSync(`test/${f}`, 'utf8');
      for (const m of src.matchAll(quoted)) names.add(m[1]);
    }
    for (const s of STATIONS) {
      expect(names, `станція «${s.id}» посилається на неіснуючий тест`).toContain(s.test);
    }
  });
});

describe('підсвітка вузла', () => {
  it('усі модулі станцій присутні у сцені', () => {
    const h = createHighlighter(build().root);
    const present = h.modules();
    for (const s of STATIONS) {
      for (const m of s.highlight.mods ?? []) expect(present, `станція ${s.id}`).toContain(m);
    }
  });

  it('кожен меш має мітку модуля', () => {
    const h = createHighlighter(build().root);
    expect(h.modules().has(null), 'є меші без userData.mod').toBe(false);
  });

  it('фокус приглушує решту, clear() повертає все', () => {
    const h = createHighlighter(build().root);
    expect(h.dimCount()).toBe(0);
    h.focus({ mods: ['tourbillon'] });
    expect(h.dimCount()).toBeGreaterThan(0);
    expect(h.dimCount()).toBeLessThan(h.count); // щось таки лишилось світитись
    h.clear();
    expect(h.dimCount()).toBe(0);
  });

  it('приглушення не тече між мешами зі спільним матеріалом', () => {
    const mv = build();
    const h = createHighlighter(mv.root);
    h.focus({ mods: ['barrel'], arbors: [0] });
    const lit = [], dim = [];
    mv.root.traverse((o) => {
      if (!o.isMesh && !o.isLine) return;
      (o.material.opacity === 1 ? lit : dim).push(o.userData.mod);
    });
    // барабан світиться, а турбійон — ні, попри спільні матеріали
    expect(lit).toContain('barrel');
    expect(lit).not.toContain('tourbillon');
    expect(dim).toContain('tourbillon');
  });

  it('кожна станція лишає щось освітленим', () => {
    const h = createHighlighter(build().root);
    for (const s of STATIONS) {
      h.focus(s.highlight);
      expect(h.count - h.dimCount(), `станція ${s.id} нічого не підсвічує`).toBeGreaterThan(0);
    }
  });
});
