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

### 🏡 A living world
Your creatures aren't list entries — they wander an animated pasture, sleep off breeding cooldowns (💤), court in pairs with an incubating egg between them, and babies beg for care (🍼) right in the scene. Sound effects are synthesized live via WebAudio (no assets) and key moments trigger haptic feedback on phones.

### 🪤 Hunting & capture
Wild creatures **hide** in the bushes and rocks of 5 unlockable biomes (Meadow → Caldera). Watch for rustling, 🐾 footprints, and peeking heads — tap a bush to flush its creature into the open (some bushes are decoys, occasionally hiding loose coins). Each wild creature has **randomly rolled stat points** you can inspect before committing a net. Catching is a timing minigame — tap when the marker crosses the green zone. Rarer and higher-level creatures have narrower zones and faster markers; better nets widen the zone. Miss and the creature might flee.

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

### 🏰 The Guild — your stats have a job
- **Expeditions:** send teams of up to 3 rested adults on jobs that weight specific stats (e.g. Speed ×2 + Stamina). Team score vs. target sets the success odds — success pays coins and sometimes nets, failure pays salvage and fatigues the team.
- **Breeding requests:** a rotating board of collector orders ("female Pebbletoad, Power ≥ 16, 1+ mutations") that pay a hefty premium over market price — breed to spec.
- **Critterdex:** a collection log per species (captured/bred/sold, best level, shinies) with silhouettes for the undiscovered.
- **Achievements:** 17 milestones that auto-grant coin rewards.

### 🍀 Natures & shinies
Every creature has a heritable **nature** (40% mother / 40% father / 20% random) with a real effect: Lucky boosts mutation odds as a parent, Fertile shortens breeding cooldowns, Gentle improves imprinting, Swift/Brave/Hardy shine on expeditions, Greedy sells higher. And rarely a creature is born **✨ shiny** — a golden glow and 4× value (1/400 wild, 1/200 bred).

### 🌅 Daily hooks
A daily login bonus (coins + a net) and a **traveling trader** who visits the market once per day with one exceptional, high-level specimen — occasionally shiny.

### ⭐ Quality of life
Sort and filter the herd, **protect** foundation breeders from accidental selling, and inspect any creature's **family tree** with mutation counters across generations.

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
| `js/fx.js` | WebAudio synth sound effects, haptics, screen shake |
| `js/scene.js` | Living scene engine: wandering actors, bush hunts, particles |
| `js/ui.js` | Rendering, modals, catch minigame, hatch ceremony, event handling |
| `js/main.js` | Boot + main loop |
