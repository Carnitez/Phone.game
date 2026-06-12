/* ── Critter Ranch: Guild tab (expeditions, requests, dex, achievements)
 * Rendering helpers here follow the same conventions as ui.js and are
 * invoked from its render/event plumbing. */

function natureChipHTML(c) {
  const n = NATURES[c.nature] || NATURES.docile;
  return `<span class="nature-chip" title="${n.desc}">${n.ico} ${n.name}</span>`;
}

function statReqLabel(stat, threshold) {
  return `${STAT_META[stat].ico} ${STAT_META[stat].name} ≥ ${threshold}`;
}

/* ══ GUILD TAB ══ */

function renderGuild(t) {
  let html = `<div class="view-title">Adventurers' Guild</div>
    <div class="view-sub">Put your bloodlines to work — jobs for stats, gold for genes.</div>`;

  // ── Active expeditions ──
  if (state.expeditions.active.length) {
    html += `<div class="section-head"><h3>Out in the Field</h3></div>`;
    html += state.expeditions.active.map(ex => {
      const team = ex.creatureIds.map(id => state.creatures[id]).filter(Boolean);
      const pct = Math.min(100, ((t - ex.startedAt) / (ex.doneAt - ex.startedAt)) * 100);
      return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:800;font-size:14px">${ex.siteIco} ${ex.siteName}</span>
          <span style="font-size:13px">${team.map(c => SPECIES[c.species].emoji).join("")}
            <span style="color:var(--dim);font-size:11px">${Math.round(ex.chance * 100)}%</span></span>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" data-pg="${ex.startedAt},${ex.doneAt}" style="width:${pct}%"></div></div>
          <div class="progress-label"><span>🪙 ${fmt(ex.reward)} on success</span><span data-cd="${ex.doneAt}">${fmtTime(ex.doneAt - t)}</span></div>
        </div>
      </div>`;
    }).join("");
  }

  // ── Expedition sites ──
  html += `<div class="section-head"><h3>🧭 Expeditions</h3>
    <span style="font-size:12px;color:var(--dim)" data-cd="${state.expeditions.refreshAt}" data-cdp="new jobs ">new jobs ${fmtTime(state.expeditions.refreshAt - t)}</span></div>`;
  html += state.expeditions.sites.map(site => `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div>
        <div style="font-weight:800;font-size:14.5px">${site.ico} ${site.name}</div>
        <div style="font-size:12px;color:var(--dim);margin:2px 0 5px">${site.flavor}</div>
        <div style="font-size:12px">
          <span class="req-chip">${STAT_META[site.primary].ico} ${STAT_META[site.primary].name} ×2</span>
          <span class="req-chip">${STAT_META[site.secondary].ico} ${STAT_META[site.secondary].name}</span>
          <span class="req-chip">🎯 ${site.target}</span>
          <span class="req-chip">⏱️ ${fmtTime(site.duration)}</span>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="price">🪙 ${fmt(site.reward)}</div>
        <button class="btn small gold" style="margin-top:7px" data-action="team-pick" data-id="${site.uid}">Send team</button>
      </div>
    </div>
  </div>`).join("");

  // ── Request board ──
  html += `<div class="section-head"><h3>📜 Breeding Requests</h3></div>`;
  html += state.requests.map(req => {
    const sp = SPECIES[req.species];
    const matches = ranchList().filter(c => requestMatches(req, c, t) && !c.locked);
    return `<div class="card ${matches.length ? "req-ready" : ""}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div style="font-weight:800;font-size:14.5px">${sp.emoji} ${sp.name} wanted</div>
          <div style="font-size:12px;margin:5px 0">
            <span class="req-chip">${statReqLabel(req.stat, req.threshold)}</span>
            ${req.sex ? `<span class="req-chip">${req.sex === "F" ? "♀ female" : "♂ male"}</span>` : ""}
            ${req.minMutations ? `<span class="req-chip">🧬 ≥ ${req.minMutations}</span>` : ""}
            ${req.nature ? `<span class="req-chip">${NATURES[req.nature].ico} ${NATURES[req.nature].name}</span>` : ""}
          </div>
          <div style="font-size:11px;color:var(--dim)" data-cd="${req.expiresAt}" data-cdp="expires in ">expires in ${fmtTime(req.expiresAt - t)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="price">🪙 ${fmt(req.reward)}</div>
          <button class="btn small ${matches.length ? "green" : "ghost"}" style="margin-top:7px"
            data-action="fulfill-pick" data-id="${req.id}" ${matches.length ? "" : "disabled"}>
            ${matches.length ? `Deliver (${matches.length})` : "No match yet"}</button>
        </div>
      </div>
    </div>`;
  }).join("");

  // ── Collection ──
  const dexCount = Object.keys(state.dex).length;
  const speciesCount = Object.keys(SPECIES).length;
  const achDone = Object.keys(state.achievements).length;
  html += `<div class="section-head"><h3>Collection</h3></div>
    <div class="shop-grid">
      <button class="shop-item" data-action="open-dex" style="cursor:pointer">
        <div class="s-ico">📖</div>
        <div class="s-name">Critterdex</div>
        <div class="s-desc">${dexCount}/${speciesCount} species discovered</div>
        <div class="progress-bar" style="margin-top:6px"><div class="progress-fill" style="width:${dexCount / speciesCount * 100}%"></div></div>
      </button>
      <button class="shop-item" data-action="open-achievements" style="cursor:pointer">
        <div class="s-ico">🏆</div>
        <div class="s-name">Achievements</div>
        <div class="s-desc">${achDone}/${ACHIEVEMENTS.length} earned</div>
        <div class="progress-bar" style="margin-top:6px"><div class="progress-fill" style="width:${achDone / ACHIEVEMENTS.length * 100}%"></div></div>
      </button>
    </div>`;
  return html;
}

/* ══ Critterdex ══ */

function openDex() {
  const speciesIds = Object.keys(SPECIES).sort((a, b) =>
    RARITIES[SPECIES[a].rarity].order - RARITIES[SPECIES[b].rarity].order);
  const cells = speciesIds.map(id => {
    const sp = SPECIES[id];
    const d = state.dex[id];
    if (!d) {
      return `<div class="dex-cell unknown">
        <span class="dex-emoji">${sp.emoji}</span>
        <span class="dex-name">???</span>
        <span class="dex-sub">${BIOMES[sp.biome].ico} ${RARITIES[sp.rarity].name}</span>
      </div>`;
    }
    return `<div class="dex-cell r-${sp.rarity}">
      <span class="dex-emoji">${sp.emoji}${d.shinies ? "✨" : ""}</span>
      <span class="dex-name">${sp.name}</span>
      <span class="dex-sub">best Lv ${d.bestLevel}</span>
      <span class="dex-sub">🪤${d.captured} 🐣${d.bred} 🤝${d.sold}</span>
    </div>`;
  }).join("");
  openModal(`<h2>📖 Critterdex</h2>
    <div class="sub">${Object.keys(state.dex).length}/${Object.keys(SPECIES).length} discovered — own one to log it.</div>
    <div class="dex-grid">${cells}</div>`);
}

/* ══ Achievements ══ */

function openAchievements() {
  const rows = ACHIEVEMENTS.map(a => {
    const got = !!state.achievements[a.id];
    return `<div class="ach-row ${got ? "got" : ""}">
      <span class="ach-ico">${got ? a.ico : "🔒"}</span>
      <span class="ach-text"><b>${a.name}</b><br><span>${a.desc}</span></span>
      <span class="ach-reward">🪙 ${fmt(a.reward)}</span>
    </div>`;
  }).join("");
  openModal(`<h2>🏆 Achievements</h2>
    <div class="sub">${Object.keys(state.achievements).length}/${ACHIEVEMENTS.length} earned — rewards are granted automatically.</div>
    <div class="picker-list">${rows}</div>`);
}

/* ══ Expedition team picker ══ */

function openTeamPicker(siteUid) {
  const t = now();
  const site = state.expeditions.sites.find(s => s.uid === siteUid);
  if (!site) return;
  if (!ui.team || ui.team.siteUid !== siteUid) ui.team = { siteUid, sel: [] };
  // drop selections that became invalid
  ui.team.sel = ui.team.sel.filter(id => {
    const c = state.creatures[id];
    return c && isAdult(c, t) && !creatureBusy(id) && c.cooldownUntil <= t;
  });

  const candidates = ranchList()
    .filter(c => isAdult(c, t) && !creatureBusy(c.id) && c.cooldownUntil <= t)
    .sort((a, b) =>
      (b.points[site.primary] * 2 + b.points[site.secondary]) -
      (a.points[site.primary] * 2 + a.points[site.secondary]));

  const team = ui.team.sel.map(id => state.creatures[id]);
  const score = expeditionScore(team, site);
  const pct = team.length ? Math.round(expeditionChance(team, site) * 100) : 0;

  const listHTML = candidates.length ? candidates.map(c => {
    const sp = SPECIES[c.species];
    const selected = ui.team.sel.includes(c.id);
    const contrib = c.points[site.primary] * 2 + c.points[site.secondary];
    return `<div class="card creature-card ${rarityClass(c)} ${selected ? "team-selected" : ""}" data-action="team-toggle" data-id="${c.id}">
      <div class="creature-emoji">${sp.emoji}</div>
      <div class="creature-info">
        <div class="creature-name-row">
          <span class="creature-name">${c.shiny ? "✨" : ""}${esc(c.name)}</span> ${sexHTML(c)}
          <span class="lvl-chip">Lv ${creatureLevel(c)}</span>
          ${natureChipHTML(c)}
        </div>
        <div class="creature-meta">${STAT_META[site.primary].ico} ${c.points[site.primary]} • ${STAT_META[site.secondary].ico} ${c.points[site.secondary]} → +${contrib}</div>
      </div>
      <div class="creature-side"><span style="font-size:20px">${selected ? "✅" : "⬜"}</span></div>
    </div>`;
  }).join("") : `<div class="empty-hint">No one's available — adults only, rested, not breeding or already deployed.</div>`;

  openModal(`<h2>${site.ico} ${site.name}</h2>
    <div class="sub">${site.flavor}<br>Needs ${STAT_META[site.primary].name} ×2 + ${STAT_META[site.secondary].name} • pick up to ${CONFIG.expedMaxTeam}.</div>
    <div class="card" style="display:flex;justify-content:space-around;text-align:center;padding:9px">
      <div><div class="k" style="font-size:10px;color:var(--dim)">TEAM SCORE</div><div style="font-weight:800">${score}</div></div>
      <div><div class="k" style="font-size:10px;color:var(--dim)">TARGET</div><div style="font-weight:800">${site.target}</div></div>
      <div><div class="k" style="font-size:10px;color:var(--dim)">SUCCESS</div><div style="font-weight:800;color:${pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--accent)" : "var(--red)"}">${pct}%</div></div>
      <div><div class="k" style="font-size:10px;color:var(--dim)">REWARD</div><div style="font-weight:800;color:var(--accent)">🪙 ${fmt(site.reward)}</div></div>
    </div>
    <div class="picker-list">${listHTML}</div>
    <button class="btn full gold" style="margin-top:12px" data-action="team-launch" data-id="${siteUid}" ${team.length ? "" : "disabled"}>
      🧭 Launch (${team.length}/${CONFIG.expedMaxTeam})</button>`);
}

/* ══ Request fulfillment picker ══ */

function openFulfillPicker(reqId) {
  const t = now();
  const req = state.requests.find(r => r.id === reqId);
  if (!req) return;
  const sp = SPECIES[req.species];
  const matches = ranchList().filter(c => requestMatches(req, c, t) && !c.locked)
    .sort((a, b) => saleValue(a, t, state.demand) - saleValue(b, t, state.demand));

  const listHTML = matches.map(c => {
    const market = saleValue(c, t, state.demand);
    return `<div class="card creature-card ${rarityClass(c)}" data-action="fulfill-confirm" data-id="${c.id}" data-req="${req.id}">
      <div class="creature-emoji">${SPECIES[c.species].emoji}</div>
      <div class="creature-info">
        <div class="creature-name-row">
          <span class="creature-name">${c.shiny ? "✨" : ""}${esc(c.name)}</span> ${sexHTML(c)}
          <span class="lvl-chip">Lv ${creatureLevel(c)}</span>
          ${totalMutations(c) ? `<span class="muta-chip">🧬${totalMutations(c)}</span>` : ""}
        </div>
        <div class="creature-meta">${STAT_META[req.stat].ico} ${c.points[req.stat]} pts • market 🪙 ${fmt(market)}</div>
      </div>
      <div class="creature-side"><span class="price">🪙 ${fmt(req.reward)}</span></div>
    </div>`;
  }).join("");

  openModal(`<h2>📜 Deliver: ${sp.emoji} ${sp.name}</h2>
    <div class="sub">Requirement: ${statReqLabel(req.stat, req.threshold)}${req.sex ? ` • ${req.sex === "F" ? "♀" : "♂"}` : ""}${req.minMutations ? ` • 🧬≥${req.minMutations}` : ""}${req.nature ? ` • ${NATURES[req.nature].name}` : ""}
    — pays <b style="color:var(--accent)">🪙 ${fmt(req.reward)}</b>. The creature is handed over for good!</div>
    <div class="picker-list">${listHTML}</div>`);
}

/* ══ Family tree ══ */

function treeNodeHTML(c, fallbackName, sexMark, depth) {
  if (c) {
    const sp = SPECIES[c.species];
    return `<div class="tree-node" style="margin-left:${depth * 16}px" data-action="${depth ? "detail" : ""}" data-id="${c.id}">
      ${sexMark} ${sp.emoji} <b>${c.shiny ? "✨" : ""}${esc(c.name)}</b>
      <span class="lvl-chip">Lv ${creatureLevel(c)}</span>
      ${totalMutations(c) ? `<span class="muta-chip">🧬${c.mutations.maternal}/${c.mutations.paternal}</span>` : ""}
    </div>`;
  }
  if (fallbackName) {
    return `<div class="tree-node gone" style="margin-left:${depth * 16}px">${sexMark} <b>${esc(fallbackName)}</b> <span style="font-size:10.5px">(no longer at the ranch)</span></div>`;
  }
  return `<div class="tree-node gone" style="margin-left:${depth * 16}px">${sexMark} <span style="font-size:11px">wild / unknown</span></div>`;
}

function openTree(id) {
  const c = state.creatures[id];
  if (!c) return;
  let html = treeNodeHTML(c, null, c.sex === "F" ? "♀" : "♂", 0);
  const addParents = (cc, depth) => {
    if (!cc || !cc.parents) {
      if (depth === 1) html += treeNodeHTML(null, null, "•", depth);
      return;
    }
    const mom = state.creatures[cc.parents.motherId];
    const dad = state.creatures[cc.parents.fatherId];
    html += treeNodeHTML(mom, cc.parents.motherName, "♀", depth);
    if (depth < 2) addParents(mom, depth + 1);
    html += treeNodeHTML(dad, cc.parents.fatherName, "♂", depth);
    if (depth < 2) addParents(dad, depth + 1);
  };
  if (c.parents) addParents(c, 1);
  else html += `<div class="tree-node gone" style="margin-left:16px">• wild-born — no recorded lineage</div>`;

  openModal(`<h2>🌳 Lineage of ${esc(c.name)}</h2>
    <div class="sub">Gen ${c.gen} • mutation counters ♀${c.mutations.maternal}/${CONFIG.mutationCap} ♂${c.mutations.paternal}/${CONFIG.mutationCap}</div>
    ${html}`);
}
