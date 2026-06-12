/* Headless smoke test: loads the game logic in Node and simulates
 * captures, breeding across generations, mutations, and the economy.
 * Run: node test/sim.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const storage = {};
const sandbox = {
  localStorage: {
    getItem: k => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = v; },
    removeItem: k => { delete storage[k]; },
  },
  Math, JSON, Date, console,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ["data.js", "genetics.js", "game.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8"), sandbox, { filename: f });
}

const g = code => vm.runInContext(code, sandbox);

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { console.error("  ✗ FAIL: " + name); failures++; }
}

console.log("── new game ──");
g("newGame()");
check("starts with coins", g("state.coins") === g("CONFIG.startCoins"));
check("starter pair exists", g("ranchCount()") === 2);
check("starter pair is F+M", g(`ranchList().map(c=>c.sex).sort().join("")`) === "FM");
check("meadow spawns exist", g(`state.wilds.meadow.spawns.length`) === 4);
check("market has offers", g(`state.market.offers.length`) === 4);
check("demand active", g(`!!state.demand`));

console.log("── wild rolls ──");
g(`var spawn = makeWildSpawn("meadow")`);
check("wild level within biome range",
  g(`creatureLevel(spawn.creature) >= 5 && creatureLevel(spawn.creature) <= 41`));
check("points sum to level-1", g(`totalPoints(spawn.creature) === creatureLevel(spawn.creature) - 1`));
check("catch zone sane", g(`var z = catchZoneWidth(spawn.creature, "basic"); z > 0.04 && z < 0.9`));

console.log("── capture ──");
g(`var uid = state.wilds.meadow.spawns[0].uid`);
g(`var capRes = actionCatchResolve("meadow", uid, "basic", true)`);
check("capture succeeds", g("capRes.ok && capRes.caught"));
check("net consumed", g("state.nets.basic") === g("CONFIG.startNets") - 1);
check("ranch grew", g("ranchCount()") === 3);

console.log("── breeding flow ──");
g(`
var mom = ranchList().find(c => c.sex === "F" && c.species === "fluffit");
var dad = ranchList().find(c => c.sex === "M" && c.species === "fluffit");
// give them distinct stats to verify inheritance bounds
mom.points = { health: 30, stamina: 2, weight: 2, power: 2, speed: 2 };
dad.points = { health: 2, stamina: 2, weight: 2, power: 28, speed: 2 };
var pr = actionStartPair(mom.id, dad.id);
`);
check("pair starts", g("pr.ok === true"));
check("mother locked while pairing", g("canBreed(mom, now())") === false);
check("can't double-pair", g("actionStartPair(mom.id, dad.id).ok") === false);

// fast-forward: mating → egg → hatch
g(`state.pairs[0].doneAt = 0; var ev1 = tick();`);
check("egg stage reached", g(`state.pairs[0] && state.pairs[0].stage === "egg"`));
g(`state.pairs[0].doneAt = 0; var ev2 = tick();`);
check("hatch event fired", g(`ev2.some(e => e.type === "hatch")`));
check("pair cleared", g("state.pairs.length") === 0);
g(`var baby = ev2.find(e => e.type === "hatch").child`);
check("baby is gen 1", g("baby.gen") === 1);
check("baby not adult yet", g("isAdult(baby, now())") === false);
check("mother on cooldown", g("mom.cooldownUntil > now()"));

console.log("── inheritance statistics (2000 children) ──");
g(`
var hiHealth = 0, hiPower = 0, totalMuts = 0, n = 2000;
for (let i = 0; i < n; i++) {
  const kid = breedChild(mom, dad);
  const base = { health: kid.statSource.health === "F" ? 30 : 2,
                 power: kid.statSource.power === "M" ? 28 : 2 };
  if (kid.points.health >= 30) hiHealth++;
  if (kid.points.power >= 28) hiPower++;
  totalMuts += kid.mutations.maternal + kid.mutations.paternal;
}
`);
const hiHealth = g("hiHealth / n"), hiPower = g("hiPower / n");
check(`health from higher parent ≈55% (got ${(hiHealth * 100).toFixed(1)}%)`, hiHealth > 0.50 && hiHealth < 0.60);
check(`power from higher parent ≈55% (got ${(hiPower * 100).toFixed(1)}%)`, hiPower > 0.50 && hiPower < 0.60);
// expected mutations/child = 2 sides × 3 rolls × 8% = 0.48
const muts = g("totalMuts / n");
check(`mutation rate ≈0.48/child (got ${muts.toFixed(3)})`, muts > 0.40 && muts < 0.56);

console.log("── mutation cap ──");
g(`
mom.mutations = { maternal: 12, paternal: 8 }; // total 20 → capped
var cappedMuts = 0;
for (let i = 0; i < 800; i++) {
  const kid = breedChild(mom, dad);
  cappedMuts += kid.mutations.maternal - 20; // new maternal-side mutations
}
`);
check("capped side rolls zero new mutations", g("cappedMuts") === 0);
g(`
var inheritedCounter = breedChild(mom, dad).mutations.maternal;
`);
check("child inherits mother's total counter (20)", g("inheritedCounter") === 20);
g(`mom.mutations = { maternal: 0, paternal: 0 };`);

console.log("── economy ──");
g(`
var v1 = saleValue(mom, now(), null);
mom.mutatedStats.health = 5;
var v2 = saleValue(mom, now(), null);
mom.mutatedStats.health = 0;
var vDemand = saleValue(mom, now(), { species: "fluffit", stat: "health" });
`);
check("mutations raise value", g("v2 > v1"));
check("demand raises value", g("vDemand > v1"));
g(`var coinsBefore = state.coins; var sellRes = actionSell(baby.id);`);
check("baby sells", g("sellRes.ok"));
check("coins paid out", g("state.coins") === g("coinsBefore + sellRes.value"));
check("baby price discounted vs adult", (() => {
  g(`var twin = makeCreature("fluffit", 20); twin.bornAt = now(); twin.matureAt = now() + 100;
     var asBaby = saleValue(twin, now(), null);
     twin.matureAt = 0;
     var asAdult = saleValue(twin, now(), null);`);
  return g("asBaby < asAdult");
})());

console.log("── shop & biomes ──");
g(`state.coins = 100000;`);
check("buy net works", g(`actionBuyNet("mythic").ok`) && g("state.nets.mythic") === 1);
check("unlock biome works", g(`actionUnlockBiome("forest").ok`) && g(`state.biomes.includes("forest")`));
check("forest spawns generated", g(`state.wilds.forest.spawns.length > 0`));
check("double unlock rejected", g(`actionUnlockBiome("forest").ok`) === false);
g(`var offer = state.market.offers[0]; var buyRes = actionBuyOffer(offer.uid);`);
check("buy market offer works", g("buyRes.ok"));

console.log("── care / imprint ──");
g(`
var kid2 = makeCreature("fluffit", 10);
kid2.bornAt = now() - 10; kid2.matureAt = now() + 100; kid2.nextCareAt = now() - 1;
adoptCreature(kid2, now());
var careRes = actionCare(kid2.id);
`);
check("care works when window open", g("careRes.ok") && g("kid2.imprint") > 0);
check("care rejected when not due", g("actionCare(kid2.id).ok") === false);

console.log("── natures & shinies ──");
g(`
var nMom = ranchList().find(c => c.sex === "F" && c.species === "fluffit");
var nDad = ranchList().find(c => c.sex === "M" && c.species === "fluffit");
nMom.nature = "swift"; nDad.nature = "brave";
var fromM = 0, fromF = 0, fromR = 0, shinies = 0, nN = 3000;
for (let i = 0; i < nN; i++) {
  const kid = breedChild(nMom, nDad);
  if (kid.nature === "swift") fromM++;
  else if (kid.nature === "brave") fromF++;
  else fromR++;
  if (kid.shiny) shinies++;
}
`);
const fm = g("fromM / nN"), ff = g("fromF / nN");
check(`nature from mother ≈40%+share (got ${(fm * 100).toFixed(1)}%)`, fm > 0.36 && fm < 0.50);
check(`nature from father ≈40%+share (got ${(ff * 100).toFixed(1)}%)`, ff > 0.36 && ff < 0.50);
const shinyRate = g("shinies / nN");
check(`bred shiny rate ≈1/200 (got ${(shinyRate * 100).toFixed(2)}%)`, shinyRate > 0.001 && shinyRate < 0.015);
g(`
var gv = makeCreature("fluffit", 20); gv.shiny = false; gv.nature = "docile";
var vPlain = saleValue(gv, now(), null);
gv.nature = "greedy"; var vGreedy = saleValue(gv, now(), null);
gv.shiny = true; var vShiny = saleValue(gv, now(), null);
`);
check("greedy nature raises value ~10%", g("vGreedy > vPlain && vGreedy < vPlain * 1.15"));
check("shiny multiplies value 4x", g("Math.abs(vShiny - vGreedy * CONFIG.shinyValueMult) <= CONFIG.shinyValueMult"));

console.log("── expeditions ──");
g(`
var site = state.expeditions.sites[0];
var adults = ranchList().filter(c => isAdult(c, now()) && !creatureBusy(c.id) && c.cooldownUntil <= now()).slice(0, 2);
var exRes = actionStartExpedition(site.uid, adults.map(c => c.id));
`);
check("expedition sites generated", g("state.expeditions.sites.length") === 3);
check("expedition launches", g("exRes.ok === true"));
check("team is busy", g("creatureBusy(adults[0].id)") === true);
check("busy creature can't breed", g("canBreed(adults[0], now())") === false);
check("busy creature can't sell", g("actionSell(adults[0].id).ok") === false);
g(`
var exCoins = state.coins;
state.expeditions.active[0].doneAt = 0;
var exEvents = tick();
`);
check("expedition resolves via tick", g(`exEvents.some(e => e.type === "expedition")`));
check("expedition pays out", g("state.coins > exCoins"));
check("team freed after expedition", g("creatureBusy(adults[0].id)") === false);
check("expedition score positive", g("expeditionScore(adults, site) > 0"));
check("chance within bounds", g("var ch = expeditionChance(adults, site); ch >= 0.05 && ch <= 0.98"));

console.log("── breeding requests ──");
check("three requests live", g("state.requests.length") === 3);
g(`
var req = state.requests[0];
var match = makeCreature(req.species, 10, { sex: req.sex || "F", nature: req.nature || undefined });
match.points[req.stat] = req.threshold + 5;
match.mutations.maternal = req.minMutations; // satisfy mutation minimum
adoptCreature(match, now());
var reqCoins = state.coins;
var fulfillRes = actionFulfillRequest(req.id, match.id);
`);
check("request fulfills", g("fulfillRes.ok === true"));
check("request pays", g("state.coins") === g("reqCoins + fulfillRes.reward"));
check("creature handed over", g("state.creatures[match.id]") === undefined);
check("board refills to 3", g("state.requests.length") === 3);
g(`
var req2 = state.requests[0];
var weak = makeCreature(req2.species, 5);
weak.points[req2.stat] = 0;
adoptCreature(weak, now());
`);
check("weak creature rejected", g("actionFulfillRequest(req2.id, weak.id).ok") === false);

console.log("── protect lock ──");
g(`var lockRes = actionToggleLock(weak.id);`);
check("lock toggles on", g("lockRes.ok && lockRes.locked === true"));
check("locked creature can't sell", g("actionSell(weak.id).ok") === false);
g(`actionToggleLock(weak.id);`);
check("unlocked creature sells", g("actionSell(weak.id).ok") === true);

console.log("── critterdex & achievements ──");
check("dex has entries", g("Object.keys(state.dex).length > 0"));
check("fluffit logged", g("!!state.dex.fluffit"));
check("dex bestLevel tracked", g("state.dex.fluffit.bestLevel > 0"));
g(`tick();`);
check("first_catch achievement granted", g("state.achievements.first_catch") === true);
check("first_hatch achievement granted", g("state.achievements.first_hatch") === true);

console.log("── daily & trader ──");
check("trader exists with priced stock", g("state.trader && state.trader.price > 0"));
g(`
state.lastDaily = "2000-01-01";
var dailyCoins = state.coins;
var dailyEvents = tick();
`);
check("daily bonus fires", g(`dailyEvents.some(e => e.type === "daily")`));
check("daily pays coins", g("state.coins > dailyCoins"));
check("trader restocked today", g(`state.trader.day === new Date().toISOString().slice(0,10)`));
g(`
state.coins = 1000000;
var trBuy = actionBuyTrader();
`);
check("trader purchase works", g("trBuy.ok === true"));
check("trader sold out after purchase", g("actionBuyTrader().ok") === false);

console.log("── save migration ──");
g(`
// simulate a pre-guild save: strip the new fields, then reload
delete state.requests; delete state.expeditions; delete state.dex;
delete state.achievements; delete state.trader; state.lastDaily = undefined;
for (const c of Object.values(state.creatures)) { delete c.nature; delete c.shiny; delete c.locked; }
save();
state = null;
var migrated = load();
`);
check("old save loads", g("migrated === true"));
check("migration restores requests", g("Array.isArray(state.requests)"));
check("migration restores expeditions", g("!!state.expeditions"));
check("migration rebuilds dex", g("Object.keys(state.dex).length > 0"));
check("migration assigns natures", g("Object.values(state.creatures).every(c => !!c.nature)"));

console.log("── persistence ──");
g(`save(); var savedCoins = state.coins; state = null; var loaded = load();`);
check("save/load round-trips", g("loaded === true && state.coins === savedCoins"));

console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll checks passed 🎉");
process.exit(failures ? 1 : 0);
