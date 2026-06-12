/* ── Critter Ranch: static game data ───────────────────────── */

const STATS = ["health", "stamina", "weight", "power", "speed"];

const STAT_META = {
  health:  { name: "Health",  ico: "❤️", color: "#f87171" },
  stamina: { name: "Stamina", ico: "⚡", color: "#fbbf24" },
  weight:  { name: "Weight",  ico: "📦", color: "#a78bfa" },
  power:   { name: "Power",   ico: "⚔️", color: "#fb923c" },
  speed:   { name: "Speed",   ico: "💨", color: "#60a5fa" },
};

const RARITIES = {
  common:    { name: "Common",    mult: 1.0, order: 0 },
  uncommon:  { name: "Uncommon",  mult: 1.6, order: 1 },
  rare:      { name: "Rare",      mult: 2.8, order: 2 },
  epic:      { name: "Epic",      mult: 5.0, order: 3 },
  legendary: { name: "Legendary", mult: 9.0, order: 4 },
};

/*
 * Timing (seconds). Indexed by rarity order: common → legendary.
 * Kept short so a phone session always has something happening.
 */
const TIMING = {
  mating:        [12, 15, 18, 22, 28],
  egg:           [25, 40, 60, 90, 140],
  mature:        [80, 130, 210, 330, 540],
  cooldownF:     [90, 130, 190, 280, 420],
  cooldownM:     [25, 30, 35, 40, 50],
};

const SPECIES = {
  fluffit:    { name: "Fluffit",    emoji: "🐰", rarity: "common",    biome: "meadow",  basePrice: 45,   regions: 3 },
  pebbletoad: { name: "Pebbletoad", emoji: "🐸", rarity: "common",    biome: "meadow",  basePrice: 50,   regions: 3 },
  sparrowl:   { name: "Sparrowl",   emoji: "🐦", rarity: "common",    biome: "meadow",  basePrice: 55,   regions: 3 },
  honeygrub:  { name: "Honeygrub",  emoji: "🐛", rarity: "common",    biome: "forest",  basePrice: 60,   regions: 3 },
  emberfox:   { name: "Emberfox",   emoji: "🦊", rarity: "uncommon",  biome: "forest",  basePrice: 140,  regions: 3 },
  thornpig:   { name: "Thornpig",   emoji: "🐗", rarity: "uncommon",  biome: "forest",  basePrice: 160,  regions: 3 },
  glimmerfin: { name: "Glimmerfin", emoji: "🐠", rarity: "uncommon",  biome: "swamp",   basePrice: 175,  regions: 4 },
  mosshell:   { name: "Mosshell",   emoji: "🐢", rarity: "rare",      biome: "swamp",   basePrice: 480,  regions: 4 },
  venomspine: { name: "Venomspine", emoji: "🦂", rarity: "rare",      biome: "swamp",   basePrice: 520,  regions: 4 },
  frostwolf:  { name: "Frostwolf",  emoji: "🐺", rarity: "rare",      biome: "peaks",   basePrice: 560,  regions: 4 },
  stormhawk:  { name: "Stormhawk",  emoji: "🦅", rarity: "epic",      biome: "peaks",   basePrice: 1700, regions: 5 },
  lumicorn:   { name: "Lumicorn",   emoji: "🦄", rarity: "epic",      biome: "peaks",   basePrice: 1900, regions: 5 },
  drakeling:  { name: "Drakeling",  emoji: "🦎", rarity: "epic",      biome: "caldera", basePrice: 2100, regions: 5 },
  pyrewyrm:   { name: "Pyrewyrm",   emoji: "🐉", rarity: "legendary", biome: "caldera", basePrice: 7500, regions: 6 },
  cindervane: { name: "Cindervane", emoji: "🐦‍🔥", rarity: "legendary", biome: "caldera", basePrice: 8500, regions: 6 },
};

const BIOMES = {
  meadow:  { name: "Meadow",  ico: "🌼", cost: 0,     levels: [4, 40],   spawns: 4 },
  forest:  { name: "Forest",  ico: "🌲", cost: 600,   levels: [15, 70],  spawns: 4 },
  swamp:   { name: "Swamp",   ico: "🪷", cost: 2500,  levels: [30, 100], spawns: 3 },
  peaks:   { name: "Peaks",   ico: "🏔️", cost: 9000,  levels: [50, 130], spawns: 3 },
  caldera: { name: "Caldera", ico: "🌋", cost: 30000, levels: [80, 160], spawns: 3 },
};

const NETS = {
  basic:  { name: "Twine Net",  ico: "🕸️", cost: 25,  zone: 1.0, desc: "A simple net. Gets the job done… sometimes." },
  strong: { name: "Steel Net",  ico: "⛓️", cost: 110, zone: 1.6, desc: "Wider catch window. Worth it for rares." },
  mythic: { name: "Aether Net", ico: "✨", cost: 400, zone: 2.4, desc: "Huge catch window. For legendary hunts." },
};

/* Natural coat colors (indices 0-11) and vivid mutation colors (12-19). */
const COLORS = [
  "#8d7355", "#5b4a38", "#c2a878", "#6e7f5c", "#4a6741", "#7a8a99",
  "#535e6e", "#a8927e", "#9aa56b", "#71584a", "#8a8d91", "#b5a642",
  /* mutation palette */
  "#ff2d78", "#00e5ff", "#b026ff", "#39ff14", "#ff9100", "#fff200",
  "#ff0040", "#00ffc8",
];
const MUTATION_COLOR_START = 12;

const NAME_PARTS = {
  a: ["Bil", "Mo", "Zu", "Pip", "Kee", "Tara", "Loo", "Fen", "Gro", "Nim",
      "Ru", "Sashi", "Ola", "Bram", "Quil", "Vex", "Hop", "Dun", "Mira", "Tok"],
  b: ["bo", "ka", "ster", "wick", "li", "no", "puff", "zle", "din", "mo",
      "ra", "bit", "ko", "sy", "doo", "nash", "per", "lou", "ti", "gus"],
};

const CONFIG = {
  startCoins: 300,
  startNets: 3,
  ranchCap: 30,

  /* genetics */
  higherParentChance: 0.55,      // ARK-style stat inheritance
  mutationRollsPerSide: 3,
  mutationChance: 0.08,
  mutationCap: 20,               // per-side counter cap
  mutationStatBonus: 2,          // levels added per mutation
  maxWildPointsPerStat: 60,      // soft display cap for bars

  /* economy */
  pointValue: 0.035,             // value multiplier per stat point
  mutationValue: 0.18,           // value multiplier per mutation in line
  babyValueFloor: 0.30,          // newborn sells for 30% of mature value
  imprintValue: 0.5,             // +50% value at 100% imprint
  demandSpeciesBonus: 0.6,
  demandStatBonus: 0.3,
  demandStatThreshold: 28,       // points needed in featured stat
  offerMarkup: 1.65,             // market sells to you at this premium

  /* timers (seconds) */
  wildRefresh: 120,
  marketRefresh: 180,
  demandRotate: 300,
  careInterval: 0,               // derived: matureTime / careCount
  careCount: 8,                  // care windows during maturation
  imprintPerCare: 0.125,         // 8 cares = 100%

  fleeChanceOnMiss: 0.5,
  marketManualRefreshCost: 60,
  wildManualRefreshCost: 30,
};
