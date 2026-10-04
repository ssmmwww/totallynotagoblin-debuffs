// Token Condition Badges
// Foundry draws each status icon 20 px per 100 px of grid whatever the token's size, so a Huge creature's icons are
// 1/15 of its width. This module draws the rules conditions and Concentrating a second time, as discs along the token's
// lower rim: a fifth of the token's width and never under half a square, border coloured by kind (orange movement,
// yellow out of action, violet mind, blue senses, green body, teal concentration), the rest as a +N disc when the arc is
// full. When a condition lands, its icon and name show large over the token for about two seconds, then shrink into
// their badge; nothing loops. Foundry's own icons stay as they are and buffs stay there only.
// The list comes from the effects Foundry already draws icons for (actor.temporaryEffects with an image), so the token
// HUD, Midi-QOL, Chris's Premades and macros all show up. Every client draws its own copy as a child of the token:
// nothing is written to the world, a hidden or secret token hides it, a dead creature (Foundry's overlay) shows none,
// and a page load or scene change plays no entrance.
const MOD = "token-condition-badges";
const KIND = {
  unconscious: "out", petrified: "out", paralyzed: "out", stunned: "out", incapacitated: "out",
  restrained: "move", grappled: "move", prone: "move",
  frightened: "mind", charmed: "mind",
  blinded: "sense", deafened: "sense", invisible: "sense",
  poisoned: "body", exhaustion: "body",
  concentrating: "conc",
};
const COLOR = { out: 0xf0c64a, move: 0xef8445, mind: 0xb48cf8, sense: 0x74b8ee, body: 0xa3d147, conc: 0x7fe3d8 };
const ORDER = Object.keys(KIND); // left to right on the rim, most disabling first
const IMPLY_INCAPACITATED = ["unconscious", "petrified", "paralyzed", "stunned"];
const POP_MS = 1900, BUMP_MS = 260, STAGGER_MS = 450;
const SYM = Symbol(MOD);
const seen = new Map(); // token document uuid -> condition keys drawn last time; no entrance the first time a token is seen
const opts = { enabled: true, entrance: true, concentration: true, size: 1 };

const loadTex = (src) => (foundry.canvas?.loadTexture ?? globalThis.loadTexture)(src);
const cachedTex = (src) => (foundry.canvas?.getTexture ?? globalThis.getTexture)(src);
const textClass = () => foundry.canvas?.containers?.PreciseText ?? globalThis.PreciseText;
const statusOf = (id) => CONFIG.statusEffects.find((s) => s.id === id);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

function conditionsOf(token) {
  const actor = token.actor;
  if (!opts.enabled || !actor || actor.statuses?.has("dead")) return [];
  const found = new Map();
  for (const e of actor.temporaryEffects ?? []) {
    if (!e.img) continue; // Foundry draws no icon for it either
    const key = ORDER.find((k) => e.statuses?.has(k)); // Paralyzed also carries incapacitated: one badge, the worse one
    if (!key || found.has(key)) continue;
    if (key === "concentrating" && !opts.concentration) continue;
    // the condition's own icon, so a Hold Person effect still reads as Paralyzed; exhaustion keeps its level picture
    found.set(key, { key, img: key === "exhaustion" ? e.img : statusOf(key)?.img ?? e.img });
  }
  // dnd5e also hangs a separate Incapacitated on these four; their own badge already says it
  if (IMPLY_INCAPACITATED.some((k) => found.has(k))) found.delete("incapacitated");
  return ORDER.filter((k) => found.has(k)).map((k) => found.get(k));
}

function layout(token) {
  const { width, height } = token.document.getSize?.() ?? { width: token.w, height: token.h };
  const g = canvas.grid.size, S = Math.min(width, height);
  const b = Math.max(0.45 * g, 0.22 * S) * opts.size;
  const r = S / 2 + b * 0.05;
  const step = (b * 1.1) / r;
  return { width, height, g, S, b, r, step, max: Math.max(1, Math.floor((200 * Math.PI) / 180 / step) + 1) };
}

function disc(size, color, tex) {
  const c = new PIXI.Container();
  const bw = Math.max(2, size * 0.085);
  const g = new PIXI.Graphics();
  g.beginFill(0x000000, 0.45).drawCircle(0, size * 0.05, size / 2 + 1).endFill();
  g.lineStyle({ width: bw, color, alignment: 0.5 }).beginFill(0x15131b, 0.92).drawCircle(0, 0, size / 2 - bw / 2).endFill();
  c.addChild(g);
  if (tex) {
    const s = new PIXI.Sprite(tex);
    s.anchor.set(0.5);
    s.width = s.height = size * 0.64;
    c.addChild(s);
  }
  return c;
}

function label(text, fontSize, color) {
  const PreciseText = textClass();
  const c = new PIXI.Container();
  const t = new PreciseText(text.toUpperCase(), PreciseText.getTextStyle({ fontSize, fill: 0xffffff, letterSpacing: fontSize * 0.08, strokeThickness: Math.max(2, fontSize * 0.1) }));
  t.anchor.set(0.5, 0);
  const padX = fontSize * 0.6, padY = fontSize * 0.3, w = t.width + 2 * padX, h = t.height + 2 * padY;
  const bg = new PIXI.Graphics();
  bg.beginFill(0x0a0a0e, 0.82).drawRoundedRect(-w / 2, 0, w, h, fontSize * 0.2).endFill();
  bg.beginFill(color, 1).drawRect(-w / 2, h - Math.max(2, fontSize * 0.1), w, Math.max(2, fontSize * 0.1)).endFill();
  t.position.set(0, padY);
  c.addChild(bg, t);
  return c;
}

function nameOf(token, key) {
  const name = game.i18n.localize(statusOf(key)?.name ?? key);
  const level = key === "exhaustion" ? token.actor?.system?.attributes?.exhaustion : 0;
  return level ? `${name} ${level}` : name;
}

function rootOf(token, st) {
  if (st.root && !st.root.destroyed && st.root.parent === token) return st.root;
  // a full token redraw destroys its children, ours and any entrance in flight
  st.root = token.addChild(new PIXI.Container());
  st.root.eventMode = "none";
  st.root.zIndex = 1;
  st.badges = st.root.addChild(new PIXI.Container());
  st.pops = st.root.addChild(new PIXI.Container());
  st.flying = new Set();
  st.at = {};
  st.sig = null;
  return st.root;
}

async function update(token) {
  if (!token?.document || token.destroyed || token._original) return; // not the drag preview
  const st = (token[SYM] ??= { gen: 0 });
  const gen = ++st.gen;
  const list = conditionsOf(token);
  const textures = await Promise.all(list.map((c) => cachedTex(c.img) ?? loadTex(c.img).catch(() => null)));
  if (gen !== st.gen || token.destroyed || !token.document) return;
  const root = rootOf(token, st);
  root.visible = token.effects?.visible !== false;
  const L = layout(token);
  const sig = `${L.width}x${L.height}@${L.g}*${L.b}|${list.map((c) => `${c.key}:${c.img}`).join(",")}`;
  if (sig === st.sig) return;
  st.sig = sig;

  st.badges.removeChildren().forEach((c) => c.destroy({ children: true }));
  st.at = {};
  let shown = list, extra = 0;
  if (list.length > L.max) { shown = list.slice(0, L.max - 1); extra = list.length - shown.length; }
  const n = shown.length + (extra ? 1 : 0);
  const spot = (i) => {
    const a = Math.PI / 2 - (i - (n - 1) / 2) * L.step;
    return { x: L.width / 2 + L.r * Math.cos(a), y: L.height / 2 + L.r * Math.sin(a) };
  };
  shown.forEach((c, i) => {
    const d = st.badges.addChild(disc(L.b, COLOR[KIND[c.key]], textures[list.indexOf(c)]));
    const p = spot(i);
    d.position.set(p.x, p.y);
    d.alpha = st.flying.has(c.key) ? 0 : 1;
    st.at[c.key] = d;
  });
  if (extra) {
    const PreciseText = textClass();
    const d = st.badges.addChild(disc(L.b, 0x8b92a3, null));
    const t = new PreciseText(`+${extra}`, PreciseText.getTextStyle({ fontSize: L.b * 0.36, fill: 0xffffff, strokeThickness: 0, dropShadow: false }));
    t.anchor.set(0.5);
    d.addChild(t);
    const p = spot(shown.length);
    d.position.set(p.x, p.y);
  }

  // entrances for what is new since the last drawing of this token
  const uuid = token.document.uuid, keys = list.map((c) => c.key), before = seen.get(uuid);
  seen.set(uuid, keys);
  if (!before || !opts.entrance) return;
  keys.filter((k) => !before.includes(k) && st.at[k]).forEach((k, i) => {
    st.flying.add(k);
    st.at[k].alpha = 0;
    const tex = textures[keys.indexOf(k)];
    setTimeout(() => entrance(token, st, k, tex), i * STAGGER_MS);
  });
}

function entrance(token, st, key, tex) {
  if (token.destroyed || !st.pops || st.pops.destroyed) return;
  const L = layout(token);
  const P = Math.max(1.3 * L.g, 0.5 * L.S);
  const color = COLOR[KIND[key]];
  const pop = st.pops.addChild(new PIXI.Container());
  pop.position.set(L.width / 2, L.height / 2);
  const big = pop.addChild(disc(P, color, tex));
  const glow = new PIXI.Graphics();
  for (let i = 1; i <= 4; i++) glow.lineStyle({ width: P * 0.04, color, alpha: 0.22 - i * 0.04 }).drawCircle(0, 0, P / 2 + i * P * 0.035);
  big.addChildAt(glow, 0);
  const tag = pop.addChild(label(nameOf(token, key), 0.3 * L.g, color));
  tag.position.set(0, P / 2 + 0.08 * L.g);
  const start = performance.now();
  const ticker = canvas.app.ticker;
  const finish = () => {
    ticker.remove(tick);
    st.flying?.delete(key);
    if (!pop.destroyed) pop.destroy({ children: true });
  };
  const tick = () => {
    if (pop.destroyed || token.destroyed) return finish();
    const p = (performance.now() - start) / POP_MS;
    const badge = st.at[key];
    if (p < 1) {
      let scale = 1, x = 0, y = 0;
      if (p < 0.14) scale = lerp(0.4, 1.06, easeOut(p / 0.14));
      else if (p < 0.22) scale = lerp(1.06, 1, (p - 0.14) / 0.08);
      else if (p >= 0.66) {
        const q = easeInOut((p - 0.66) / 0.34);
        const tx = badge && !badge.destroyed ? badge.x - L.width / 2 : 0, ty = badge && !badge.destroyed ? badge.y - L.height / 2 : 0;
        scale = lerp(1, badge && !badge.destroyed ? L.b / P : 0.2, q);
        x = lerp(0, tx, q); y = lerp(0, ty, q);
        if (!badge || badge.destroyed) big.alpha = 1 - q; // removed while in the air
      }
      big.scale.set(scale);
      big.position.set(x, y);
      if (p < 0.14) big.alpha = p / 0.14;
      tag.alpha = p < 0.16 ? p / 0.16 : p < 0.58 ? 1 : p < 0.7 ? 1 - (p - 0.58) / 0.12 : 0;
      return;
    }
    if (!pop.destroyed) pop.visible = false;
    if (badge && !badge.destroyed) {
      badge.alpha = 1;
      const b = Math.min(1, (performance.now() - start - POP_MS) / BUMP_MS);
      badge.scale.set(lerp(1.25, 1, easeOut(b)));
      if (b < 1) return;
    }
    finish();
  };
  ticker.add(tick);
}

function queue(token) {
  update(token).catch((err) => console.warn(`${MOD} |`, err));
}
const redrawAll = () => canvas.tokens?.placeables.forEach(queue);

function readSettings() {
  for (const k of Object.keys(opts)) opts[k] = game.settings.get(MOD, k);
}

function registerSettings() {
  const changed = () => { readSettings(); redrawAll(); };
  game.settings.register(MOD, "enabled", {
    name: "Show condition badges", hint: "Draws conditions as large badges along the bottom of each token. Only affects your own screen.",
    scope: "client", config: true, type: Boolean, default: true, onChange: changed,
  });
  game.settings.register(MOD, "entrance", {
    name: "Entrance animation", hint: "When a condition is applied, show its icon and name large over the token for about two seconds before it settles into its badge. Only affects your own screen.",
    scope: "client", config: true, type: Boolean, default: true, onChange: changed,
  });
  game.settings.register(MOD, "concentration", {
    name: "Badge for Concentrating", hint: "Also show a badge (and an entrance) when a creature starts concentrating on a spell.",
    scope: "world", config: true, type: Boolean, default: true, onChange: changed,
  });
  game.settings.register(MOD, "size", {
    name: "Badge size", hint: "Multiplies the badge size. 1 is a fifth of the token's width, never smaller than about half a grid square.",
    scope: "world", config: true, type: Number, range: { min: 0.6, max: 1.6, step: 0.1 }, default: 1, onChange: changed,
  });
  readSettings();
  const mod = game.modules.get(MOD);
  if (mod) mod.api = { refresh: queue, refreshAll: redrawAll };
}

Hooks.once("init", registerSettings);
Hooks.on("refreshToken", (token, flags) => {
  if (flags.refreshEffects || flags.refreshSize) return queue(token);
  if (flags.refreshState) {
    const root = token[SYM]?.root;
    if (root && !root.destroyed) root.visible = token.effects?.visible !== false;
  }
});
Hooks.on("canvasInit", () => seen.clear());
