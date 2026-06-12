/* ── Critter Ranch: living scenes ───────────────────────────
 *
 * A lightweight actor engine that makes the game world feel alive:
 *  - Ranch: your creatures wander the pasture, sleep off cooldowns,
 *    court in pairs (with an incubating egg between them), and babies
 *    beg for care.
 *  - Wilds: creatures HIDE. Bushes rustle, footprints appear, heads
 *    peek out — tap a bush to flush a creature into the open, then
 *    tap the creature to attempt a catch. Some bushes are decoys
 *    (occasionally hiding loose coins).
 *
 * Actors are positioned in scene % coordinates and moved by a single
 * requestAnimationFrame loop, so the DOM can be re-mounted by the UI
 * layer without breaking animation.
 */

const SCENERY = {
  ranch:   { props: ["🌳", "🌷", "🪵", "🌼", "🍄", "🌿"], bush: null },
  meadow:  { props: ["🌼", "🌸", "🌳", "🌻"], bush: "🌾" },
  forest:  { props: ["🌲", "🌲", "🍄", "🪵"], bush: "🌳" },
  swamp:   { props: ["🌿", "🪷", "🌱", "🪵"], bush: "🪨" },
  peaks:   { props: ["🌲", "⛰️", "🌨️", "🪨"], bush: "🪨" },
  caldera: { props: ["🌋", "🪨", "🔥", "🦴"], bush: "🪨" },
};

const scene = {
  key: null,
  el: null,
  theme: null,
  biome: null,    // set for wilds scenes
  raf: 0,
  lastTs: 0,
  actors: new Map(),  // actorId -> actor
  hunts: new Map(),   // bushId  -> hunt record
};

function rnd(a, b) { return a + Math.random() * (b - a); }

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
  scene.hunts.clear();
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
  if (scene.biome) stepHunts(t);
  scene.raf = requestAnimationFrame(sceneLoop);
}

function stepActor(a, dt, t) {
  if (a.mode === "sleep" || a.mode === "static" || a.mode === "pair") return;
  const dx = a.tx - a.x, dy = a.ty - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 0.6) {
    const step = Math.min(a.speed * dt, dist);
    a.x += (dx / dist) * step;
    a.y += (dy / dist) * step * 0.65; // vertical movement reads slower
    a.flip = dx < 0;
    a.el.classList.add("walking");
    placeActor(a);
  } else {
    a.el.classList.remove("walking");
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
    const id = "c" + c.id;
    seen.add(id);
    let a = scene.actors.get(id);
    if (!a) a = makeActor(id, SPECIES[c.species].emoji, { kind: "creature" });
    a.nameEl.textContent = c.name;
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

/* ── Wild hunts ── */

function buildHunts(biomeId) {
  scene.biome = biomeId;
  const wild = state.wilds[biomeId];
  const spawns = wild ? wild.spawns : [];
  const bushEmoji = SCENERY[biomeId].bush;
  const slots = spawns.length + 3; // extra bushes are decoys

  // shuffle spawn assignment so occupied bushes aren't predictable
  const deck = spawns.map(s => s.uid);
  while (deck.length < slots) deck.push(null);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  for (let i = 0; i < slots; i++) {
    const pos = { x: 8 + (i + 0.5) * (84 / slots) + rnd(-4, 4), y: rnd(63, 89) };
    const id = "b" + i;
    const el = document.createElement("button");
    el.className = "bush";
    el.dataset.bid = id;
    el.textContent = bushEmoji;
    el.style.left = pos.x + "%";
    el.style.top = pos.y + "%";
    el.style.zIndex = Math.round(pos.y);
    scene.el.appendChild(el);
    scene.hunts.set(id, {
      id, el, pos,
      spawnUid: deck[i],
      state: "hidden",
      nextEvent: now() + rnd(0.8, 5),
      revealUntil: 0,
      actor: null,
    });
  }
}

function findSpawn(uid) {
  const wild = state.wilds[scene.biome];
  return uid && wild ? wild.spawns.find(s => s.uid === uid) : null;
}

function stepHunts(t) {
  for (const h of scene.hunts.values()) {
    const spawn = findSpawn(h.spawnUid);
    if (h.actor && !spawn) hideHunt(h); // caught or fled elsewhere
    if (t < h.nextEvent) continue;

    if (h.state === "revealed") {
      if (t > h.revealUntil && h.actor) {
        sceneParticle(h.actor.x, h.actor.y - 10, "💨");
        hideHunt(h);
      }
      h.nextEvent = t + 1;
      continue;
    }

    if (spawn) {
      bushWiggle(h);
      if (Math.random() < 0.45) showPeek(h, spawn);
      if (Math.random() < 0.6) {
        sceneParticle(h.pos.x + rnd(-6, 6), h.pos.y + rnd(-1, 3), "🐾", "prints");
      }
      h.nextEvent = t + rnd(3.5, 8);
    } else {
      if (Math.random() < 0.3) bushWiggle(h); // just the wind
      h.nextEvent = t + rnd(7, 14);
    }
  }
}

function bushWiggle(h) {
  h.el.classList.remove("wiggling");
  void h.el.offsetWidth;
  h.el.classList.add("wiggling");
}

function showPeek(h, spawn) {
  if (h.el.querySelector(".peek")) return;
  const s = document.createElement("span");
  s.className = "peek";
  s.textContent = SPECIES[spawn.creature.species].emoji;
  h.el.appendChild(s);
  setTimeout(() => s.remove(), 1300);
}

function revealHunt(h, spawn) {
  h.state = "revealed";
  h.revealUntil = now() + 20;
  const c = spawn.creature;
  const a = makeActor("w" + spawn.uid, SPECIES[c.species].emoji, {
    kind: "wild", x: h.pos.x, y: h.pos.y, scale: 0.95, speed: rnd(4, 7),
  });
  a.badgeEl.textContent = "Lv " + creatureLevel(c);
  a.badgeEl.classList.add("lvl-tag");
  a.nameEl.textContent = SPECIES[c.species].name;
  a.wrapEl.classList.add("pop-in");
  h.actor = a;
  h.el.classList.add("empty");
  sceneParticle(h.pos.x, h.pos.y - 12, "❗");
}

function hideHunt(h) {
  if (h.actor) removeActor(h.actor.id);
  h.actor = null;
  h.state = "hidden";
  h.el.classList.remove("empty");
}

/* ── Tap handling ── */

function onSceneTap(e) {
  const bushEl = e.target.closest(".bush");
  if (bushEl) { huntTapBush(bushEl.dataset.bid); return; }
  const actorEl = e.target.closest(".actor");
  if (actorEl) sceneTapActor(actorEl.dataset.aid);
}

function huntTapBush(bid) {
  const h = scene.hunts.get(bid);
  if (!h) return;
  bushWiggle(h);
  const spawn = findSpawn(h.spawnUid);

  if (spawn && h.state === "hidden") {
    revealHunt(h, spawn);
    sfxPlay("reveal");
    return;
  }
  if (!spawn && h.state === "hidden") {
    h.spawnUid = null;
    if (Math.random() < 0.18) {
      const found = 2 + Math.floor(Math.random() * 7);
      actionForage(found);
      sceneParticle(h.pos.x, h.pos.y - 10, "🪙");
      document.getElementById("coin-amount").textContent = fmt(state.coins);
      flashCoins();
      sfxPlay("coin");
      toast(`Found 🪙 ${found} hidden here!`, "good");
    } else {
      sceneParticle(h.pos.x, h.pos.y - 10, "🍂");
      sfxPlay("forage");
    }
  }
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
  } else if (aid[0] === "w") {
    sfxPlay("tap");
    openCatch(scene.biome, aid.slice(1));
  }
}
