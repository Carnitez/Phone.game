/* ── Critter Ranch: living scenes ───────────────────────────
 *
 * A lightweight actor engine that makes the game world feel alive:
 *  - Ranch: your creatures wander the pasture, sleep off cooldowns,
 *    court in pairs (with an incubating egg between them), and babies
 *    beg for care.
 *  - Wilds: a Pokémon-style OVERWORLD. You steer a trainer around the
 *    zone (tap the ground to walk, tap a creature to chase it). Wild
 *    creatures roam in the open; they spook and bolt when you get close,
 *    so you have to corner them. Walk into one to start a taming
 *    encounter (the catch minigame). Tall grass rustles as you pass and
 *    loose treasure lies in the field for the taking.
 *
 * Actors are positioned in scene % coordinates and moved by a single
 * requestAnimationFrame loop, so the DOM can be re-mounted by the UI
 * layer without breaking animation.
 */

const SCENERY = {
  ranch:   { props: ["🌳", "🌷", "🪵", "🌼", "🍄", "🌿"], bush: null },
  meadow:  { props: ["🌼", "🌸", "🌳", "🌻"], bush: "🌾" },
  forest:  { props: ["🌲", "🌲", "🍄", "🪵"], bush: "🌳" },
  swamp:   { props: ["🌿", "🪷", "🌱", "🪵"], bush: "🌿" },
  peaks:   { props: ["🌲", "⛰️", "🌨️", "🪨"], bush: "🪨" },
  caldera: { props: ["🌋", "🪨", "🔥", "🦴"], bush: "🪨" },
};

const ENCOUNTER_R = 6.8;   // how close the trainer must get to start a tame
const PLAYER_SPEED = 23;   // % of field width per second

const scene = {
  key: null,
  el: null,
  theme: null,
  biome: null,    // set for wilds scenes
  raf: 0,
  lastTs: 0,
  actors: new Map(),  // actorId -> actor
  player: null,       // trainer avatar (wilds only)
  grass: [],          // tall-grass tufts
  items: [],          // loose field treasure
  pursue: null,       // actorId the trainer is chasing
  nextItemAt: 0,
};

function rnd(a, b) { return a + Math.random() * (b - a); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function sceneStop() {
  if (scene.raf) cancelAnimationFrame(scene.raf);
  scene.raf = 0;
}

function sceneDestroy() {
  sceneStop();
  scene.key = null;
  scene.el = null;
  scene.theme = null;
  scene.biome = null;
  scene.actors.clear();
  scene.player = null;
  scene.grass = [];
  scene.items = [];
  scene.pursue = null;
}

/* Mount (or re-mount) a scene into the #scene-mount placeholder the
 * renderer just produced. Same key → the live DOM node is reused. */
function mountScene(key, theme, builder) {
  const ph = document.getElementById("scene-mount");
  if (!ph) return;
  if (scene.key !== key || !scene.el) {
    sceneDestroy();
    scene.key = key;
    scene.theme = theme;
    scene.el = document.createElement("div");
    scene.el.className = "scene scene-" + theme;
    scene.el.addEventListener("click", onSceneTap);
    buildProps();
    if (builder) builder();
  }
  ph.replaceWith(scene.el);
  scene.lastTs = 0;
  sceneSync();
  if (!scene.raf) scene.raf = requestAnimationFrame(sceneLoop);
}

function buildProps() {
  const props = SCENERY[scene.theme].props;
  for (let i = 0; i < 7; i++) {
    const p = document.createElement("span");
    p.className = "scene-prop";
    p.textContent = props[i % props.length];
    const y = rnd(57, 94);
    p.style.left = rnd(3, 97) + "%";
    p.style.top = y + "%";
    p.style.zIndex = Math.round(y);
    p.style.fontSize = Math.round(13 + y * 0.18) + "px";
    scene.el.appendChild(p);
  }
}

/* ── Actors ── */

function makeActor(id, emoji, opts = {}) {
  const a = {
    id,
    kind: opts.kind || "creature",
    el: document.createElement("div"),
    wrapEl: null, badgeEl: null, nameEl: null,
    x: opts.x ?? rnd(10, 90),
    y: opts.y ?? rnd(62, 90),
    tx: 0, ty: 0,
    speed: opts.speed ?? rnd(5.5, 9.5),
    nextThink: 0,
    mode: opts.mode || "idle",
    scale: opts.scale ?? 1,
    flip: false,
  };
  a.tx = a.x; a.ty = a.y;
  a.el.className = "actor";
  a.el.dataset.aid = id;
  a.el.innerHTML =
    `<span class="actor-badge"></span>` +
    `<span class="aw"><span class="actor-emoji">${emoji}</span></span>` +
    `<span class="actor-name"></span>`;
  a.wrapEl = a.el.querySelector(".aw");
  a.badgeEl = a.el.querySelector(".actor-badge");
  a.nameEl = a.el.querySelector(".actor-name");
  scene.el.appendChild(a.el);
  scene.actors.set(id, a);
  placeActor(a);
  return a;
}

function placeActor(a) {
  a.el.style.left = a.x.toFixed(2) + "%";
  a.el.style.top = a.y.toFixed(2) + "%";
  a.el.style.zIndex = Math.round(a.y);
  const depth = 0.72 + ((a.y - 56) / 38) * 0.45; // farther back = smaller
  a.wrapEl.style.transform =
    `scale(${(a.scale * depth).toFixed(3)})${a.flip ? " scaleX(-1)" : ""}`;
}

function removeActor(id) {
  const a = scene.actors.get(id);
  if (a) { a.el.remove(); scene.actors.delete(id); }
}

function sceneParticle(x, y, emoji, cls = "") {
  if (!scene.el) return;
  const s = document.createElement("span");
  s.className = "scene-particle " + cls;
  s.textContent = emoji;
  s.style.left = x + "%";
  s.style.top = y + "%";
  scene.el.appendChild(s);
  setTimeout(() => s.remove(), 1700);
}

/* ── Animation loop ── */

function sceneLoop(ts) {
  if (!scene.el || !scene.el.isConnected) { sceneStop(); return; }
  const dt = scene.lastTs ? Math.min(0.1, (ts - scene.lastTs) / 1000) : 0.016;
  scene.lastTs = ts;
  const t = now();
  for (const a of scene.actors.values()) stepActor(a, dt, t);
  if (scene.biome) stepOverworld(t, dt);
  scene.raf = requestAnimationFrame(sceneLoop);
}

function stepActor(a, dt, t) {
  if (a.mode === "sleep" || a.mode === "static" || a.mode === "pair") return;

  let spd = a.speed;
  let fleeing = false;

  // Wild creatures notice the trainer and bolt — rarer ones spook sooner.
  if (a.kind === "wild" && scene.player) {
    const p = scene.player;
    const pd = Math.hypot(p.x - a.x, p.y - a.y);
    if (pd < a.alert) {
      const ax = a.x - p.x, ay = a.y - p.y;
      const m = Math.hypot(ax, ay) || 1;
      a.tx = clamp(a.x + (ax / m) * 18, 6, 94);
      a.ty = clamp(a.y + (ay / m) * 10, 58, 91);
      a.nextThink = t + 0.6;
      spd = a.fleeSpeed;
      fleeing = true;
      if (!a.alarmed) {
        a.alarmed = true;
        a.badgeEl.textContent = "❗";
        a.badgeEl.classList.add("bounce");
        sceneParticle(a.x, a.y - 13, "❗");
      }
    } else if (a.alarmed && pd > a.alert + 7) {
      a.alarmed = false;
      a.badgeEl.textContent = a.lvlLabel;
      a.badgeEl.classList.remove("bounce");
    }
  }

  const dx = a.tx - a.x, dy = a.ty - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 0.6) {
    const step = Math.min(spd * dt, dist);
    a.x += (dx / dist) * step;
    a.y += (dy / dist) * step * 0.65; // vertical movement reads slower
    a.flip = dx < 0;
    a.el.classList.add("walking");
    a.el.classList.toggle("bolting", fleeing);
    placeActor(a);
    if (fleeing && Math.random() < 0.09) {
      sceneParticle(a.x + rnd(-3, 3), a.y, "🐾", "prints");
    }
  } else {
    a.el.classList.remove("walking", "bolting");
    if (t > a.nextThink) {
      if (Math.random() < 0.65) {
        a.tx = rnd(7, 93);
        a.ty = rnd(60, 90);
      }
      a.nextThink = t + rnd(1.5, 5.5);
    }
  }
}

/* ── Sync with game state (called on mount + once per second) ── */

function sceneSync() {
  if (!scene.el) return;
  const t = now();
  if (scene.theme === "ranch") syncRanchScene(t);
  else if (scene.biome) syncOverworld(t);
}

function syncRanchScene(t) {
  const seen = new Set();
  const pairSpot = {};
  state.pairs.forEach((p, i) => {
    const cx = 26 + (i % 3) * 24;
    pairSpot[p.motherId] = { x: cx - 6, pair: p };
    pairSpot[p.fatherId] = { x: cx + 6, pair: p };
    // ambient hearts over courting pairs
    if (Math.random() < 0.35) sceneParticle(cx + rnd(-7, 7), 66, "💕");
  });

  for (const c of ranchList()) {
    if (onExpedition(c.id)) continue; // away from the ranch
    const id = "c" + c.id;
    seen.add(id);
    let a = scene.actors.get(id);
    if (!a) a = makeActor(id, SPECIES[c.species].emoji, { kind: "creature" });
    a.el.classList.toggle("shiny-actor", !!c.shiny);
    a.nameEl.textContent = (c.shiny ? "✨" : "") + c.name;
    const baby = !isAdult(c, t);
    a.scale = baby ? 0.62 : 1;

    const spot = pairSpot[c.id];
    if (spot) {
      a.mode = "pair";
      a.x = a.tx = spot.x;
      a.y = a.ty = 76;
      a.flip = spot.x > 50 ? true : false;
      a.badgeEl.textContent = "💕";
      a.badgeEl.classList.remove("bounce");
      a.el.classList.remove("walking", "sleeping");
      placeActor(a);
    } else if (!baby && c.cooldownUntil > t) {
      a.mode = "sleep";
      a.badgeEl.textContent = "💤";
      a.badgeEl.classList.remove("bounce");
      a.el.classList.add("sleeping");
      a.el.classList.remove("walking");
    } else {
      if (a.mode !== "idle") {
        a.mode = "idle";
        a.el.classList.remove("sleeping");
      }
      const careReady = baby && c.nextCareAt && c.nextCareAt <= t && c.imprint < 0.999;
      a.badgeEl.textContent = careReady ? "🍼" : "";
      a.badgeEl.classList.toggle("bounce", careReady);
    }
    placeActor(a);
  }

  // incubating eggs sit between their parents
  for (const p of state.pairs) {
    const id = "e" + p.id;
    if (p.stage !== "egg") continue;
    seen.add(id);
    let a = scene.actors.get(id);
    if (!a) {
      const cx = 26 + (state.pairs.indexOf(p) % 3) * 24;
      a = makeActor(id, "🥚", { kind: "egg", x: cx, y: 82, scale: 0.8, mode: "static" });
      a.el.classList.add("egg-wobble");
    }
    a.nameEl.textContent = fmtTime(p.doneAt - t);
  }

  for (const id of [...scene.actors.keys()]) {
    if (!seen.has(id)) removeActor(id);
  }
}

/* ── Wild overworld ── */

function buildOverworld(biomeId) {
  scene.biome = biomeId;
  scene.pursue = null;
  scene.grass = [];
  scene.items = [];
  scene.nextItemAt = now() + rnd(12, 26);

  buildGrass(biomeId);
  scene.player = makePlayer();

  const wild = state.wilds[biomeId];
  const spawns = wild ? wild.spawns : [];
  for (const s of spawns) spawnWildActor(s);

  scatterItem();
  if (Math.random() < 0.5) scatterItem();
}

function makePlayer() {
  const p = {
    id: "player", kind: "player",
    el: document.createElement("div"),
    wrapEl: null,
    x: 50, y: 90, tx: 50, ty: 90,
    speed: PLAYER_SPEED, scale: 1, flip: false,
  };
  p.el.className = "actor player-actor";
  p.el.innerHTML =
    `<span class="aw"><span class="actor-emoji">🧑‍🌾</span></span>` +
    `<span class="actor-name">You</span>`;
  p.wrapEl = p.el.querySelector(".aw");
  scene.el.appendChild(p.el);
  placeActor(p);
  return p;
}

function buildGrass(biomeId) {
  const ch = SCENERY[biomeId].bush || "🌿";
  for (let i = 0; i < 6; i++) {
    const x = rnd(8, 92), y = rnd(60, 90);
    const g = document.createElement("span");
    g.className = "grass-tuft";
    g.textContent = ch + ch + ch;
    g.style.left = x + "%";
    g.style.top = y + "%";
    g.style.zIndex = Math.round(y) - 1;
    g.style.fontSize = Math.round(15 + y * 0.13) + "px";
    scene.el.appendChild(g);
    scene.grass.push({ el: g, x, y, rustleAt: 0 });
  }
}

function spawnWildActor(s) {
  const c = s.creature;
  const rOrder = rarityOrder(c.species);
  const a = makeActor("w" + s.uid, SPECIES[c.species].emoji, {
    kind: "wild",
    x: rnd(12, 88), y: rnd(60, 88),
    scale: 0.95,
    speed: rnd(4.5, 7),
  });
  a.el.classList.add("wild-actor");
  if (c.shiny) a.el.classList.add("shiny-actor");
  a.fleeSpeed = 12 + rOrder * 2.4;   // rarer creatures run harder
  a.alert = 15 + rOrder * 3;         // …and notice you sooner
  a.alarmed = false;
  a.engaged = false;
  a.lvlLabel = "Lv " + creatureLevel(c);
  a.badgeEl.textContent = a.lvlLabel;
  a.badgeEl.classList.add("lvl-tag");
  a.nameEl.textContent = (c.shiny ? "✨" : "") + SPECIES[c.species].name;
  a.wrapEl.classList.add("pop-in");
  return a;
}

function scatterItem() {
  const gem = Math.random() < 0.22;
  const x = rnd(10, 90), y = rnd(60, 90);
  const el = document.createElement("span");
  el.className = "field-item" + (gem ? " gem" : "");
  el.textContent = gem ? "💎" : "🪙";
  el.style.left = x + "%";
  el.style.top = y + "%";
  el.style.zIndex = Math.round(y);
  scene.el.appendChild(el);
  scene.items.push({ el, x, y, value: gem ? 8 + rand(14) : 2 + rand(6) });
}

function collectItem(it) {
  scene.items = scene.items.filter(x => x !== it);
  it.el.classList.add("collected");
  setTimeout(() => it.el.remove(), 300);
  actionForage(it.value);
  const cd = document.getElementById("coin-amount");
  if (cd) cd.textContent = fmt(state.coins);
  flashCoins();
  sfxPlay("coin");
  sceneParticle(it.x, it.y - 8, "🪙");
}

/* Keep wild actors reconciled with the spawn list (catches, refreshes). */
function syncOverworld(t) {
  if (!scene.player) scene.player = makePlayer();
  const wild = state.wilds[scene.biome];
  const spawns = wild ? wild.spawns : [];
  const present = new Set(spawns.map(s => "w" + s.uid));
  for (const id of [...scene.actors.keys()]) {
    if (id[0] === "w" && !present.has(id)) removeActor(id);
  }
  for (const s of spawns) {
    if (!scene.actors.has("w" + s.uid)) spawnWildActor(s);
  }
}

function stepOverworld(t, dt) {
  stepPlayer(t, dt);
  if (t > scene.nextItemAt && scene.items.length < 2) {
    scatterItem();
    scene.nextItemAt = t + rnd(18, 36);
  }
  checkEncounters(t);
}

function stepPlayer(t, dt) {
  const p = scene.player;
  if (!p) return;

  // Chasing a creature? Steer toward its live position.
  if (scene.pursue) {
    const tgt = scene.actors.get(scene.pursue);
    if (tgt && tgt.kind === "wild") { p.tx = tgt.x; p.ty = tgt.y; }
    else scene.pursue = null;
  }

  const dx = p.tx - p.x, dy = p.ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 0.9) {
    const step = Math.min(p.speed * dt, dist);
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step * 0.7;
    p.flip = dx < 0;
    p.el.classList.add("walking");
    placeActor(p);

    // rustle tall grass we brush past
    for (const g of scene.grass) {
      if (t > g.rustleAt && Math.hypot(g.x - p.x, g.y - p.y) < 6) {
        g.el.classList.remove("rustle");
        void g.el.offsetWidth;
        g.el.classList.add("rustle");
        g.rustleAt = t + 0.5;
      }
    }
    // collect any treasure we walk over
    for (const it of scene.items) {
      if (Math.hypot(it.x - p.x, it.y - p.y) < 5.5) collectItem(it);
    }
  } else {
    p.el.classList.remove("walking");
  }
}

function checkEncounters(t) {
  const p = scene.player;
  if (!p) return;
  // never interrupt an open modal (catch / hatch / detail)
  if (document.getElementById("modal-root").childElementCount) return;
  for (const a of scene.actors.values()) {
    if (a.kind !== "wild") continue;
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d < ENCOUNTER_R && !a.engaged) {
      a.engaged = true;
      startEncounter(a, t);
      return;
    } else if (d > a.alert) {
      a.engaged = false; // re-arm once the trainer backs off
    }
  }
}

function startEncounter(a, t) {
  scene.pursue = null;
  const p = scene.player;
  if (p) { p.tx = p.x; p.ty = p.y; p.el.classList.remove("walking"); }
  sceneParticle(a.x, a.y - 13, "❕");
  sfxPlay("reveal");
  buzz([20, 40, 20]);
  openCatch(scene.biome, a.id.slice(1));
}

/* ── Tap handling ── */

function onSceneTap(e) {
  if (scene.biome) { overworldTap(e); return; }
  const actorEl = e.target.closest(".actor");
  if (actorEl) sceneTapActor(actorEl.dataset.aid);
}

function overworldTap(e) {
  // Tapped a creature → chase it.
  const wildEl = e.target.closest(".actor.wild-actor");
  if (wildEl) {
    const a = scene.actors.get(wildEl.dataset.aid);
    if (a) { scene.pursue = a.id; sfxPlay("tap"); }
    return;
  }
  // Tapped open ground → walk there.
  if (!scene.player) return;
  const rect = scene.el.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * 100;
  const py = ((e.clientY - rect.top) / rect.height) * 100;
  scene.pursue = null;
  scene.player.tx = clamp(px, 4, 96);
  scene.player.ty = clamp(py, 56, 94);
}

function sceneTapActor(aid) {
  const t = now();
  if (aid[0] === "c") {
    const c = state.creatures[Number(aid.slice(1))];
    if (!c) return;
    const careReady = !isAdult(c, t) && c.nextCareAt && c.nextCareAt <= t && c.imprint < 0.999;
    if (careReady) {
      const res = actionCare(c.id);
      if (res.ok) {
        const a = scene.actors.get(aid);
        if (a) {
          sceneParticle(a.x, a.y - 16, "💖");
          sceneParticle(a.x + 5, a.y - 11, "💕");
        }
        sfxPlay("care");
        toast(`💖 ${c.name}: imprint ${Math.round(res.imprint * 100)}%!`, "good");
        render();
      }
      return;
    }
    sfxPlay("tap");
    openDetail(c.id);
  } else if (aid[0] === "e") {
    const p = state.pairs.find(p => "e" + p.id === aid);
    if (p) toast(`🥚 Hatching in ${fmtTime(p.doneAt - now())}…`);
  }
}
