/**
 * Node highlight: dim everything except a given set.
 *
 * Materials in the scene are SHARED (one `brass` across dozens of meshes), so
 * `material.opacity` must not be touched — half the movement would fade. Instead we
 * keep one dimmed clone per material and swap `mesh.material`.
 *
 * Membership comes from `userData.mod` (the module) and `userData.arbor` (the train
 * node's index) — the modules set those themselves while building.
 */

const DIM_OPACITY = 0.12;

export function createHighlighter(root, { dimOpacity = DIM_OPACITY } = {}) {
  const dimOf = new Map();   // original material → dimmed clone
  const items = [];          // { obj, base, mod, arbor }

  root.traverse((o) => {
    if (!o.isMesh && !o.isLine) return; // sprite labels are left alone
    items.push({ obj: o, base: o.material, mod: o.userData.mod ?? null, arbor: o.userData.arbor });
  });

  function dimmed(mat) {
    let d = dimOf.get(mat);
    if (!d) {
      d = mat.clone();
      d.transparent = true;
      d.opacity = (mat.opacity ?? 1) * dimOpacity;
      d.depthWrite = false;
      dimOf.set(mat, d);
    }
    // The clone is made once, but the base may change afterwards: the «Wireframe»
    // toggle in free mode switches the originals. Without this check, returning to
    // Explore would show the highlighted parts as wireframe and the dimmed ones as
    // solid.
    d.wireframe = mat.wireframe;
    return d;
  }

  /**
   * @param {?{mods?: string[], arbors?: number[]}} spec
   *        null or an empty set — show everything at full strength.
   */
  function focus(spec) {
    const mods = new Set(spec?.mods ?? []);
    const arbors = new Set(spec?.arbors ?? []);
    const all = mods.size === 0 && arbors.size === 0;
    for (const it of items) {
      const lit = all || mods.has(it.mod) || arbors.has(it.arbor);
      it.obj.material = lit ? it.base : dimmed(it.base);
    }
  }

  /** Return the scene to full brightness. */
  const clear = () => focus(null);

  /** Which modules exist in the scene at all (for the tests). */
  const modules = () => new Set(items.map((it) => it.mod));

  /** How many meshes are dimmed right now (for the tests). */
  const dimCount = () => items.filter((it) => it.obj.material !== it.base).length;

  // There is nothing to destroy: there are exactly as many clones as there are
  // distinct materials in the scene (a handful), and the highlighter lives as long as
  // the page does. `dispose()` here was dead code pretending to manage a lifecycle.

  clear();
  return { focus, clear, modules, dimCount, count: items.length };
}
