# 🥚 Critter Ranch

A mobile-first creature-collecting game with deep, **ARK: Survival Ascended-style breeding genetics**. Capture wild creatures, buy breeding stock, pair them, stack mutations across generations, and sell your bloodlines for profit.

No build step, no dependencies — pure HTML/CSS/JS. Saves automatically to your browser.

## ▶️ Play

Serve the folder with any static server and open it on your phone (or in a browser):

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000`. On a phone you can **Add to Home Screen** for a fullscreen app experience (PWA manifest included).

The easiest way to publish it: enable **GitHub Pages** on this repo (Settings → Pages → deploy from branch) and play it from anywhere.

## 🎮 The Game

### 🪤 Capture
Wild creatures roam 5 unlockable biomes (Meadow → Caldera) with **randomly rolled stat points** you can inspect before committing a net. Catching is a timing minigame — tap when the marker crosses the green zone. Rarer and higher-level creatures have narrower zones and faster markers; better nets widen the zone. Miss and the creature might flee.

### 🧬 Breeding (the deep part)
Genetics follow the ARK: Survival Ascended model:

- Every creature has wild **points in 5 stats** (Health, Stamina, Weight, Power, Speed). Total level = 1 + total points.
- Offspring inherit **each stat independently**: 55% chance to get the *higher* parent's points, 45% the lower.
- At birth, each parent's side rolls **3× at 8%** for a mutation: **+2 points** in a random stat plus a vivid mutation color in a random color region.
- Each creature carries **maternal/paternal mutation counters (x/20)**. A parent whose *total* counter has reached 20 can no longer produce new mutations on its side — so the endgame is pairing your mutated line against **clean 0/0 breeders** to keep stacking, exactly like ARK mutation breeding.
- Stat sources are tracked (♀/♂ badge per stat) along with how many mutations are stacked in each stat's line.
- Color regions inherit 50/50 per region from the parents; mutation colors glow.

### 🍼 Raising
Eggs incubate, babies mature in real time, and periodic **care requests** build imprint — up to +50% sale value for an attentively raised creature.

### 🪙 Economy
- Sale value scales with rarity, total stat points, stacked mutations, maturity, and imprint.
- A rotating **demand banner** boosts featured species (+60%) and creatures with a featured stat ≥ 28 points (+30%) — time your sales.
- The market sells random breeding stock at a markup (the way to get a missing sex/species), plus nets and biome unlocks as coin sinks.
- Ranch capacity is limited — cull the weak, sell the strong, keep the perfect.

## 🗂 Code layout

| File | Purpose |
|---|---|
| `js/data.js` | Species, biomes, nets, colors, all tuning constants |
| `js/genetics.js` | Stat rolling, inheritance, mutations, valuation |
| `js/game.js` | Game state, save/load, tick simulation, player actions |
| `js/ui.js` | Rendering, modals, catch minigame, event handling |
| `js/main.js` | Boot + main loop |
