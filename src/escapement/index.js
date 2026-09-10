/**
 * The escapement socket: the movement always has exactly one installed module.
 *
 * Every variant is built at startup — a swap is then instantaneous, time and the
 * wind state do not notice it, and no teardown code is needed (that code turned out
 * to be dead here once already, and lied about the lifecycle). But **only the
 * installed one is updated**: the balance spring rewrites 1089 vertices per frame,
 * so three running escapements would triple the frame budget.
 *
 * A variant's contract: it is handed materials and parameters and returns
 * `{ id, nameKey, rotating, fixed, update(t, beatHz, amp) → β, nodes, motion }`,
 * where `nodes` are its own knobs for the free-mode panel and `motion` says what
 * the module does (escape-wheel turns per turn of the arbor; whether it has a cage).
 * Everything else stays inside the variant; the tests reach its meshes through
 * `internals` — a separate door, named so nobody mistakes it for interface.
 * `rotating` is attached to the escape arbor, `fixed` stands in the scene. The
 * socket knows nothing more about a variant — how many nested cages it has and what
 * they turn about is its own business.
 */
import { buildTourbillon, profile as tourbillonProfile, VARIANT_ID as TOURBILLON } from './tourbillon.js';
import { buildDoubleAxis, profile as doubleAxisProfile, VARIANT_ID as DOUBLE_AXIS } from './doubleAxis.js';
import { buildLever, profile as leverProfile, VARIANT_ID as LEVER } from './lever.js';
import { measureVariant } from './metrics.js';

/** The order = increasing complexity. It is the order the comparison shows them in. */
export const VARIANT_IDS = [LEVER, TOURBILLON, DOUBLE_AXIS];

/**
 * Which variant is installed at startup — the simplest one: the narrative leads from
 * it to the more complex ones. This is NOT the same thing as first in the list (the
 * order is the narrative, the default variant is behaviour), they merely coincide here.
 *
 * The choice is NOT kept between sessions: every start begins with the lever escapement.
 */
export const DEFAULT_VARIANT = LEVER;

/**
 * Variants that do not exist yet. Empty since the double-axis module was built: the
 * comparison used to show it as a third step with a dash in every column, because there
 * was nothing to measure. Kept as a list rather than deleted — the mechanism for showing
 * an honest «not yet» is worth having, and the next planned module will want it.
 */
export const PLANNED_IDS = [];

const PROFILES = {
  [LEVER]: leverProfile,
  [TOURBILLON]: tourbillonProfile,
  [DOUBLE_AXIS]: doubleAxisProfile,
};

/**
 * A variant's profile — without building any meshes.
 *
 * The socket stays the only door to the variants here too: until now the section
 * imported `lever.js` and `tourbillon.js` directly, kept its own idea of which
 * variant was the default, and typed in their body thicknesses itself.
 *
 * @param id     which variant to draw — with no default: the default variant is
 *               known to the socket (`DEFAULT_VARIANT`), and there must be no second
 *               opinion here
 * @param zBase  the height of the socket's base
 */
export function variantProfile(id, zBase, opts = {}) {
  const fn = PROFILES[id];
  if (!fn) throw new Error(`unknown escapement variant: ${id}`);
  return fn(zBase, opts);
}

const BUILDERS = {
  [LEVER]: (mats, { escTeeth }) => {
    const l = buildLever(mats, { escTeeth, escDirLocal: 0 });
    return { rotating: l.rotating, fixed: l.fixed, update: l.update, nodes: l.nodes, motion: l.motion, internals: l };
  },
  [TOURBILLON]: (mats, { escTeeth, cageMat, cageR }) => {
    const t = buildTourbillon(
      { ...mats, plateMat: cageMat },
      { escTeeth, fixedTeeth: 10, pinionTeeth: 10, moduleT: 0.26, cageR, escDirLocal: 0 }
    );
    return { rotating: t.cage, fixed: t.fixed, update: t.update, nodes: t.nodes, motion: t.motion, internals: t };
  },
  [DOUBLE_AXIS]: (mats, { escTeeth, cageMat, cageR }) => {
    const d = buildDoubleAxis({ ...mats, plateMat: cageMat }, { escTeeth, cageR });
    return { rotating: d.cage, fixed: d.fixed, update: d.update, nodes: d.nodes, motion: d.motion, internals: d };
  },
};

/**
 * Build every variant and install one.
 *
 * @param mount.arbor  the escape arbor's group — the rotating part goes there
 * @param mount.root   the scene root — the fixed part goes there
 * @param mount.pos    the socket's position in the plane of the plate
 * @param mount.zBase  the height of the socket's base
 */
export function buildEscapementSocket(mats, opts, mount, installed = DEFAULT_VARIANT) {
  const built = new Map();

  for (const id of VARIANT_IDS) {
    const v = BUILDERS[id](mats, opts);
    v.rotating.position.z = mount.zBase;
    mount.arbor.add(v.rotating);
    v.fixed.position.set(mount.pos.x, mount.pos.y, mount.zBase);
    mount.root.add(v.fixed);
    // The cost of complexity is measured ONCE, here: the movement is not running yet,
    // so a variant can safely be put into two poses and have them compared.
    built.set(id, { id, nameKey: `part.${id}`, ...v, cost: measureVariant(v) });
  }

  let current = installed;

  function show(id) {
    for (const [vid, v] of built) {
      const on = vid === id;
      v.rotating.visible = on;
      v.fixed.visible = on;
    }
    current = id;
  }
  show(current);

  return {
    ids: [...VARIANT_IDS],
    get installed() { return current; },
    /**
     * The INSTALLED module's name — for the places where the module itself is the
     * subject: the «Variants» modal, the developed section, the cost table.
     *
     * The scene chrome (3D label, camera preset, node toggle) deliberately does NOT
     * take it from here: it enumerates PLACES in the movement — barrel, centre wheel,
     * hands, winding — and the escapement is named there as a place, not as whatever
     * currently stands in it. Decision #21; not «because it would go stale» — all
     * three surfaces can rebuild — but because that is one vocabulary for the whole list.
     */
    get nameKey() { return built.get(current).nameKey; },
    variant: (id) => built.get(id),
    install(id) {
      if (!built.has(id)) throw new Error(`unknown escapement variant: ${id}`);
      show(id);
    },
    /** ONLY the installed variant moves — the rest are hidden and do not count. */
    update: (t, beatHz, amp) => built.get(current).update(t, beatHz, amp),
    /**
     * The node knobs of the INSTALLED variant — for the free-mode panel.
     *
     * The socket stays the only door: the panel knows neither the variant's name nor
     * what is inside it. Until now it addressed the tourbillon directly and could show
     * that module's parts beside the lever escapement.
     */
    nodes: () => built.get(current).nodes ?? [],
  };
}
