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
    tally: { captured: 0, bred: 0, sold: 0, earned: 0, bestSale: 0, mutationsSeen: 0 },
  };

  // Starter pair so breeding is teachable from minute one.
  const mom = makeCreature("fluffit", 18, { sex: "F", origin: "starter", name: "Clover" });
  const dad = makeCreature("fluffit", 16, { sex: "M", origin: "starter", name: "Biscuit" });
  adoptCreature(mom, t);
  adoptCreature(dad, t);

  rotateDemand(t);
  refreshWilds("meadow", t);
  refreshMarket(t);
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
    if (typeof state.sound === "undefined") state.sound = true;
    return true;
  } catch (e) {
    return false;
  }
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  newGame();
}

function adoptCreature(creature, t) {
  creature.id = state.nextId++;
  if (!creature.bornAt) creature.bornAt = t;
  state.creatures[creature.id] = creature;
  return creature;
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

function canBreed(c, t) {
  return isAdult(c, t) && c.cooldownUntil <= t && !creatureInPair(c.id);
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

  // Care windows for babies
  for (const baby of babies(t)) {
    if (baby.nextCareAt && baby.nextCareAt <= t && baby.imprint < 0.999) {
      // window stays open; UI shows pulsing care button
    }
  }

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

  mother.cooldownUntil = t + TIMING.cooldownF[rOrder];
  father.cooldownUntil = t + TIMING.cooldownM[rOrder];

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
  if (creatureInPair(creatureId)) return { ok: false, msg: "Can't sell while breeding." };
  const value = saleValue(c, t, state.demand);
  delete state.creatures[creatureId];
  state.coins += value;
  state.tally.sold++;
  state.tally.earned += value;
  if (value > state.tally.bestSale) state.tally.bestSale = value;
  save();
  return { ok: true, value };
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
  c.imprint = Math.min(1, c.imprint + CONFIG.imprintPerCare);
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
