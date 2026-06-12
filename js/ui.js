/* ── Critter Ranch: UI rendering & interaction ──────────────
 *
 * Rendering model: full re-renders happen only on tab switches,
 * player actions, and structural state changes (detected via a
 * cheap per-tab signature). Once a second, tickUpdate() refreshes
 * countdowns / progress bars in place via data attributes, so the
 * living scenes and scrolling are never disturbed.
 */

const ui = {
  tab: "ranch",
  biome: "meadow",
  pairMother: null,
  pairFather: null,
  lastSig: "",
  catch: null, // active minigame { raf, spawnUid, biomeId, netId, pos, dir, ... }
};

const pendingHatches = [];

const $view = document.getElementById("view");
const $modalRoot = document.getElementById("modal-root");
const $toastRoot = document.getElementById("toast-root");

/* ── helpers ── */

function esc(s) {
  return String(s).replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function fmt(n) {
  if (n >= 100000) return (n / 1000).toFixed(0) + "k";
  if (n >= 10000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString("en-US");
}

function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec >= 3600) return Math.floor(sec / 3600) + "h " + Math.floor((sec % 3600) / 60) + "m";
  if (sec >= 60) return Math.floor(sec / 60) + "m " + (sec % 60) + "s";
  return sec + "s";
}

function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  $toastRoot.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function flashCoins() {
  const el = document.getElementById("coin-display");
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

function rarityName(c) { return RARITIES[SPECIES[c.species].rarity].name; }
function rarityClass(c) { return "r-" + SPECIES[c.species].rarity; }

function sexHTML(c) {
  return `<span class="sex ${c.sex}">${c.sex === "F" ? "♀" : "♂"}</span>`;
}

function regionDotsHTML(c) {
  return `<div class="region-dots">` + c.colors.map(ci =>
    `<span class="region-dot ${ci >= MUTATION_COLOR_START ? "mutated" : ""}" style="background:${COLORS[ci]}"></span>`
  ).join("") + `</div>`;
}

function statMinisHTML(c) {
  return `<div class="stat-minis">` + STATS.map(s => {
    const pct = Math.min(100, c.points[s] / CONFIG.maxWildPointsPerStat * 100);
    return `<div class="stat-mini">
      <div class="stat-mini-bar"><div class="stat-mini-fill" style="width:${pct}%;background:${STAT_META[s].color}"></div></div>
      <div class="stat-mini-label">${c.points[s]}</div>
    </div>`;
  }).join("") + `</div>`;
}

function careIsReady(c, t) {
  return !isAdult(c, t) && c.nextCareAt && c.nextCareAt <= t && c.imprint < 0.999;
}

function statusHTML(c, t) {
  if (!isAdult(c, t)) {
    return `<span class="creature-status" data-mat="${c.bornAt},${c.matureAt}" data-matp="🍼 ">🍼 ${Math.floor(maturation(c, t) * 100)}%</span>`;
  }
  if (creatureInPair(c.id)) return `<span class="creature-status cooldown">💞 breeding</span>`;
  if (c.cooldownUntil > t) return `<span class="creature-status cooldown" data-cd="${c.cooldownUntil}" data-cdp="⏳ ">⏳ ${fmtTime(c.cooldownUntil - t)}</span>`;
  return `<span class="creature-status ready">✓ ready</span>`;
}

function creatureCardHTML(c, t) {
  const sp = SPECIES[c.species];
  const muta = totalMutations(c);
  const value = saleValue(c, t, state.demand);
  const baby = !isAdult(c, t);
  return `<div class="card creature-card ${rarityClass(c)}" data-action="detail" data-id="${c.id}">
    <div class="creature-emoji ${baby ? "baby" : ""}">${sp.emoji}</div>
    <div class="creature-info">
      <div class="creature-name-row">
        <span class="creature-name">${esc(c.name)}</span>
        ${sexHTML(c)}
        <span class="lvl-chip">Lv ${creatureLevel(c)}</span>
        ${muta ? `<span class="muta-chip">🧬${muta}</span>` : ""}
      </div>
      <div class="creature-meta">${sp.name} • ${rarityName(c)}${c.gen ? ` • Gen ${c.gen}` : ""}</div>
      ${statMinisHTML(c)}
    </div>
    <div class="creature-side">
      <div class="creature-value">🪙 ${fmt(value)}</div>
      ${statusHTML(c, t)}
      ${regionDotsHTML(c)}
    </div>
  </div>`;
}

/* ══ RANCH ══ */

function renderRanch(t) {
  const list = ranchList().sort((a, b) =>
    rarityOrder(b.species) - rarityOrder(a.species) || creatureLevel(b) - creatureLevel(a));
  let html = `<div class="view-title">Your Ranch</div>
    <div class="view-sub">${list.length}/${CONFIG.ranchCap} creatures •
      🪤 nets: ${state.nets.basic + state.nets.strong + state.nets.mythic} •
      lifetime earned 🪙 ${fmt(state.tally.earned)}</div>
    <div id="scene-mount"></div>`;

  if (!list.length) {
    html += `<div class="empty-hint"><span class="e-ico">🏜️</span>
      Your pasture is empty!<br>Head to the <b>Wilds</b> to capture creatures,<br>or buy a pair at the <b>Market</b>.</div>`;
  } else {
    html += `<div class="section-head"><h3>Herd</h3><span style="font-size:11px;color:var(--dim)">tap a creature for details</span></div>`;
    html += list.map(c => creatureCardHTML(c, t)).join("");
  }
  return html;
}

/* ══ WILDS ══ */

function renderWilds(t) {
  let html = `<div class="view-title">The Wilds</div>
    <div class="view-sub">Watch for rustling and footprints — something's hiding.</div>`;

  html += `<div class="biome-tabs">` + Object.keys(BIOMES).map(id => {
    const b = BIOMES[id];
    const unlocked = state.biomes.includes(id);
    const active = ui.biome === id ? "active" : "";
    return `<button class="biome-tab ${active} ${unlocked ? "" : "locked"}" data-action="biome" data-id="${id}">
      ${b.ico} ${b.name}${unlocked ? "" : ` 🔒`}</button>`;
  }).join("") + `</div>`;

  const biome = BIOMES[ui.biome];
  if (!state.biomes.includes(ui.biome)) {
    html += `<div class="empty-hint"><span class="e-ico">${biome.ico}</span>
      <b>${biome.name}</b> — wild levels ${biome.levels[0]}–${biome.levels[1]}<br>
      Home to ${Object.values(SPECIES).filter(s => s.biome === ui.biome).map(s => s.emoji).join(" ")}<br><br>
      <button class="btn gold" data-action="unlock-biome" data-id="${ui.biome}">Unlock for 🪙 ${fmt(biome.cost)}</button>
    </div>`;
    return html;
  }

  const wild = state.wilds[ui.biome];
  const count = wild ? wild.spawns.length : 0;
  html += `<div id="scene-mount"></div>
    <div class="section-head" style="margin-top:4px"><h3>🐾 ${count} hiding here</h3>
      <span style="font-size:12px;color:var(--dim)">
        <span data-cd="${wild ? wild.refreshAt : 0}" data-cdp="new in ">new in ${wild ? fmtTime(wild.refreshAt - t) : "…"}</span>
        <button class="btn small ghost" data-action="refresh-wilds" style="margin-left:6px">🔄 ${CONFIG.wildManualRefreshCost}</button>
      </span></div>
    <div class="hunt-hint">Tap a <b>rustling bush</b> to flush a creature out — then tap the creature to throw a net.
      Empty spots sometimes hide loose coins. 🐾 footprints mean someone's home.</div>`;
  return html;
}

/* ══ BREEDING ══ */

function pairPickHTML(c, role) {
  if (!c) {
    return `<button class="pair-pick" data-action="pick-parent" data-role="${role}">
      <span class="pp-emoji">${role === "mother" ? "♀" : "♂"}</span>
      <span>Choose ${role === "mother" ? "female" : "male"}</span>
    </button>`;
  }
  const sp = SPECIES[c.species];
  return `<button class="pair-pick filled" data-action="pick-parent" data-role="${role}">
    <span class="pp-emoji">${sp.emoji}</span>
    <span class="pp-name">${esc(c.name)} ${c.sex === "F" ? "♀" : "♂"}</span>
    <span style="font-size:11px;color:var(--dim)">Lv ${creatureLevel(c)} • 🧬${totalMutations(c)}</span>
  </button>`;
}

function renderBreeding(t) {
  const mother = state.creatures[ui.pairMother] || null;
  const father = state.creatures[ui.pairFather] || null;

  let html = `<div class="view-title">Breeding Den</div>
    <div class="view-sub">Pair the best stats. Chase mutations. Build the ultimate line.</div>`;

  html += `<div class="card">
    <div class="pair-slot">
      ${pairPickHTML(mother, "mother")}
      <span class="pair-heart">💕</span>
      ${pairPickHTML(father, "father")}
    </div>`;

  if (mother && father && mother.species === father.species) {
    const prev = pairPreview(mother, father);
    const mMutaCapped = totalMutations(mother) >= CONFIG.mutationCap;
    const fMutaCapped = totalMutations(father) >= CONFIG.mutationCap;
    html += `<table class="preview-table">
      <tr><th></th><th>♀ ${esc(mother.name)}</th><th>♂ ${esc(father.name)}</th><th>Best roll</th></tr>
      ${prev.map(r => `<tr>
        <td>${STAT_META[r.stat].ico}</td>
        <td class="${r.m >= r.f ? "best" : ""}">${r.m}</td>
        <td class="${r.f >= r.m ? "best" : ""}">${r.f}</td>
        <td class="best">${r.best}</td>
      </tr>`).join("")}
    </table>
    <div style="font-size:11.5px;color:var(--dim);margin-top:8px">
      Each stat: ${Math.round(CONFIG.higherParentChance * 100)}% chance to inherit the higher parent.
      Mutation rolls — ♀ side: ${mMutaCapped ? "❌ capped (20/20)" : "✅ open"} •
      ♂ side: ${fMutaCapped ? "❌ capped (20/20)" : "✅ open"}
    </div>
    <button class="btn full gold" style="margin-top:12px" data-action="start-pair">💞 Start Breeding</button>`;
  } else if (mother && father) {
    html += `<div style="font-size:12.5px;color:var(--red);margin-top:10px;text-align:center">
      ⚠️ ${SPECIES[mother.species].name} and ${SPECIES[father.species].name} can't pair — same species only.</div>`;
  }
  html += `</div>`;

  if (state.pairs.length) {
    html += `<div class="section-head"><h3>In Progress</h3></div>`;
    html += state.pairs.map(p => {
      const m = state.creatures[p.motherId], f = state.creatures[p.fatherId];
      const pct = Math.min(100, ((t - p.startedAt) / p.total) * 100);
      const label = p.stage === "mating" ? "💞 Courting…" : "🥚 Egg incubating…";
      return `<div class="card">
        <div style="font-weight:800;font-size:14px">${SPECIES[m.species].emoji} ${esc(m.name)} × ${esc(f.name)}</div>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" data-pg="${p.startedAt},${p.doneAt}" style="width:${pct}%"></div></div>
          <div class="progress-label"><span>${label}</span><span data-cd="${p.doneAt}">${fmtTime(p.doneAt - t)}</span></div>
        </div>
      </div>`;
    }).join("");
  }

  const kids = babies(t);
  if (kids.length) {
    html += `<div class="section-head"><h3>Nursery</h3></div>`;
    html += kids.map(c => {
      const sp = SPECIES[c.species];
      const pct = Math.floor(maturation(c, t) * 100);
      const careReady = careIsReady(c, t);
      return `<div class="card ${rarityClass(c)} creature-card" data-action="detail" data-id="${c.id}">
        <div class="creature-emoji baby">${sp.emoji}</div>
        <div class="creature-info">
          <div class="creature-name-row">
            <span class="creature-name">${esc(c.name)}</span> ${sexHTML(c)}
            <span class="lvl-chip">Lv ${creatureLevel(c)}</span>
            ${totalMutations(c) ? `<span class="muta-chip">🧬${totalMutations(c)}</span>` : ""}
          </div>
          <div class="progress-wrap">
            <div class="progress-bar"><div class="progress-fill" data-pg="${c.bornAt},${c.matureAt}" style="width:${pct}%"></div></div>
            <div class="progress-label">
              <span data-mat="${c.bornAt},${c.matureAt}" data-matp="Growing ">Growing ${pct}%</span>
              <span>💖 imprint ${Math.round(c.imprint * 100)}%</span>
            </div>
          </div>
        </div>
        <div class="creature-side">
          ${careReady
            ? `<button class="btn small ghost care-pulse" data-action="care" data-id="${c.id}">🍼 Care!</button>`
            : `<span class="creature-status">${c.nextCareAt ? `<span data-cd="${c.nextCareAt}" data-cdp="🍼 ">🍼 ${fmtTime(c.nextCareAt - t)}</span>` : "💤"}</span>`}
        </div>
      </div>`;
    }).join("");
  }

  if (!state.pairs.length && !kids.length && (!mother || !father)) {
    html += `<div class="empty-hint"><span class="e-ico">🥚</span>
      Pick a female and a male of the same species above.<br>
      Babies inherit each stat from one parent —<br>and might roll a <b>mutation</b> 🧬.</div>`;
  }
  return html;
}

/* ══ MARKET ══ */

function renderMarket(t) {
  const d = state.demand;
  let html = `<div class="view-title">Market</div>
    <div class="view-sub">Buy breeding stock, sell your lines, gear up.</div>`;

  if (d) {
    html += `<div class="demand-banner">📈 <b>Hot right now</b> (<span data-cd="${d.until}">${fmtTime(d.until - t)}</span>):
      ${SPECIES[d.species].emoji} <b>${SPECIES[d.species].name}</b> sell +${Math.round(CONFIG.demandSpeciesBonus * 100)}% •
      ${STAT_META[d.stat].ico} <b>${STAT_META[d.stat].name} ≥ ${CONFIG.demandStatThreshold}</b> sell +${Math.round(CONFIG.demandStatBonus * 100)}%</div>`;
  }

  html += `<div class="section-head"><h3>For Sale</h3>
    <span style="font-size:12px;color:var(--dim)"><span data-cd="${state.market.refreshAt}" data-cdp="restock ">restock ${fmtTime(state.market.refreshAt - t)}</span>
    <button class="btn small ghost" data-action="refresh-market" style="margin-left:6px">🔄 ${CONFIG.marketManualRefreshCost}</button></span></div>`;

  if (!state.market.offers.length) {
    html += `<div class="spawn-empty">Sold out — new stock soon.</div>`;
  } else {
    html += state.market.offers.map(o => {
      const c = o.creature;
      const sp = SPECIES[c.species];
      return `<div class="card creature-card ${rarityClass(c)}">
        <div class="creature-emoji">${sp.emoji}</div>
        <div class="creature-info">
          <div class="creature-name-row">
            <span class="creature-name">${sp.name}</span> ${sexHTML(c)}
            <span class="lvl-chip">Lv ${creatureLevel(c)}</span>
          </div>
          <div class="creature-meta">${rarityName(c)}</div>
          ${statMinisHTML(c)}
        </div>
        <div class="creature-side">
          <button class="btn small ${state.coins >= o.price ? "gold" : "ghost"}" data-action="buy-offer" data-id="${o.uid}">🪙 ${fmt(o.price)}</button>
          ${regionDotsHTML(c)}
        </div>
      </div>`;
    }).join("");
  }

  html += `<div class="section-head"><h3>Supplies</h3></div><div class="shop-grid">`;
  html += Object.keys(NETS).map(id => {
    const n = NETS[id];
    return `<div class="shop-item">
      <div class="s-ico">${n.ico}</div>
      <div class="s-name">${n.name} <span style="color:var(--dim)">×${state.nets[id]}</span></div>
      <div class="s-desc">${n.desc}</div>
      <button class="btn small full ${state.coins >= n.cost ? "" : "ghost"}" data-action="buy-net" data-id="${id}">🪙 ${n.cost}</button>
    </div>`;
  }).join("");
  html += `</div>`;

  const sellable = ranchList()
    .filter(c => !creatureInPair(c.id))
    .sort((a, b) => saleValue(b, t, d) - saleValue(a, t, d));
  if (sellable.length) {
    html += `<div class="section-head"><h3>Your Stock</h3></div>`;
    html += sellable.map(c => {
      const sp = SPECIES[c.species];
      const v = saleValue(c, t, d);
      const hot = d && (d.species === c.species || c.points[d.stat] >= CONFIG.demandStatThreshold);
      return `<div class="card creature-card ${rarityClass(c)}" data-action="detail" data-id="${c.id}">
        <div class="creature-emoji ${isAdult(c, t) ? "" : "baby"}">${sp.emoji}</div>
        <div class="creature-info">
          <div class="creature-name-row">
            <span class="creature-name">${esc(c.name)}</span> ${sexHTML(c)}
            <span class="lvl-chip">Lv ${creatureLevel(c)}</span>
            ${hot ? `<span class="lvl-chip" style="color:var(--accent)">📈 hot</span>` : ""}
          </div>
          <div class="creature-meta">${sp.name}${totalMutations(c) ? ` • 🧬${totalMutations(c)}` : ""}</div>
        </div>
        <div class="creature-side">
          <button class="btn small green" data-action="sell" data-id="${c.id}">Sell 🪙 ${fmt(v)}</button>
        </div>
      </div>`;
    }).join("");
  }
  return html;
}

/* ══ Render orchestration ══ */

function tabSignature(t) {
  switch (ui.tab) {
    case "ranch":
      return ranchList().map(c =>
        `${c.id}${isAdult(c, t) ? 1 : 0}${canBreed(c, t) ? 1 : 0}${careIsReady(c, t) ? 1 : 0}`).join("|") +
        "~" + state.pairs.map(p => p.id + p.stage).join(",");
    case "wilds": {
      const w = state.wilds[ui.biome];
      return ui.biome + "~" + state.biomes.join(",") + "~" +
        (w ? w.refreshAt + ":" + w.spawns.map(s => s.uid).join(",") : "");
    }
    case "breeding":
      return state.pairs.map(p => p.id + p.stage).join(",") + "~" +
        babies(t).map(c => `${c.id}${careIsReady(c, t) ? 1 : 0}`).join("|") +
        `~${ui.pairMother}~${ui.pairFather}~` +
        ranchList().filter(c => canBreed(c, t)).map(c => c.id).join(",");
    case "market":
      return (state.demand ? state.demand.species + state.demand.stat : "") + "~" +
        state.market.refreshAt + "~" + state.market.offers.map(o => o.uid).join(",") + "~" +
        ranchList().map(c => c.id + (creatureInPair(c.id) ? "p" : "")).join(",") + "~" +
        Object.values(state.nets).join(",");
  }
  return "";
}

function render() {
  const t = now();
  document.getElementById("coin-amount").textContent = fmt(state.coins);

  const scroll = $view.scrollTop;
  switch (ui.tab) {
    case "ranch": $view.innerHTML = renderRanch(t); break;
    case "wilds": $view.innerHTML = renderWilds(t); break;
    case "breeding": $view.innerHTML = renderBreeding(t); break;
    case "market": $view.innerHTML = renderMarket(t); break;
  }
  $view.scrollTop = scroll;

  if (ui.tab === "ranch") {
    mountScene("ranch", "ranch");
  } else if (ui.tab === "wilds" && state.biomes.includes(ui.biome)) {
    const w = state.wilds[ui.biome];
    const key = "wilds:" + ui.biome + ":" + (w ? w.refreshAt : 0);
    mountScene(key, ui.biome, () => buildHunts(ui.biome));
  } else {
    sceneDestroy();
  }

  updateBadge(t);
  ui.lastSig = tabSignature(t);
}

function updateBadge(t) {
  const careReady = babies(t).filter(c => careIsReady(c, t)).length;
  const badge = document.getElementById("badge-breeding");
  if (careReady > 0) {
    badge.textContent = careReady;
    badge.classList.add("show");
  } else {
    badge.classList.remove("show");
  }
}

/* Light per-second refresh: update timers in place, re-render only on
 * structural change. */
function tickUpdate() {
  const t = now();
  document.getElementById("coin-amount").textContent = fmt(state.coins);
  updateBadge(t);

  document.querySelectorAll("[data-cd]").forEach(el => {
    el.textContent = (el.dataset.cdp || "") + fmtTime(Number(el.dataset.cd) - t);
  });
  document.querySelectorAll("[data-pg]").forEach(el => {
    const [a, b] = el.dataset.pg.split(",").map(Number);
    el.style.width = Math.min(100, Math.max(0, ((t - a) / (b - a)) * 100)) + "%";
  });
  document.querySelectorAll("[data-mat]").forEach(el => {
    const [a, b] = el.dataset.mat.split(",").map(Number);
    const pct = Math.min(100, Math.floor(((t - a) / (b - a)) * 100));
    el.textContent = (el.dataset.matp || "") + pct + "%";
  });

  sceneSync();

  if (pendingHatches.length && !$modalRoot.childElementCount) showNextHatch();

  if (tabSignature(t) !== ui.lastSig) render();
}

function setTab(tab) {
  ui.tab = tab;
  document.querySelectorAll("#tabbar .tab").forEach(el =>
    el.classList.toggle("active", el.dataset.tab === tab));
  $view.scrollTop = 0;
  render();
}

/* ══ Modals ══ */

function closeModal() {
  if (ui.catch && ui.catch.raf) cancelAnimationFrame(ui.catch.raf);
  ui.catch = null;
  $modalRoot.innerHTML = "";
}

function openModal(innerHTML) {
  $modalRoot.innerHTML = `<div class="modal-overlay" data-action="close-modal">
    <div class="modal" data-stop="1"><div class="modal-grab"></div>${innerHTML}</div>
  </div>`;
}

/* ── Creature detail ── */

function openDetail(id) {
  const t = now();
  const c = state.creatures[id];
  if (!c) return;
  const sp = SPECIES[c.species];
  const v = saleValue(c, t, state.demand);
  const adult = isAdult(c, t);
  const inPair = creatureInPair(c.id);
  const careReady = careIsReady(c, t);
  const maxPts = Math.max(CONFIG.maxWildPointsPerStat, ...STATS.map(s => c.points[s]));

  const statRows = STATS.map(s => {
    const meta = STAT_META[s];
    const pct = Math.min(100, c.points[s] / maxPts * 100);
    const src = c.statSource[s];
    const srcLabel = src === "F" ? "♀" : src === "M" ? "♂" : "•";
    return `<div class="stat-row">
      <span class="stat-ico">${meta.ico}</span>
      <span class="stat-name">${meta.name}</span>
      <div class="stat-bar"><div class="stat-fill" style="width:${pct}%;background:${meta.color}"></div></div>
      <span class="stat-pts">${c.points[s]}</span>
      <span class="stat-src ${src}" title="inherited from">${srcLabel}</span>
      <span class="stat-muta">${c.mutatedStats[s] ? "🧬" + c.mutatedStats[s] : ""}</span>
    </div>`;
  }).join("");

  openModal(`
    <div class="modal-hero">
      <span class="big-emoji bob">${sp.emoji}</span>
      <h2>${esc(c.name)} ${c.sex === "F" ? "♀" : "♂"}</h2>
      <div class="sub">${sp.name} • ${rarityName(c)} • ${c.origin === "bred" ? `Gen ${c.gen}` : c.origin}</div>
      ${regionDotsHTML(c)}
    </div>
    <div class="kv-grid">
      <div class="kv"><div class="k">Level</div><div class="v">${creatureLevel(c)} <span style="color:var(--dim);font-size:11px">(${totalPoints(c)} pts)</span></div></div>
      <div class="kv"><div class="k">Value</div><div class="v" style="color:var(--accent)">🪙 ${fmt(v)}</div></div>
      <div class="kv"><div class="k">Mutations ♀ side</div><div class="v">${c.mutations.maternal}/${CONFIG.mutationCap} ${c.mutations.maternal >= CONFIG.mutationCap ? "❌" : ""}</div></div>
      <div class="kv"><div class="k">Mutations ♂ side</div><div class="v">${c.mutations.paternal}/${CONFIG.mutationCap} ${c.mutations.paternal >= CONFIG.mutationCap ? "❌" : ""}</div></div>
      ${adult ? "" : `<div class="kv"><div class="k">Maturity</div><div class="v" data-mat="${c.bornAt},${c.matureAt}">${Math.floor(maturation(c, t) * 100)}%</div></div>
      <div class="kv"><div class="k">Imprint</div><div class="v">💖 ${Math.round(c.imprint * 100)}%</div></div>`}
    </div>
    <div class="card" style="margin:10px 0">${statRows}
      <div style="font-size:10.5px;color:var(--dim);margin-top:6px">♀/♂ = which parent the stat came from • 🧬 = mutations stacked in this stat's line</div>
    </div>
    ${c.parents ? `<div class="lineage">
      <div class="parent">♀ Mother<b>${esc(c.parents.motherName)}</b></div>
      <div class="parent">♂ Father<b>${esc(c.parents.fatherName)}</b></div>
    </div>` : ""}
    <input class="rename-input" id="rename-input" maxlength="16" value="${esc(c.name)}" placeholder="Name">
    <div class="btn-row">
      <button class="btn ghost" data-action="rename" data-id="${c.id}">✏️ Rename</button>
      ${careReady ? `<button class="btn care-pulse" data-action="care-detail" data-id="${c.id}">🍼 Care!</button>` : ""}
      ${adult && !inPair ? `<button class="btn" data-action="to-breeding" data-id="${c.id}">💞 Breed</button>` : ""}
      ${!inPair ? `<button class="btn red" data-action="sell-confirm" data-id="${c.id}">Sell 🪙 ${fmt(v)}</button>` : ""}
    </div>
  `);
}

/* ── Parent picker ── */

function openParentPicker(role) {
  const t = now();
  const wantSex = role === "mother" ? "F" : "M";
  const otherId = role === "mother" ? ui.pairFather : ui.pairMother;
  const other = otherId ? state.creatures[otherId] : null;
  const candidates = ranchList()
    .filter(c => c.sex === wantSex && canBreed(c, t))
    .filter(c => !other || c.species === other.species)
    .sort((a, b) => creatureLevel(b) - creatureLevel(a));

  let listHTML;
  if (!candidates.length) {
    listHTML = `<div class="empty-hint">No ${wantSex === "F" ? "females" : "males"} ready${other ? ` of species ${SPECIES[other.species].name}` : ""}.<br>
      They must be adult, rested, and not already paired.</div>`;
  } else {
    listHTML = `<div class="picker-list">` + candidates.map(c => {
      const sp = SPECIES[c.species];
      return `<div class="card creature-card ${rarityClass(c)}" data-action="select-parent" data-role="${role}" data-id="${c.id}">
        <div class="creature-emoji">${sp.emoji}</div>
        <div class="creature-info">
          <div class="creature-name-row">
            <span class="creature-name">${esc(c.name)}</span> ${sexHTML(c)}
            <span class="lvl-chip">Lv ${creatureLevel(c)}</span>
            ${totalMutations(c) ? `<span class="muta-chip">🧬${totalMutations(c)}</span>` : ""}
          </div>
          <div class="creature-meta">${sp.name}</div>
          ${statMinisHTML(c)}
        </div>
      </div>`;
    }).join("") + `</div>`;
  }

  openModal(`<h2>Choose ${role === "mother" ? "Female ♀" : "Male ♂"}</h2>
    <div class="sub">Adults that are ready to breed${other ? ` — must be a ${SPECIES[other.species].name}` : ""}.</div>
    ${listHTML}`);
}

/* ── Catch minigame ── */

function openCatch(biomeId, spawnUid) {
  const wild = state.wilds[biomeId];
  const spawn = wild && wild.spawns.find(s => s.uid === spawnUid);
  if (!spawn) { toast("It's gone…", "bad"); return; }
  const c = spawn.creature;
  const sp = SPECIES[c.species];

  let netId = ["mythic", "strong", "basic"].find(n => state.nets[n] > 0);
  if (!netId) {
    toast("You have no nets! Buy some at the Market.", "bad");
    sfxPlay("error");
    return;
  }

  ui.catch = { biomeId, spawnUid, netId, pos: 0, dir: 1, raf: 0, done: false, zoneLeft: 0, zoneW: 0 };

  const netOptions = Object.keys(NETS).map(id => {
    const n = NETS[id];
    return `<button class="net-option ${id === netId ? "selected" : ""}" data-action="pick-net" data-id="${id}" ${state.nets[id] <= 0 ? "disabled" : ""}>
      <span class="n-ico">${n.ico}</span>${n.name}<br><span class="n-count">×${state.nets[id]}</span>
    </button>`;
  }).join("");

  openModal(`
    <h2>Wild ${sp.name} ${c.sex === "F" ? "♀" : "♂"} • Lv ${creatureLevel(c)} <span class="lvl-chip">${rarityName(c)}</span></h2>
    <div class="card" style="margin:8px 0 4px;padding:9px 12px">
      ${statMinisHTML(c)}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
        <span style="font-size:10.5px;color:var(--dim)">❤️ HP • ⚡ Stam • 📦 Weight • ⚔️ Power • 💨 Speed</span>
        ${regionDotsHTML(c)}
      </div>
    </div>
    <div class="catch-arena">
      <span class="catch-creature wiggle" id="catch-creature">${sp.emoji}</span>
      <span class="net-fly" id="net-fly">🕸️</span>
      <div class="catch-bar-wrap">
        <div class="catch-bar" id="catch-bar">
          <div class="catch-zone" id="catch-zone"></div>
          <div class="catch-marker" id="catch-marker"></div>
        </div>
        <div class="catch-hint" id="catch-hint"></div>
      </div>
    </div>
    <div class="net-picker">${netOptions}</div>
    <button class="btn full gold" style="margin-top:14px;font-size:17px;padding:15px" data-action="catch-now">🪤 CATCH!</button>
  `);

  layoutCatchZone();
  runCatchLoop();
}

function layoutCatchZone() {
  const cs = ui.catch;
  if (!cs) return;
  const wild = state.wilds[cs.biomeId];
  const spawn = wild && wild.spawns.find(s => s.uid === cs.spawnUid);
  if (!spawn) return;
  cs.zoneW = catchZoneWidth(spawn.creature, cs.netId);
  cs.zoneLeft = 0.08 + Math.random() * (0.84 - cs.zoneW);
  const zone = document.getElementById("catch-zone");
  zone.style.left = (cs.zoneLeft * 100) + "%";
  zone.style.width = (cs.zoneW * 100) + "%";
  document.getElementById("catch-hint").textContent =
    `${NETS[cs.netId].name} — zone ${(cs.zoneW * 100).toFixed(0)}% wide`;
}

function runCatchLoop() {
  const cs = ui.catch;
  if (!cs) return;
  const wild = state.wilds[cs.biomeId];
  const spawn = wild && wild.spawns.find(s => s.uid === cs.spawnUid);
  if (!spawn) return;
  const speed = catchMarkerSpeed(spawn.creature);
  let last = performance.now();
  const step = (nowMs) => {
    if (!ui.catch || ui.catch.done) return;
    const dt = (nowMs - last) / 1000;
    last = nowMs;
    cs.pos += cs.dir * speed * 2 * dt;
    if (cs.pos >= 1) { cs.pos = 1; cs.dir = -1; }
    if (cs.pos <= 0) { cs.pos = 0; cs.dir = 1; }
    const marker = document.getElementById("catch-marker");
    if (marker) marker.style.left = (cs.pos * 100) + "%";
    cs.raf = requestAnimationFrame(step);
  };
  cs.raf = requestAnimationFrame(step);
}

function resolveCatch() {
  const cs = ui.catch;
  if (!cs || cs.done) return;
  cs.done = true;
  cancelAnimationFrame(cs.raf);

  const hit = cs.pos >= cs.zoneLeft && cs.pos <= cs.zoneLeft + cs.zoneW;
  const res = actionCatchResolve(cs.biomeId, cs.spawnUid, cs.netId, hit);

  if (!res.ok) {
    toast(res.msg, "bad");
    sfxPlay("error");
    closeModal();
    render();
    return;
  }

  // throw the net, then land the result
  const net = document.getElementById("net-fly");
  if (net) net.classList.add("throwing");
  sfxPlay("throwNet");

  setTimeout(() => {
    const creatureEl = document.getElementById("catch-creature");
    const hint = document.getElementById("catch-hint");
    if (!creatureEl) { render(); return; }
    if (net) net.style.opacity = "0";

    if (res.caught) {
      creatureEl.classList.remove("wiggle");
      creatureEl.classList.add("caught");
      if (hint) hint.textContent = "Caught! 🎉";
      sfxPlay("success");
      toast(`Caught ${res.creature.name} the ${SPECIES[res.creature.species].name}! 🎉`, "good");
    } else if (res.fled) {
      creatureEl.classList.remove("wiggle");
      creatureEl.classList.add("fled");
      if (hint) hint.textContent = "It fled! 💨";
      sfxPlay("fail");
      screenShake();
      toast("Missed — it fled! Net lost.", "bad");
    } else {
      creatureEl.classList.remove("wiggle");
      creatureEl.classList.add("dodged");
      if (hint) hint.textContent = "Missed! It's still here…";
      sfxPlay("fail");
      toast("Missed! Net lost — but it stayed.", "bad");
    }
    setTimeout(() => { closeModal(); render(); }, 750);
  }, 320);
}

/* ── Hatch reveal ceremony ── */

function queueHatch(child) {
  pendingHatches.push(child);
  if (!$modalRoot.childElementCount) showNextHatch();
}

function showNextHatch() {
  const child = pendingHatches.shift();
  if (!child) return;
  const sp = SPECIES[child.species];
  const muts = child.newMutations || [];

  openModal(`
    <div id="hatch-wrap">
      <div class="hatch-stage"><span class="hatch-egg">🥚</span></div>
      <h2 style="text-align:center">Something's hatching…</h2>
    </div>
  `);
  sfxPlay("crack");
  buzz([30, 80, 30]);

  setTimeout(() => {
    const wrap = document.getElementById("hatch-wrap");
    if (!wrap) return; // player closed early
    sfxPlay("hatch");
    if (muts.length) setTimeout(() => sfxPlay("mutation"), 400);
    wrap.innerHTML = `
      <div class="hatch-stage">
        <span class="hatch-burst">✨</span>
        <span class="hatch-reveal">${sp.emoji}</span>
      </div>
      <h2 style="text-align:center">${esc(child.name)} hatched! ${child.sex === "F" ? "♀" : "♂"}</h2>
      <div class="sub" style="text-align:center">${sp.name} • Gen ${child.gen} • Lv ${creatureLevel(child)}</div>
      <div style="display:flex;justify-content:center">${regionDotsHTML(child)}</div>
      ${muts.map(m => `<div class="muta-callout">🧬 MUTATION! +${CONFIG.mutationStatBonus} ${STAT_META[m.stat].name}
        <span style="color:var(--dim);font-weight:600">(${m.side === "maternal" ? "♀" : "♂"} side)</span>
        <span class="region-dot mutated" style="display:inline-block;vertical-align:-1px;background:${COLORS[child.colors[m.region]]}"></span></div>`).join("")}
      <div class="btn-row">
        <button class="btn ghost" data-action="detail" data-id="${child.id}">🔍 Details</button>
        <button class="btn gold" data-action="close-modal-btn">Yay! 🎉</button>
      </div>
    `;
  }, 1600);
}

/* ── Help & settings ── */

function openHelp() {
  openModal(`
    <h2>How to Play 📖</h2>
    <div class="help-block"><h3>🐾 Hunting</h3>
      <p>Wild creatures <b>hide</b> in the bushes and rocks of each biome. Watch for
      <b>rustling, footprints and peeking heads</b> — tap a bush to flush its creature into
      the open, then tap the creature to inspect its stats and throw a net.
      Empty hiding spots sometimes hold loose coins.</p></div>
    <div class="help-block"><h3>🪤 Catching</h3>
      <p>Tap CATCH when the marker crosses the green zone. Better nets widen the zone;
      higher-level &amp; rarer creatures have tighter zones and faster markers.
      A revealed creature won't wait around forever — and a missed net may scare it off.</p></div>
    <div class="help-block"><h3>🧬 Breeding &amp; Stats</h3>
      <p>Every creature has points in 5 stats. <b>Total level = 1 + total points.</b>
      A baby inherits each stat separately: <b>55%</b> chance of the higher parent's value.
      Pair two creatures with high points in <i>different</i> stats to combine the best of both lines.</p></div>
    <div class="help-block"><h3>✨ Mutations</h3>
      <p>At birth, each parent's side rolls for mutations: <b>+2 points</b> in a random stat
      plus a vivid new color. Each parent has a mutation counter (♀ side / ♂ side, shown as x/20).
      Once a parent's <b>total</b> counter hits 20, its side can't roll new mutations —
      so keep <b>clean 0/0 breeders</b> to pair against your mutated line. That's the deep game.</p></div>
    <div class="help-block"><h3>🍼 Raising</h3>
      <p>Babies wander your pasture as they grow. When a 🍼 appears over one,
      <b>tap it</b> to feed it — imprint builds up to <b>+50% sale value</b>.
      Sleeping creatures (💤) are recovering from breeding.</p></div>
    <div class="help-block"><h3>🪙 Selling</h3>
      <p>Value scales with rarity, total points, stacked mutations, maturity and imprint.
      Watch the market's <b>Hot right now</b> banner — matching species sell +60%,
      and a featured stat ≥ ${CONFIG.demandStatThreshold} points adds +30%.</p></div>
    <div class="help-block"><h3>🗺️ Progression</h3>
      <p>Unlock richer biomes for higher wild levels and rarer species.
      Your ranch holds ${CONFIG.ranchCap} creatures — cull the weak, sell the strong, keep the perfect.</p></div>
  `);
}

function openSettings() {
  const ty = state.tally;
  openModal(`
    <h2>Settings</h2>
    <div class="kv-grid">
      <div class="kv"><div class="k">Captured</div><div class="v">${ty.captured}</div></div>
      <div class="kv"><div class="k">Bred</div><div class="v">${ty.bred}</div></div>
      <div class="kv"><div class="k">Sold</div><div class="v">${ty.sold}</div></div>
      <div class="kv"><div class="k">Mutations hatched</div><div class="v">${ty.mutationsSeen}</div></div>
      <div class="kv"><div class="k">Lifetime earned</div><div class="v">🪙 ${fmt(ty.earned)}</div></div>
      <div class="kv"><div class="k">Best sale</div><div class="v">🪙 ${fmt(ty.bestSale)}</div></div>
    </div>
    <div class="btn-row">
      <button class="btn ghost" data-action="toggle-sound">${state.sound !== false ? "🔊 Sound: On" : "🔇 Sound: Off"}</button>
      <button class="btn red" data-action="reset-confirm">🗑️ Reset Game</button>
    </div>
  `);
}

/* ══ Event wiring (single delegated handler) ══ */

function handleAction(el) {
  const action = el.dataset.action;
  const id = el.dataset.id;

  switch (action) {
    case "close-modal":
    case "close-modal-btn":
      closeModal();
      return;

    case "detail": sfxPlay("tap"); openDetail(Number(id)); return;

    case "biome":
      sfxPlay("tap");
      ui.biome = id;
      render();
      return;

    case "unlock-biome": {
      const res = actionUnlockBiome(id);
      if (res.ok) { toast(`${BIOMES[id].ico} ${BIOMES[id].name} unlocked!`, "good"); flashCoins(); sfxPlay("unlock"); }
      else { toast(res.msg, "bad"); sfxPlay("error"); }
      render();
      return;
    }

    case "refresh-wilds": {
      const res = actionManualRefreshWilds(ui.biome);
      if (!res.ok) { toast(res.msg, "bad"); sfxPlay("error"); }
      else { flashCoins(); sfxPlay("tap"); }
      render();
      return;
    }

    case "pick-net": {
      if (!ui.catch || ui.catch.done) return;
      if (state.nets[id] <= 0) return;
      sfxPlay("tap");
      ui.catch.netId = id;
      document.querySelectorAll(".net-option").forEach(n =>
        n.classList.toggle("selected", n.dataset.id === id));
      layoutCatchZone();
      return;
    }

    case "catch-now": resolveCatch(); return;

    case "pick-parent": sfxPlay("tap"); openParentPicker(el.dataset.role); return;

    case "select-parent": {
      sfxPlay("tap");
      if (el.dataset.role === "mother") ui.pairMother = Number(id);
      else ui.pairFather = Number(id);
      closeModal();
      setTab("breeding");
      return;
    }

    case "start-pair": {
      const res = actionStartPair(ui.pairMother, ui.pairFather);
      if (res.ok) {
        toast("💞 The courtship begins…", "good");
        sfxPlay("pair");
        ui.pairMother = null;
        ui.pairFather = null;
      } else { toast(res.msg, "bad"); sfxPlay("error"); }
      render();
      return;
    }

    case "care":
    case "care-detail": {
      const res = actionCare(Number(id));
      if (res.ok) {
        toast(`💖 Imprint ${Math.round(res.imprint * 100)}%!`, "good");
        sfxPlay("care");
      }
      if (action === "care-detail") closeModal();
      render();
      return;
    }

    case "to-breeding": {
      const c = state.creatures[Number(id)];
      if (c) {
        if (c.sex === "F") ui.pairMother = c.id; else ui.pairFather = c.id;
        const other = c.sex === "F" ? state.creatures[ui.pairFather] : state.creatures[ui.pairMother];
        if (other && other.species !== c.species) {
          if (c.sex === "F") ui.pairFather = null; else ui.pairMother = null;
        }
      }
      sfxPlay("tap");
      closeModal();
      setTab("breeding");
      return;
    }

    case "rename": {
      const input = document.getElementById("rename-input");
      const res = actionRename(Number(id), input ? input.value : "");
      if (res.ok) { toast("Renamed! ✏️", "good"); sfxPlay("tap"); closeModal(); render(); }
      else { toast(res.msg || "Hmm.", "bad"); sfxPlay("error"); }
      return;
    }

    case "sell":
    case "sell-confirm": {
      const c = state.creatures[Number(id)];
      if (!c) return;
      const v = saleValue(c, now(), state.demand);
      if (!confirm(`Sell ${c.name} (Lv ${creatureLevel(c)}) for 🪙 ${fmt(v)}? This is permanent!`)) return;
      const res = actionSell(Number(id));
      if (res.ok) {
        toast(`Sold for 🪙 ${fmt(res.value)}!`, "good");
        flashCoins();
        sfxPlay("coin");
        if (ui.pairMother === Number(id)) ui.pairMother = null;
        if (ui.pairFather === Number(id)) ui.pairFather = null;
        closeModal();
      } else { toast(res.msg, "bad"); sfxPlay("error"); }
      render();
      return;
    }

    case "buy-offer": {
      const res = actionBuyOffer(id);
      if (res.ok) { toast(`Welcome, ${res.creature.name}! 🎉`, "good"); flashCoins(); sfxPlay("coin"); }
      else { toast(res.msg, "bad"); sfxPlay("error"); }
      render();
      return;
    }

    case "buy-net": {
      const res = actionBuyNet(id);
      if (res.ok) { toast(`${NETS[id].ico} ${NETS[id].name} acquired!`, "good"); flashCoins(); sfxPlay("coin"); }
      else { toast(res.msg, "bad"); sfxPlay("error"); }
      render();
      return;
    }

    case "refresh-market": {
      const res = actionManualRefreshMarket();
      if (!res.ok) { toast(res.msg, "bad"); sfxPlay("error"); }
      else { flashCoins(); sfxPlay("tap"); }
      render();
      return;
    }

    case "toggle-sound":
      state.sound = state.sound === false;
      save();
      sfxPlay("tap");
      openSettings();
      return;

    case "reset-confirm":
      if (confirm("Wipe your save and start over? This cannot be undone!")) {
        closeModal();
        sceneDestroy();
        resetGame();
        ui.pairMother = ui.pairFather = null;
        ui.biome = "meadow";
        setTab("ranch");
        toast("Fresh start! 🌱", "good");
      }
      return;
  }
}

function bindEvents() {
  document.body.addEventListener("click", (e) => {
    // clicks inside the modal body shouldn't trigger the overlay's close action
    let el = e.target;
    let actionEl = null;
    let insideModal = false;
    while (el && el !== document.body) {
      if (el.dataset) {
        if (el.dataset.stop) insideModal = true;
        if (el.dataset.action && !actionEl &&
            !(el.dataset.action === "close-modal" && insideModal)) {
          actionEl = el;
        }
      }
      el = el.parentElement;
    }
    if (actionEl) handleAction(actionEl);
  });

  document.querySelectorAll("#tabbar .tab").forEach(tabEl => {
    tabEl.addEventListener("click", () => { sfxPlay("tap"); setTab(tabEl.dataset.tab); });
  });

  document.getElementById("btn-help").addEventListener("click", () => { sfxPlay("tap"); openHelp(); });
  document.getElementById("btn-settings").addEventListener("click", () => { sfxPlay("tap"); openSettings(); });
}
