/* ── Critter Ranch: game state, actions & simulation ───────── */

const SAVE_KEY = "critter-ranch-save-v1";

let state = null;

function now() { return Date.now() / 1000; }

/* ── State bootstrap ── */

function newGame() {
  const t = now();
  state = {
    version: 1,
    sound: true,
    coins: CONFIG.startCoins,
    nextId: 1,
    creatures: {},
    nets: { basic: CONFIG.startNets, strong: 0, mythic: 0 },
    biomes: ["meadow"],
    wilds: {},      // biomeId -> { spawns: [], refreshAt }
    market: { offers: [], refreshAt: 0 },
    demand: null,   // { species, stat, until }
    pairs: [],      // { id, motherId, fatherId, stage: 'mating'|'egg', doneAt, total }
    requests: [],   // breeding request board
    expeditions: { active: [], sites: [], refreshAt: 0 },
    dex: {},        // speciesId -> { captured, bred, bought, sold, bestLevel, shinies }
    achievements: {},
    lastDaily: new Date().toISOString().slice(0, 10),
    trader: null,
    tally: { captured: 0, bred: 0, sold: 0, earned: 0, bestSale: 0, mutationsSeen: 0,
             requestsDone: 0, expeditions: 0, expeditionsWon: 0 },
  };

  // Starter pair so breeding is teachable from minute one.
  const mom = makeCreature("fluffit", 18, { sex: "F", origin: "starter", name: "Clover", nature: "gentle", shiny: false });
  const dad = makeCreature("fluffit", 16, { sex: "M", origin: "starter", name: "Biscuit", nature: "docile", shiny: false });
  adoptCreature(mom, t);
  adoptCreature(dad, t);

  rotateDemand(t);
  refreshWilds("meadow", t);
  refreshMarket(t);
  refreshRequests(t);
  generateExpedSites(t);
  generateTrader(state.lastDaily, t);
  save();
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) { /* storage full / private mode — play on without persistence */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return false;
    state = data;
    migrate();
    return true;
  } catch (e) {
    return false;
  }
}

/* Upgrade older saves in place: fill in fields added after launch. */
function migrate() {
  if (typeof state.sound === "undefined") state.sound = true;
  if (!state.requests) state.requests = [];
  if (!state.expeditions) state.expeditions = { active: [], sites: [], refreshAt: 0 };
  if (!state.achievements) state.achievements = {};
  if (!state.lastDaily) state.lastDaily = "";
  if (!state.trader) state.trader = null;
  const ty = state.tally;
  ty.requestsDone = ty.requestsDone || 0;
  ty.expeditions = ty.expeditions || 0;
  ty.expeditionsWon = ty.expeditionsWon || 0;
  for (const c of Object.values(state.creatures)) ensureCreatureDefaults(c);
  if (!state.dex) {
    state.dex = {};
    for (const c of Object.values(state.creatures)) dexRecord(c);
  }
  // older wild spawns / market offers lack natures — regenerate on next tick
  if (Object.values(state.wilds).some(w => w.spawns.some(s => !s.creature.nature))) state.wilds = {};
  if (state.market.offers.some(o => !o.creature.nature)) state.market.refreshAt = 0;
}

function ensureCreatureDefaults(c) {
  if (!c.nature) c.nature = pick(Object.keys(NATURES));
  if (typeof c.shiny === "undefined") c.shiny = false;
  if (typeof c.locked === "undefined") c.locked = false;
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  newGame();
}

function adoptCreature(creature, t) {
  creature.id = state.nextId++;
  if (!creature.bornAt) creature.bornAt = t;
  state.creatures[creature.id] = creature;
  dexRecord(creature);
  return creature;
}

/* ── Critterdex ── */

function dexEntry(speciesId) {
  if (!state.dex[speciesId]) {
    state.dex[speciesId] = { captured: 0, bred: 0, bought: 0, sold: 0, bestLevel: 0, shinies: 0 };
  }
  return state.dex[speciesId];
}

function dexRecord(c) {
  const d = dexEntry(c.species);
  if (c.origin === "wild") d.captured++;
  else if (c.origin === "bred") d.bred++;
  else d.bought++;
  d.bestLevel = Math.max(d.bestLevel, creatureLevel(c));
  if (c.shiny) d.shinies++;
}

/* ── Derived queries ── */

function ranchList() {
  return Object.values(state.creatures);
}

function ranchCount() {
  return Object.keys(state.creatures).length;
}

function creatureInPair(id) {
  return state.pairs.some(p => p.motherId === id || p.fatherId === id);
}

function onExpedition(id) {
  return state.expeditions.active.some(e => e.creatureIds.includes(id));
}

function creatureBusy(id) {
  return creatureInPair(id) || onExpedition(id);
}

function canBreed(c, t) {
  return isAdult(c, t) && c.cooldownUntil <= t && !creatureBusy(c.id);
}

function babies(t) {
  return ranchList().filter(c => !isAdult(c, t));
}

/* ── Demand / market / wilds rotation ── */

function rotateDemand(t) {
  state.demand = {
    species: pick(Object.keys(SPECIES)),
    stat: pick(STATS),
    until: t + CONFIG.demandRotate,
  };
}

function refreshWilds(biomeId, t) {
  const biome = BIOMES[biomeId];
  const spawns = [];
  for (let i = 0; i < biome.spawns; i++) spawns.push(makeWildSpawn(biomeId));
  state.wilds[biomeId] = { spawns, refreshAt: t + CONFIG.wildRefresh };
}

function refreshMarket(t) {
  const offers = [];
  const unlockedSpecies = Object.keys(SPECIES).filter(id =>
    state.biomes.includes(SPECIES[id].biome));
  // One offer can tease the next locked tier, to whet the appetite.
  const allSpecies = Object.keys(SPECIES);
  for (let i = 0; i < 4; i++) {
    const pool = (i === 3 && unlockedSpecies.length < allSpecies.length)
      ? allSpecies : unlockedSpecies;
    const speciesId = pick(pool);
    const biome = BIOMES[SPECIES[speciesId].biome];
    const [lo, hi] = biome.levels;
    const level = lo + Math.floor(Math.random() * (hi - lo + 1));
    const c = makeCreature(speciesId, level, { origin: "bought" });
    offers.push({
      uid: Math.random().toString(36).slice(2),
      creature: c,
      price: Math.round(saleValue(c, now(), null) * CONFIG.offerMarkup),
    });
  }
  state.market = { offers, refreshAt: t + CONFIG.marketRefresh };
}

/* ── Breeding requests ── */

function generateRequest(t) {
  const speciesId = pick(Object.keys(SPECIES).filter(id => state.biomes.includes(SPECIES[id].biome)));
  const sp = SPECIES[speciesId];
  const biome = BIOMES[sp.biome];
  const stat = pick(STATS);
  const threshold = Math.round(biome.levels[1] * (0.3 + Math.random() * 0.25));
  const req = {
    id: "rq" + (state.nextId++),
    species: speciesId, stat, threshold,
    sex: null, minMutations: 0, nature: null,
    expiresAt: t + CONFIG.requestLifetime,
  };
  let bonus = 1;
  if (Math.random() < 0.3) { req.sex = chance(0.5) ? "F" : "M"; bonus += 0.4; }
  if (Math.random() < 0.25) { req.minMutations = 1 + rand(3); bonus += 0.5 * req.minMutations; }
  else if (Math.random() < 0.15) { req.nature = pick(Object.keys(NATURES)); bonus += 0.6; }
  req.reward = Math.round(sp.basePrice * RARITIES[sp.rarity].mult *
    (1 + threshold * 5 * CONFIG.pointValue) * CONFIG.requestRewardMult * bonus);
  return req;
}

function refreshRequests(t) {
  state.requests = state.requests.filter(r => r.expiresAt > t);
  while (state.requests.length < CONFIG.requestCount) state.requests.push(generateRequest(t));
}

function requestMatches(req, c, t) {
  return c.species === req.species &&
    isAdult(c, t) &&
    c.points[req.stat] >= req.threshold &&
    (!req.sex || c.sex === req.sex) &&
    totalMutations(c) >= req.minMutations &&
    (!req.nature || c.nature === req.nature) &&
    !creatureBusy(c.id);
}

function actionFulfillRequest(reqId, creatureId) {
  const t = now();
  const req = state.requests.find(r => r.id === reqId);
  const c = state.creatures[creatureId];
  if (!req || !c) return { ok: false, msg: "Too late — that's gone." };
  if (c.locked) return { ok: false, msg: `${c.name} is protected.` };
  if (!requestMatches(req, c, t)) return { ok: false, msg: `${c.name} doesn't meet the requirements.` };
  delete state.creatures[creatureId];
  state.coins += req.reward;
  state.tally.requestsDone++;
  state.tally.earned += req.reward;
  if (req.reward > state.tally.bestSale) state.tally.bestSale = req.reward;
  dexEntry(c.species).sold++;
  state.requests = state.requests.filter(r => r.id !== reqId);
  refreshRequests(t);
  save();
  return { ok: true, reward: req.reward };
}

/* ── Expeditions ── */

function biomeProgress() {
  return state.biomes.length; // 1..5
}

function generateExpedSites(t) {
  const prog = biomeProgress();
  const pool = [...EXPED_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 3);
  state.expeditions.sites = pool.map((tpl, i) => {
    const d = prog * (0.7 + i * 0.45);
    const target = Math.round(30 + 38 * d + Math.random() * 15);
    return {
      uid: Math.random().toString(36).slice(2),
      name: tpl.name, ico: tpl.ico, flavor: tpl.flavor,
      primary: tpl.primary, secondary: tpl.secondary,
      duration: [75, 150, 240][i],
      target,
      reward: Math.round(target * 2.4 * (1 + i * 0.15)),
    };
  });
  state.expeditions.refreshAt = t + CONFIG.expedSiteRefresh;
}

function actionStartExpedition(siteUid, creatureIds) {
  const t = now();
  const site = state.expeditions.sites.find(s => s.uid === siteUid);
  if (!site) return { ok: false, msg: "That job was taken." };
  if (!creatureIds.length || creatureIds.length > CONFIG.expedMaxTeam) {
    return { ok: false, msg: `Pick 1–${CONFIG.expedMaxTeam} creatures.` };
  }
  const team = creatureIds.map(id => state.creatures[id]);
  for (const c of team) {
    if (!c) return { ok: false, msg: "Creature missing." };
    if (!isAdult(c, t)) return { ok: false, msg: `${c.name} is too young.` };
    if (creatureBusy(c.id)) return { ok: false, msg: `${c.name} is busy.` };
    if (c.cooldownUntil > t) return { ok: false, msg: `${c.name} needs rest first.` };
  }
  state.expeditions.active.push({
    id: state.nextId++,
    siteName: site.name, siteIco: site.ico,
    creatureIds: [...creatureIds],
    startedAt: t,
    doneAt: t + site.duration,
    chance: expeditionChance(team, site),
    reward: site.reward,
  });
  save();
  return { ok: true };
}

function resolveExpedition(ex, t, events) {
  state.expeditions.active = state.expeditions.active.filter(e => e.id !== ex.id);
  const team = ex.creatureIds.map(id => state.creatures[id]).filter(Boolean);
  const success = Math.random() < ex.chance;
  const coins = success ? ex.reward : Math.round(ex.reward * CONFIG.expedFailRewardFrac);
  state.coins += coins;
  state.tally.earned += coins;
  state.tally.expeditions++;
  let net = null;
  if (success) {
    state.tally.expeditionsWon++;
    if (chance(CONFIG.expedNetChance)) {
      net = pick(["basic", "basic", "strong"]);
      state.nets[net]++;
    }
  } else {
    for (const c of team) {
      if (c.nature !== "hardy") c.cooldownUntil = Math.max(c.cooldownUntil, t + CONFIG.expedFatigue);
    }
  }
  events.push({ type: "expedition", success, coins, net, site: ex.siteName, ico: ex.siteIco });
}

/* ── Daily login & traveling trader ── */

function generateTrader(day, t) {
  const all = Object.keys(SPECIES);
  const unlocked = all.filter(id => state.biomes.includes(SPECIES[id].biome));
  const speciesId = Math.random() < 0.2 ? pick(all) : pick(unlocked);
  const biome = BIOMES[SPECIES[speciesId].biome];
  const level = biome.levels[1] + rand(16); // an exceptional specimen
  const c = makeCreature(speciesId, level, { origin: "bought" });
  if (Math.random() < CONFIG.traderShinyChance) c.shiny = true;
  state.trader = {
    day, purchased: false,
    creature: c,
    price: Math.round(saleValue(c, t, null) * CONFIG.traderMarkup),
  };
}

function actionBuyTrader() {
  const t = now();
  const tr = state.trader;
  if (!tr || tr.purchased) return { ok: false, msg: "The trader has nothing left." };
  if (state.coins < tr.price) return { ok: false, msg: "Not enough coins." };
  if (ranchCount() >= CONFIG.ranchCap) return { ok: false, msg: "Ranch is full." };
  state.coins -= tr.price;
  tr.purchased = true;
  const c = adoptCreature(tr.creature, t);
  save();
  return { ok: true, creature: c };
}

/* ── Achievements (auto-granted) ── */

function checkAchievements(events) {
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.check(); } catch (e) { /* a check can never break the game */ }
    if (ok) {
      state.achievements[a.id] = true;
      state.coins += a.reward;
      events.push({ type: "achievement", achievement: a });
    }
  }
}

/* ── Tick: advance all timed systems. Returns events for the UI. ── */

function tick() {
  const t = now();
  const events = [];

  if (!state.demand || state.demand.until <= t) rotateDemand(t);

  for (const biomeId of state.biomes) {
    if (!state.wilds[biomeId] || state.wilds[biomeId].refreshAt <= t) {
      refreshWilds(biomeId, t);
      events.push({ type: "wilds", biomeId });
    }
  }

  if (!state.market.refreshAt || state.market.refreshAt <= t) {
    refreshMarket(t);
    events.push({ type: "market" });
  }

  refreshRequests(t);

  if (!state.expeditions.refreshAt || state.expeditions.refreshAt <= t) {
    generateExpedSites(t);
  }
  for (const ex of [...state.expeditions.active]) {
    if (ex.doneAt <= t) resolveExpedition(ex, t, events);
  }

  const day = new Date().toISOString().slice(0, 10);
  if (state.lastDaily !== day) {
    state.lastDaily = day;
    const coins = CONFIG.dailyCoinsBase + (biomeProgress() - 1) * 100;
    state.coins += coins;
    state.nets.basic += 1;
    generateTrader(day, t);
    events.push({ type: "daily", coins });
  }
  if (!state.trader) generateTrader(day, t);

  // Pair progression: mating → egg → hatch
  for (const pair of [...state.pairs]) {
    if (pair.doneAt > t) continue;
    if (pair.stage === "mating") {
      const mother = state.creatures[pair.motherId];
      const rOrder = rarityOrder(mother.species);
      pair.stage = "egg";
      pair.startedAt = t;
      pair.total = TIMING.egg[rOrder];
      pair.doneAt = t + pair.total;
      events.push({ type: "egg", pair });
    } else if (pair.stage === "egg") {
      hatchPair(pair, t, events);
    }
  }

  checkAchievements(events);

  save();
  return events;
}

function hatchPair(pair, t, events) {
  const mother = state.creatures[pair.motherId];
  const father = state.creatures[pair.fatherId];
  state.pairs = state.pairs.filter(p => p.id !== pair.id);
  if (!mother || !father) return;

  const rOrder = rarityOrder(mother.species);
  const child = breedChild(mother, father);
  child.bornAt = t;
  child.matureAt = t + TIMING.mature[rOrder];
  child.nextCareAt = t + TIMING.mature[rOrder] / CONFIG.careCount;
  adoptCreature(child, t);

  mother.cooldownUntil = t + TIMING.cooldownF[rOrder] *
    (mother.nature === "fertile" ? CONFIG.fertileCooldownMult : 1);
  father.cooldownUntil = t + TIMING.cooldownM[rOrder] *
    (father.nature === "fertile" ? CONFIG.fertileCooldownMult : 1);

  state.tally.bred++;
  state.tally.mutationsSeen += (child.newMutations || []).length;
  events.push({ type: "hatch", child });
}

/* ── Player actions (each returns {ok, msg?} ) ── */

function actionStartPair(motherId, fatherId) {
  const t = now();
  const mother = state.creatures[motherId];
  const father = state.creatures[fatherId];
  if (!mother || !father) return { ok: false, msg: "Creature missing." };
  if (mother.species !== father.species) return { ok: false, msg: "Different species can't pair." };
  if (mother.sex !== "F" || father.sex !== "M") return { ok: false, msg: "Need one female and one male." };
  if (!canBreed(mother, t)) return { ok: false, msg: `${mother.name} isn't ready.` };
  if (!canBreed(father, t)) return { ok: false, msg: `${father.name} isn't ready.` };
  if (ranchCount() >= CONFIG.ranchCap) return { ok: false, msg: "Ranch is full — sell something first." };

  const rOrder = rarityOrder(mother.species);
  state.pairs.push({
    id: state.nextId++,
    motherId, fatherId,
    stage: "mating",
    startedAt: t,
    total: TIMING.mating[rOrder],
    doneAt: t + TIMING.mating[rOrder],
  });
  save();
  return { ok: true };
}

function actionSell(creatureId) {
  const t = now();
  const c = state.creatures[creatureId];
  if (!c) return { ok: false, msg: "Already gone." };
  if (c.locked) return { ok: false, msg: `${c.name} is protected — remove the ⭐ first.` };
  if (creatureBusy(creatureId)) return { ok: false, msg: "Can't sell while breeding or on expedition." };
  const value = saleValue(c, t, state.demand);
  delete state.creatures[creatureId];
  state.coins += value;
  state.tally.sold++;
  state.tally.earned += value;
  if (value > state.tally.bestSale) state.tally.bestSale = value;
  dexEntry(c.species).sold++;
  save();
  return { ok: true, value };
}

function actionToggleLock(creatureId) {
  const c = state.creatures[creatureId];
  if (!c) return { ok: false };
  c.locked = !c.locked;
  save();
  return { ok: true, locked: c.locked };
}

function actionBuyOffer(uid) {
  const t = now();
  const idx = state.market.offers.findIndex(o => o.uid === uid);
  if (idx === -1) return { ok: false, msg: "Offer gone." };
  const offer = state.market.offers[idx];
  if (state.coins < offer.price) return { ok: false, msg: "Not enough coins." };
  if (ranchCount() >= CONFIG.ranchCap) return { ok: false, msg: "Ranch is full." };
  state.coins -= offer.price;
  state.market.offers.splice(idx, 1);
  const c = adoptCreature(offer.creature, t);
  save();
  return { ok: true, creature: c };
}

function actionBuyNet(netId) {
  const net = NETS[netId];
  if (state.coins < net.cost) return { ok: false, msg: "Not enough coins." };
  state.coins -= net.cost;
  state.nets[netId]++;
  save();
  return { ok: true };
}

function actionUnlockBiome(biomeId) {
  const biome = BIOMES[biomeId];
  if (state.biomes.includes(biomeId)) return { ok: false, msg: "Already unlocked." };
  if (state.coins < biome.cost) return { ok: false, msg: "Not enough coins." };
  state.coins -= biome.cost;
  state.biomes.push(biomeId);
  refreshWilds(biomeId, now());
  save();
  return { ok: true };
}

/* Resolve one catch attempt. hit = marker landed in the zone. */
function actionCatchResolve(biomeId, spawnUid, netId, hit) {
  const t = now();
  const wild = state.wilds[biomeId];
  if (!wild) return { ok: false, msg: "They moved on." };
  const idx = wild.spawns.findIndex(s => s.uid === spawnUid);
  if (idx === -1) return { ok: false, msg: "It's gone." };
  if (state.nets[netId] <= 0) return { ok: false, msg: "No nets left." };

  state.nets[netId]--;

  if (hit) {
    if (ranchCount() >= CONFIG.ranchCap) {
      // net is spent, but don't lose the creature silently
      state.nets[netId]++;
      return { ok: false, msg: "Ranch is full — sell something first." };
    }
    const spawn = wild.spawns.splice(idx, 1)[0];
    const c = adoptCreature(spawn.creature, t);
    state.tally.captured++;
    save();
    return { ok: true, caught: true, creature: c };
  }

  let fled = false;
  if (chance(CONFIG.fleeChanceOnMiss)) {
    wild.spawns.splice(idx, 1);
    fled = true;
  }
  save();
  return { ok: true, caught: false, fled };
}

function actionCare(creatureId) {
  const t = now();
  const c = state.creatures[creatureId];
  if (!c || isAdult(c, t)) return { ok: false };
  if (!c.nextCareAt || c.nextCareAt > t) return { ok: false, msg: "Not hungry yet." };
  const gain = CONFIG.imprintPerCare * (c.nature === "gentle" ? CONFIG.gentleImprintMult : 1);
  c.imprint = Math.min(1, c.imprint + gain);
  const interval = (c.matureAt - c.bornAt) / CONFIG.careCount;
  c.nextCareAt = t + interval;
  if (c.nextCareAt >= c.matureAt) c.nextCareAt = 0;
  save();
  return { ok: true, imprint: c.imprint };
}

function actionRename(creatureId, name) {
  const c = state.creatures[creatureId];
  if (!c) return { ok: false };
  name = (name || "").trim().slice(0, 16);
  if (!name) return { ok: false, msg: "Name can't be empty." };
  c.name = name;
  save();
  return { ok: true };
}

/* Loose coins found while poking around empty hiding spots. */
function actionForage(amount) {
  state.coins += amount;
  save();
  return amount;
}

function actionManualRefreshWilds(biomeId) {
  if (state.coins < CONFIG.wildManualRefreshCost) return { ok: false, msg: "Not enough coins." };
  state.coins -= CONFIG.wildManualRefreshCost;
  refreshWilds(biomeId, now());
  save();
  return { ok: true };
}

function actionManualRefreshMarket() {
  if (state.coins < CONFIG.marketManualRefreshCost) return { ok: false, msg: "Not enough coins." };
  state.coins -= CONFIG.marketManualRefreshCost;
  refreshMarket(now());
  save();
  return { ok: true };
}
