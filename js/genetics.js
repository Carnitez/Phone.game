/* ── Critter Ranch: genetics, stats & valuation ─────────────
 *
 * Breeding model (ARK: Survival Ascended style):
 *  - Every creature has wild stat POINTS in 5 stats. Total level = 1 + sum.
 *  - Offspring inherit each stat independently: 55% chance to take the
 *    HIGHER parent's points, 45% the lower.
 *  - After inheritance, each parent side rolls 3× for a mutation (8% each),
 *    but only while that parent's total mutation counter is below 20.
 *  - A mutation adds +2 points to one random stat AND recolors one random
 *    color region with a vivid mutation color.
 *  - The child's maternal counter = mother's total mutations + new maternal
 *    mutations (same for paternal). Counters only ever grow — managing
 *    clean (0/0) breeding stock is the long game.
 */

function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }
function chance(p) { return Math.random() < p; }

function randomName() {
  return pick(NAME_PARTS.a) + pick(NAME_PARTS.b);
}

function rarityOrder(speciesId) {
  return RARITIES[SPECIES[speciesId].rarity].order;
}

/* Distribute `level` points across the 5 stats with mild randomness,
 * mimicking wild stat rolls: some creatures roll hot in one stat. */
function rollWildPoints(level) {
  const pts = {};
  STATS.forEach(s => pts[s] = 0);
  for (let i = 0; i < level; i++) {
    pts[pick(STATS)]++;
  }
  return pts;
}

function totalPoints(creature) {
  return STATS.reduce((sum, s) => sum + creature.points[s], 0);
}

function creatureLevel(creature) {
  return 1 + totalPoints(creature);
}

function totalMutations(creature) {
  return creature.mutations.maternal + creature.mutations.paternal;
}

function naturalColor() {
  return rand(MUTATION_COLOR_START);
}

function mutationColor() {
  return MUTATION_COLOR_START + rand(COLORS.length - MUTATION_COLOR_START);
}

/* ── Creature factories ── */

function makeCreature(speciesId, level, opts = {}) {
  const sp = SPECIES[speciesId];
  const colors = [];
  for (let i = 0; i < sp.regions; i++) colors.push(naturalColor());
  const statSource = {};
  STATS.forEach(s => statSource[s] = "W"); // W = wild/unknown origin
  const mutatedStats = {};
  STATS.forEach(s => mutatedStats[s] = 0);
  return {
    id: 0, // assigned by game on adoption
    species: speciesId,
    name: opts.name || randomName(),
    sex: opts.sex || (chance(0.5) ? "F" : "M"),
    points: opts.points || rollWildPoints(level),
    statSource,
    mutatedStats,
    mutations: { maternal: 0, paternal: 0 },
    colors,
    parents: null,
    gen: 0,
    origin: opts.origin || "wild",
    imprint: 0,
    bornAt: 0,
    matureAt: 0,      // <= bornAt means already adult
    cooldownUntil: 0,
    nextCareAt: 0,
  };
}

/* Roll a child from two parents. Pure function: timing fields are
 * filled in by game.js when the egg hatches. */
function breedChild(mother, father) {
  const speciesId = mother.species;
  const sp = SPECIES[speciesId];

  const points = {};
  const statSource = {};
  const mutatedStats = {};

  // ── Stat inheritance: 55% higher parent, per stat ──
  STATS.forEach(s => {
    const m = mother.points[s], f = father.points[s];
    let fromMother;
    if (m === f) {
      fromMother = chance(0.5);
    } else {
      const higherIsMother = m > f;
      const takeHigher = chance(CONFIG.higherParentChance);
      fromMother = takeHigher ? higherIsMother : !higherIsMother;
    }
    points[s] = fromMother ? m : f;
    statSource[s] = fromMother ? "F" : "M"; // F = from mother (♀), M = from father (♂)
    mutatedStats[s] = fromMother ? mother.mutatedStats[s] : father.mutatedStats[s];
  });

  // ── Color inheritance: 50/50 per region ──
  const colors = [];
  for (let i = 0; i < sp.regions; i++) {
    const mc = mother.colors[i] ?? naturalColor();
    const fc = father.colors[i] ?? naturalColor();
    colors.push(chance(0.5) ? mc : fc);
  }

  // ── Mutations ──
  let newMaternal = 0, newPaternal = 0;
  const mutationEvents = [];
  const rollSide = (parent, side) => {
    if (totalMutations(parent) >= CONFIG.mutationCap) return 0;
    let got = 0;
    for (let i = 0; i < CONFIG.mutationRollsPerSide; i++) {
      if (chance(CONFIG.mutationChance)) got++;
    }
    for (let i = 0; i < got; i++) {
      const stat = pick(STATS);
      points[stat] += CONFIG.mutationStatBonus;
      mutatedStats[stat]++;
      const region = rand(sp.regions);
      colors[region] = mutationColor();
      mutationEvents.push({ stat, region, side });
    }
    return got;
  };
  newMaternal = rollSide(mother, "maternal");
  newPaternal = rollSide(father, "paternal");

  return {
    id: 0,
    species: speciesId,
    name: randomName(),
    sex: chance(0.5) ? "F" : "M",
    points,
    statSource,
    mutatedStats,
    mutations: {
      maternal: totalMutations(mother) + newMaternal,
      paternal: totalMutations(father) + newPaternal,
    },
    colors,
    parents: {
      motherId: mother.id, motherName: mother.name,
      fatherId: father.id, fatherName: father.name,
    },
    gen: Math.max(mother.gen, father.gen) + 1,
    origin: "bred",
    imprint: 0,
    bornAt: 0,
    matureAt: 0,
    cooldownUntil: 0,
    nextCareAt: 0,
    newMutations: mutationEvents, // transient, for hatch toast
  };
}

/* ── Wild spawns ── */

function makeWildSpawn(biomeId) {
  const biome = BIOMES[biomeId];
  const candidates = Object.keys(SPECIES).filter(id => SPECIES[id].biome === biomeId);
  const speciesId = pick(candidates);
  const [lo, hi] = biome.levels;
  // bias toward the low end so high rolls feel special
  const r = Math.min(Math.random(), Math.random());
  const level = lo + Math.floor(r * (hi - lo + 1));
  const creature = makeCreature(speciesId, level);
  return {
    uid: Math.random().toString(36).slice(2),
    creature,
  };
}

/* Catch zone width (fraction of the bar) for a spawn + net. */
function catchZoneWidth(creature, netId) {
  const lvl = creatureLevel(creature);
  const rOrder = rarityOrder(creature.species);
  const base = 0.30 / (1 + lvl / 120) / (1 + rOrder * 0.28);
  return Math.min(0.85, Math.max(0.05, base * NETS[netId].zone));
}

/* Marker oscillation speed (full sweeps per second). */
function catchMarkerSpeed(creature) {
  return 0.55 + rarityOrder(creature.species) * 0.12;
}

/* ── Valuation ── */

function maturation(creature, now) {
  if (creature.matureAt <= creature.bornAt) return 1;
  return Math.min(1, (now - creature.bornAt) / (creature.matureAt - creature.bornAt));
}

function isAdult(creature, now) {
  return maturation(creature, now) >= 1;
}

function saleValue(creature, now, demand) {
  const sp = SPECIES[creature.species];
  const rarity = RARITIES[sp.rarity];
  let v = sp.basePrice * rarity.mult;
  v *= 1 + totalPoints(creature) * CONFIG.pointValue;
  const lineMutations = STATS.reduce((sum, s) => sum + creature.mutatedStats[s], 0);
  v *= 1 + lineMutations * CONFIG.mutationValue;
  const m = maturation(creature, now);
  v *= CONFIG.babyValueFloor + (1 - CONFIG.babyValueFloor) * m;
  v *= 1 + creature.imprint * CONFIG.imprintValue;
  if (demand) {
    if (demand.species === creature.species) v *= 1 + CONFIG.demandSpeciesBonus;
    if (creature.points[demand.stat] >= CONFIG.demandStatThreshold) v *= 1 + CONFIG.demandStatBonus;
  }
  return Math.round(v);
}

/* Best-case child preview: max of each parent's points per stat. */
function pairPreview(mother, father) {
  return STATS.map(s => ({
    stat: s,
    m: mother.points[s],
    f: father.points[s],
    best: Math.max(mother.points[s], father.points[s]),
  }));
}
