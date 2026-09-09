/**
 * The running parameters — one table for the whole app.
 *
 * Until it existed, «which knobs there are, within which bounds and under which
 * label» had no home of its own: three sliders were declared twice — in `main.js`
 * for lil-gui and in `lesson/stations.js` for the cards — with the bounds kept in
 * step by hand. Nothing checked that they agreed, and a card could name a
 * parameter that did not exist: `params[c.param] = …` silently created a new key,
 * the slider moved, and nothing happened.
 *
 * There is one table here, with two adapters over it — the free-mode panel and the
 * knob on a station card. Two adapters, so the seam is real rather than
 * speculative.
 *
 * `values` is a plain object: the render loop reads it (`params.beatHz`), and
 * getters there would cost more than the value itself.
 */

/** `labelKey` is a dictionary key; labels are never typed in as text. */
const SPEC = {
  running: { kind: 'flag', value: true, labelKey: 'gui.running' },
  timeMode: {
    kind: 'choice', value: 'demo', labelKey: 'gui.timeMode',
    options: [['demo', 'gui.timeDemo'], ['real', 'gui.timeReal']],
  },
  speed: {
    kind: 'range', value: 1.0, min: 0, max: 10, step: 0.1,
    labelKey: 'gui.speed', fmt: (v) => `×${v.toFixed(1)}`,
  },
  beatHz: {
    kind: 'range', value: 2.5, min: 0.5, max: 6, step: 0.1,
    labelKey: 'gui.beat', fmt: (v) => v.toFixed(1),
  },
  amplitude: {
    kind: 'range', value: 220, min: 90, max: 270, step: 5,
    labelKey: 'gui.amplitude', fmt: (v) => `${v}°`,
  },
  wireframe: { kind: 'flag', value: false, labelKey: 'gui.wireframe' },
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function createSettings() {
  const values = {};
  for (const [name, s] of Object.entries(SPEC)) values[name] = s.value;

  /** A parameter's spec. An unknown name is an error here, not silence on screen. */
  function spec(name) {
    const s = SPEC[name];
    if (!s) throw new Error(`unknown setting: ${name}`);
    return s;
  }

  /**
   * Write a value. The range is clamped by the same table the knob was built from,
   * so «out of bounds» does not depend on who is writing.
   */
  function set(name, v) {
    const s = spec(name);
    values[name] = s.kind === 'range' ? clamp(Number(v), s.min, s.max) : v;
    return values[name];
  }

  return { values, names: Object.keys(SPEC), spec, set };
}
