# CRITTER GROVE — Build Specification v1.0

> This document is the single source of truth. State lives here, not in conversations.
> You (Claude Code) are the Developer. Build autonomously phase by phase.
> Do not proceed to the next phase until the current phase's Definition of Done passes.

---

## 1. Product summary

A casual creature-collecting mobile game. Think Pokémon's collecting dopamine with Cats & Soup's pace. No combat. Players catch cute creatures via a one-tap minigame, fill a collection book, decorate a habitat, and breed variants. Monetized primarily through opt-in rewarded video ads. Sessions of 2–5 minutes, playable one-handed, portrait only.

**Design pillars (reject any feature that violates these):**
1. Zero friction — no tutorial walls, playable in 10 seconds
2. Ads are always opt-in and always a good deal for the player
3. Every session ends with visible progress (new creature, egg progress, or collection %)
4. Cozy, not grindy — timers create anticipation, never frustration

---

## 2. Tech stack (fixed — do not substitute)

- **Engine:** Phaser 3 (latest stable) + TypeScript
- **Build:** Vite
- **Mobile wrapper:** Capacitor 6 (Android first, iOS later)
- **State/persistence:** localStorage via a single `SaveManager` abstraction (swap-ready for cloud saves later)
- **Ads:** `AdService` interface with two implementations:
  - `MockAdService` (dev — simulates a 3s ad with a skippable overlay, always used in browser)
  - `AdMobService` (Capacitor `@capacitor-community/admob`, rewarded + optional interstitial; test IDs only until release)
- **No backend in MVP.** Everything client-side. Design the save schema as if it will sync later.
- **Testing:** Vitest for all game logic (economy, breeding, RNG, save migration). Game logic must live in pure TS modules with zero Phaser imports so it is unit-testable headlessly.

**Architecture rule:** strict separation:
- `/src/core` — pure logic: economy, creatures, breeding, catch resolution, RNG (seedable), save schema + migrations. 100% Vitest coverage target on this folder.
- `/src/game` — Phaser scenes, rendering, input, audio
- `/src/services` — AdService, SaveManager, Analytics stub
- `/src/data` — creature definitions, rarity tables, economy constants as typed JSON/TS

---

## 3. Core loop

1. Creatures spawn periodically in the **Grove** (the main scene — a living diorama)
2. Player taps a creature → **catch minigame** (timing-ring tap: tap when the shrinking ring overlaps the target band; band width scales with rarity)
3. Success → creature added to collection, coins awarded, creature wanders the Grove
4. Coins buy **habitat decorations** (which raise spawn rate / unlock new species pools) and **incubator slots**
5. Two owned creatures of the same species group can **breed** → egg → timer → hatch → chance of color variants and stat inheritance
6. **Collection book** tracks species, variants, and completion % — the primary long-term goal

**Spawn cadence:** one spawn every 60–120s while app is open; offline accrual caps at 5 waiting creatures ("your Grove filled up while you were away").

---

## 4. Creatures & breeding (MVP scope)

- **MVP species count:** 12 species across 3 biome groups (Meadow, Pond, Forest), each with 4 color variants (Common, Uncommon, Rare, Shiny)
- Rarity odds on wild spawn: 70 / 20 / 9 / 1
- **Stats per creature (integers 1–100):** Charm, Vitality, Fortune
  - Charm → passive coin generation rate while in Grove
  - Vitality → breeding cooldown reduction
  - Fortune → small bonus to variant odds when breeding
- **Inheritance:** per stat, 65% roll toward the higher parent's value ±5, 35% toward the lower parent's value ±5
- **Mutation:** flat 2% per stat to roll fresh 1–100
- **Variant inheritance when breeding:** offspring variant = highest parent variant tier with 15% (+Fortune bonus) chance to upgrade one tier
- Breeding produces 1 egg; egg timers: 10min / 30min / 2h / 8h by variant tier
- No inbreeding system in MVP (defer)

All creature art: simple 2D — colored geometric placeholder sprites generated in code (circles/blobs with eyes) until real art exists. Build the sprite pipeline so a sprite sheet can be dropped in later without code changes.

---

## 5. Economy & monetization

**Currencies:**
- Coins (soft) — from catches, passive Charm income, daily gift
- Gems (hard) — MVP: earned only via collection milestones; IAP stubbed, not wired to stores

**Rewarded ad placements (all opt-in, reward shown before watch):**
| Placement | Offer | Cap |
|---|---|---|
| Double catch reward | 2x coins on the catch just made | every catch, 90s cooldown |
| Instant hatch | skip remaining egg timer | 3/day |
| Spawn surge | force 3 spawns now | 4/day |
| Daily gift upgrade | upgrade daily gift one rarity tier | 1/day |
| Second chance | retry a failed rare/shiny catch | uncapped, per-failure |

Global rewarded cap: 20/day. Cooldown between prompts: 60s. Track opt-in rate per placement in the analytics stub.

**Interstitials:** none in MVP. Do not add.

**IAP stubs (UI + entitlement flags only, no store wiring):** Remove Ads Forever, Gem packs ×3, cosmetic habitat theme.

**Balance rule:** a patient non-paying player progresses at ~60–70% the pace of a hypothetical spender. Tune constants in `/src/data/economy.ts`; never hardcode values in scenes.

---

## 6. Screens

1. **Grove** (main) — diorama, wandering creatures, spawn indicators, coin counter, buttons: Book / Shop / Eggs
2. **Catch overlay** — timing ring minigame
3. **Collection Book** — grid of species × variants, silhouettes for undiscovered, completion %
4. **Incubator** — 2 slots (3rd unlockable with coins, 4th with gems), breeding pair picker
5. **Shop** — decorations (coins), IAP stubs (gems)
6. **Settings** — sound, haptics, restore purchases stub, privacy/ads consent stub

---

## 7. Build phases & Definition of Done

**Phase 1 — Core logic (no rendering)**
All `/src/core` modules: creature model, RNG (seedable), catch resolution, breeding/inheritance, economy, save schema v1 with migration scaffold. DoD: Vitest suite passes; breeding distribution test over 10,000 simulated rolls matches spec within 2%.

**Phase 2 — Grove + catching**
Phaser boots, Grove scene with placeholder sprites, spawning, catch minigame, coins, persistence. DoD: playable in browser; kill/reopen tab restores state.

**Phase 3 — Collection + breeding UI**
Book, Incubator, egg timers (real-time, survive app close), hatch flow. DoD: full loop catch→breed→hatch→book works end to end.

**Phase 4 — Economy + shop + rewarded ads (mock)**
Shop, decorations affecting spawn rates, all 5 rewarded placements via MockAdService, daily gift. DoD: every placement grants correct reward and respects caps/cooldowns; caps reset at local midnight.

**Phase 5 — Capacitor + AdMob (test IDs)**
Android build, AdMobService behind the same interface, consent flow (UMP), haptics. DoD: APK installs and runs on device; rewarded test ad plays and grants reward; MockAdService still used when running in plain browser.

**Phase 6 — Polish**
Juice: tweens, particles on catch/hatch, sound stubs, app icon placeholder, save-corruption recovery. DoD: no unhandled errors across a scripted 15-minute play session.

---

## 8. Working rules for Claude Code

- Commit per completed subsystem with descriptive messages
- Update the CHANGELOG section at the bottom of this file after each phase
- If a spec ambiguity blocks you, make the smallest reasonable decision, log it under DECISIONS below, and continue — do not stall
- No new dependencies beyond the stack above without logging a DECISION entry justifying it
- All tunable numbers live in `/src/data` — zero magic numbers in scenes

## DECISIONS

- **Fortune's "small bonus to variant odds"** (§4) was unspecified as a formula. Implemented as linear: `bonus = (avgFortune / 100) * 10%`, so the 15% base variant-upgrade chance scales up to 25% at Fortune 100. Constant: `VARIANT_UPGRADE_FORTUNE_BONUS_MAX` in `src/data/economy.ts`.
- **"Breeding cooldown"** (§4, Vitality) wasn't defined separately from the egg timer. Modeled as a distinct baseline cooldown (5 min) before a pair can breed again after producing an egg, reduced linearly by average parent Vitality up to 50% at Vitality 100. Constants: `BASE_BREEDING_COOLDOWN_MS`, `VITALITY_COOLDOWN_REDUCTION_MAX`.
- **Catch-minigame band widths per rarity** (§3) weren't given numeric values. Chose 0.35 / 0.25 / 0.15 / 0.08 (common → shiny, as a fraction of the ring) as a first tuning pass. `CATCH_BAND_WIDTH` in `src/data/economy.ts` — expect to retune once Phase 2 makes it playable.
- **Coin reward per catch and Charm's passive coin rate** weren't given numeric values. Chose 5/12/30/100 coins by variant and 0.02 coins/sec per Charm point as a first pass; both are isolated constants for later balancing.
- **Save schema migrations**: since v1 is the first schema, `MIGRATIONS` in `src/core/save.ts` is an empty registry keyed by from-version. `migrateSave` falls back to a fresh save on corrupt data, an unrecognized (pre-v1) version, or a save from a newer app version it doesn't understand yet.
- **Offline spawn cadence** (§3): "one spawn every 60–120s while app is open" applies during live play too, not just offline — `spawnOne()` is a no-op once 5 creatures are waiting to be caught, whether they accrued offline or the player just hasn't caught up. Reusing one cap for both cases matches the "your Grove filled up" flavor text and avoids a second tunable.
- **Wild spawn species roll**: §4 doesn't specify how species is chosen on a wild spawn (only variant-tier odds are given). Rolled uniformly across all 12 MVP species, independent of the rarity-tier roll.
- **Catch-ring band center** isn't specified as fixed or random. Randomized per attempt (`0.3–0.7` of the ring's shrink progress) so the same variant doesn't always resolve at the same instant — resolution logic itself (`resolveCatch`) is unaffected either way.
- **"Species group" for breeding** (§4): read as same `speciesId` — two creatures of the identical species — the simplest reading and the genre norm. Cross-species breeding within a biome group is not supported in MVP.
- **Incubator slot-unlock costs** (§6) weren't given numeric values. Chose 500 coins for the 3rd slot, 20 gems for the 4th. `INCUBATOR_SLOT_3_COST_COINS` / `INCUBATOR_SLOT_4_COST_GEMS` in `src/data/economy.ts`.
- **Egg genetics are locked in at breeding time, not at hatch.** `Egg` carries the offspring's already-rolled `stats` and `variant`; hatching just materializes a `Creature` from them. This matches how real breeding games read ("what you bred" vs. "what you get when it happens to hatch") and avoids a second, redundant RNG roll.
- **Decoration effect** (§6: "unlock spawn rate / unlock new species pools"): shipped spawn-rate reduction only. Species-pool gating isn't implemented in MVP — all 12 species have always been spawnable since Phase 2 — so "unlock new species pools" has nothing to gate yet; revisit if/when species get locked behind biome progression.
- **Daily gift reward amounts and the upgrade's effect** (§5) weren't given numeric values, and "upgrade daily gift one rarity tier" wasn't specified as stacking or one-shot. Modeled as exactly two states per day: base (20 coins) and boosted (50 coins, after watching `dailyGiftUpgrade` once) — matching the placement's own 1/day cap, so there's nothing to stack.
- **IAP stub fulfillment** (§5: "UI + entitlement flags only, no store wiring"): tapping a stub buy button grants the entitlement (or gems, for the consumable packs) immediately — there's no real payment to gate on, so the stub simulates instant success rather than doing nothing. `priceLabel` is display-only.
- **Second-chance scope**: restricted to failed rare/shiny catches, per the placement's literal description ("retry a failed rare/shiny catch") — common/uncommon misses don't offer a retry.
- **Grove has no visual distinction between catchable wild spawns and already-owned residents** wasn't addressed by the spec, and real-device testing (post-Phase-4 Vercel deploy) showed it read as broken — some blobs tappable, some not, no indication why. Split the Grove into two explicitly labeled zones ("Wild — tap to catch!" / "Your Grove") with different background tints; wild spawns only ever appear in the wild zone, residents only in the resident zone, and each zone's wander tween is clamped so creatures can't drift across the divider.
- **Real creature art replaces the procedural placeholder sprites, but only one image per species — explicitly not per variant.** Product direction (owner call, not spec-derived): Uncommon/Rare/Shiny are distinguished by a small rarity-colored badge dot plus stats/catch difficulty, not separate art, to avoid a 4x asset burden for MVP. Shiny gets real distinct art in a later pass; for now it shares the base sprite + badge like Uncommon/Rare. `creatureTextureKey` takes a `speciesId`, not a `variant`, everywhere it's called. The Collection Book's "undiscovered" silhouette is now a true silhouette of the real sprite (via `setTintFill`, alpha-accurate) rather than a generic gray circle.
- **Grove and resident creatures no longer share one split screen.** Real-device feedback: once a player had caught more than a handful of creatures, the resident half of the split Grove view became visibly overcrowded (creatures overlapping in a cramped box) — splitting a screen in two doesn't scale with collection size. Wild catching now gets the full-screen Grove view (unchanged scene key, just expanded to fill the whole content area), and a new `Habitat` scene ("Your Grove" tab) shows every owned creature on a fixed, non-overlapping grid instead of free-roaming wander — grid cells never collide regardless of how large the collection grows, with a `+N more` fallback once the visible grid fills up. Habitat rebuilds fresh from the save every time it's opened rather than listening for a live "resident added" event, which also let the old cross-scene event plumbing (`resident-added`) be deleted entirely.
- **Progression layer (milestone gems, biome gating, daily quests/achievements) added post-launch, requiring a real v1→v2 save migration** — a live player save already exists in production, so (unlike earlier phases) new fields could not just assume a fresh save. `SaveDataV2` adds `lifetimeStats`, `claimedMilestones`, `claimedAchievements`, `unlockedBiomes`, `dailyQuests`. The v1→v2 migration backfills sensibly rather than penalizing existing progress: `lifetimeStats.totalCatches` is approximated from `creatures.length` (the exact catch/hatch split can't be reconstructed, and crediting existing progress avoids a felt regression), and `unlockedBiomes` retroactively includes every biome the player already owns a creature from (via species→biome lookup) so nobody who'd already ventured into Pond/Forest gets newly locked out — always including `meadow`. `totalHatches` backfills to 0 (no way to distinguish caught-vs-hatched retroactively; only affects the not-yet-existing hatch achievements going forward).
- **Milestone gem thresholds/rewards and biome unlock costs weren't spec'd numerically.** Chose milestone thresholds 25/50/75/100% collection completion paying 10/25/50/100 gems (`MILESTONE_THRESHOLDS`, `MILESTONE_GEM_REWARDS` in `src/data/economy.ts`), and biome unlock costs of 300 coins (Pond) / 700 coins (Forest), with Meadow free/default (`BIOME_UNLOCK_COST_COINS`). First tuning pass, expect to retune.
- **Daily quests are a fixed set of 3** (catch 3, hatch 1, watch 1 rewarded ad), not randomized/rotating — same rationale as the original fixed daily-quest design: keeps the reset-at-midnight logic and the player's mental model simple for MVP. Achievements are one-time, auto-granted (not manually claimed) via a shared `checkProgression()` check run after every catch, hatch, and biome unlock — since unlike quests they have no natural "claim" moment, granting immediately felt more correct than adding a claim button that just sits there already-complete.
- **Fixed a real pre-existing bug found while wiring the hatch-reveal progression messages**: `IncubatorScene`'s hatch reveal built its sprite via `creatureTextureKey(creature.variant)` instead of `creatureTextureKey(creature.speciesId)` — since texture keys are per-species, this looked up a nonexistent texture (e.g. `creature-common`) and would have rendered a blank/missing sprite on every hatch reveal. Caught via real-device-style Playwright verification, not by the unit suite (texture lookups aren't unit-testable without a Phaser scene).

## CHANGELOG

### Post-Phase-4 — progression: milestone gems, biome gating, daily quests & achievements
- Addressed real player feedback that the collection could be finished in ~5 minutes with nothing left to do. Added three progression systems together: **milestone gems** (25/50/75/100% collection completion pays out gems, one-time each), **biome gating** (Pond costs 300 coins, Forest costs 700 coins to unlock; Meadow is free/default — wild spawns, the Book, and the Shop all reflect gating), and **daily quests + achievements** (3 fixed daily quests — catch 3, hatch 1, watch 1 ad — plus 7 one-time auto-granted achievements spanning catch/hatch counts, biome unlocks, and owning a Shiny).
- New `SaveDataV2` schema (`lifetimeStats`, `claimedMilestones`, `claimedAchievements`, `unlockedBiomes`, `dailyQuests`) with a real v1→v2 migration — the first schema bump written against an actual live player save rather than assuming a fresh one. Verified via Playwright: injected a simulated pre-migration v1 save into a fresh browser context, confirmed the migrated save preserves coins/gems/creatures exactly, correctly backfills `lifetimeStats.totalCatches` and retroactively unlocks any biome the player already had creatures from, and initializes the new claim-tracking fields empty.
- New `core/quests.ts` (daily quest progress/claim/reset, mirroring the existing `AdState`/`DailyGiftState` local-midnight-reset pattern) and `core/achievements.ts` (`newlyCompletedAchievements` against a small `AchievementContext`), both pure and fully unit-tested. `services/progression.ts`'s `checkProgression()` is the single choke point that checks both milestones and achievements and grants rewards in one save update — called after a catch, a hatch, and a biome unlock.
- New `QuestsScene` ("📋" button in Grove's top bar) lists daily quest progress with claim buttons and a read-only achievements checklist. `GroveScene` and `IncubatorScene` show milestone/achievement toasts stacked above the existing catch-reward toast and double-catch-reward prompt.
- **Fixed a real bug found during verification**: the achievement/milestone toast and the double-catch-reward prompt both rendered at the same fixed y-position and visually overlapped on a catch that completed an achievement. Fixed by making the prompt's y-position account for however many progression toasts are already stacked above it.
- **Fixed a real pre-existing bug found while touching `IncubatorScene`**: the hatch-reveal sprite used `creatureTextureKey(creature.variant)` instead of `creatureTextureKey(creature.speciesId)`, which would have looked up a nonexistent texture and rendered blank on every hatch reveal.
- Verified in browser via Playwright: fresh saves start Meadow-only and wild spawns are correctly filtered to unlocked biomes; the migration path (above); catching a creature increments `lifetimeStats`/quest progress and grants the `first-catch` achievement with a correctly non-overlapping toast; the Shop's new Biomes section shows only locked biomes with correct afford/no-afford styling; the Book shows a 🔒 hint on species whose biome isn't unlocked yet. Vitest suite grew to 64 tests; `npx tsc -b` and `npm run build` stay clean.

### Post-Phase-4 — Grove/Habitat split
- The Grove no longer splits one screen between wild spawns and owned residents — wild catching gets the full-screen view, and a new `HabitatScene` ("Grove" tab) shows the whole collection instead.
- `HabitatScene` lays creatures out on a fixed grid (not free-roaming wander), so it never overlaps no matter how many creatures you've caught; beyond a screenful it shows a "+N more" count rather than degrading into visual noise. Empty state points new players back to the Wild.
- Removed the now-unneeded `resident-added` cross-scene event — Habitat just re-reads the save fresh every time it's opened.
- Verified in browser: Wild view fills the screen and still spawns/catches correctly; Habitat renders a clean non-overlapping grid for a 15-creature save and an empty-state message for a fresh one; back navigation returns to Wild correctly. `tsc -b`, Vitest (51 tests), and `npm run build` stay clean.

### Post-Phase-4 — real creature art
- Replaced the 4 procedurally-generated placeholder blob textures with 12 real illustrated sprites (one per species, AI-generated then background-removed and cropped from a reference sheet), loaded as static assets from `/public/creatures/*.png` and preloaded in `BootScene`.
- `creatureTextureKey(speciesId)` now returns one texture per species shared across all four rarity tiers — an explicit product call to skip a 48-image asset burden for MVP. Rarity instead shows via a small colored badge dot (blue/purple/gold for Uncommon/Rare/Shiny, no badge for Common) rendered in the Collection Book, plus the existing stat/catch-difficulty differences.
- The Book's undiscovered-cell silhouette is now the real sprite's exact alpha shape tinted flat gray (`Image.setTintFill`), not a generic circle — a straightforward win once real art existed to silhouette.
- Verified in browser: Grove wild spawns and residents render the correct species art and remain catchable/non-interactive as before; Book shows real art + badges for discovered cells and accurate silhouettes for undiscovered ones. `tsc -b`, Vitest (51 tests), and `npm run build` stay clean.

### Post-Phase-4 fix — hatch reveal
- Real-device feedback: tapping "Ready to hatch!" silently swapped the egg for a creature with zero feedback — no indication of what hatched. `IncubatorScene` now shows a full-screen reveal (sprite pop-in tween, species/variant, stats, tap-to-continue) before returning to the slot list.
- Guarded the existing 1s countdown-refresh timer so it only re-renders in the normal slot-list mode — otherwise it would have restarted the reveal's pop-in tween every second.
- Verified in browser: hatching shows the reveal with correct creature data, tapping anywhere dismisses back to the slot list, egg/creature counts update correctly. `tsc -b`, Vitest (51 tests), and `npm run build` stay clean.

### Post-Phase-4 fix — Grove wild/resident zone split
- First real-device (iPhone Safari, via the Vercel deploy) play session surfaced a genuine UX bug invisible in browser testing: wild spawns and already-caught residents wandered the same space with identical sprites, so "some creatures are tappable and some aren't" looked broken.
- `GroveScene` now renders two explicitly labeled, differently-tinted zones — "🌿 Wild — tap to catch!" and "🏡 Your Grove" — with wild spawns confined to one and residents to the other, and each zone's wander tween clamped so creatures can't drift across the divider.
- Verified in browser: wild-zone creatures still open the catch minigame; resident-zone creatures remain fully non-interactive; `tsc -b`, Vitest (51 tests), and `npm run build` all stay clean.

### Phase 4 — Economy + shop + rewarded ads (mock)
- `services/AdService.ts` + `MockAdService.ts`: rewarded-ad interface and a dev-only implementation — a plain DOM overlay (not a Phaser scene, since real ads cover the whole app) simulating a 3s skippable ad. `services/getAdService.ts` is the swap point for Phase 5's `AdMobService`.
- `services/rewardedAds.ts`: single `tryShowRewardedAd(placementId)` entry point every placement calls — resets per-day counters on a new local day, checks cap/cooldown, plays the ad, records the grant on success. All 5 placements route through it, so cap/cooldown logic lives in exactly one place.
- Wired all 5 rewarded placements: **double catch reward** (Grove, prompt after each catch), **instant hatch** (Incubator, skips an egg's remaining timer), **spawn surge** (Grove, forces 3 spawns bypassing the waiting-creature cap), **daily gift upgrade** (Shop), **second chance** (Catch, retry on a failed rare/shiny attempt only).
- `ShopScene`: daily gift (claim once/day, boosted by the upgrade ad), 3 decorations that reduce the average spawn interval (`applySpawnIntervalReduction`, floored so it can't approach zero), and the 5 IAP stubs (entitlement flags / gem grants, no real store wiring).
- **Fixed two real bugs found during verification, neither caught by the existing unit tests**:
  1. `canShowAd` never actually read a placement's own `cooldownMs` (only the blanket 60s global one) — so double-catch-reward's spec'd 90s cooldown was silently unenforced. Fixed by tracking `lastGrantedAt` per placement and checking its cooldown too; added a test asserting the two cooldowns are independent.
  2. In `CatchScene`, the second-chance retry prompt's 3s auto-dismiss timeout and the mock ad's ~3s duration raced: tapping "retry" started the ad but didn't cancel the pending timeout, so if the timeout fired first it stopped the scene as a failure even though the ad was about to resolve successfully moments later. Fixed by cancelling the timeout the instant the player taps the prompt. Caught by browser verification (`scene.isActive('Catch')` stayed false after a `watched=true` ad) — a case where only driving the real timing in a browser surfaces the race; a unit test with mocked timers would have hidden it.
- DoD verified in browser for every placement: correct reward on grant, correctly withheld when declined/on cooldown (confirmed the blanket 60s global cooldown blocking a second placement requested shortly after another), and the local-midnight day-key reset (already covered by `core/economy.test.ts`).
- Vitest suite grew to 51 tests; `npx tsc -b` and `npm run build` stay clean.

### Phase 3 — Collection + breeding UI
- `BookScene`: a 12-species × 4-variant grid, silhouette placeholder for undiscovered combos, discovered/total count and %. Discovery is derived straight from `save.creatures` — nothing is ever removed from that list in MVP scope (no selling), so "currently owned" and "ever discovered" are equivalent; no separate discovery log needed yet.
- `IncubatorScene`: lists incubating eggs with a live countdown (`hatchesAt`, real-time — survives closing the tab, not tied to a running timer), a pair-picker for empty slots restricted to same-species/off-cooldown creatures (`core/breeding.ts`'s new `canBreed`), and slot-unlock buttons (coins for the 3rd, gems for the 4th, capped at `INCUBATOR_MAX_SLOTS`). Hatching a ready egg creates the creature and pings `GroveScene` via a scene event so it appears wandering immediately, without needing a full reload.
- Grove's Book/Eggs tabs now launch these scenes (pause-and-resume, like the catch overlay) instead of toasting a stub; Shop stays a stub until Phase 4.
- **Fixed a real data-loss bug found during verification**: every scene was constructing its own `SaveManager`, each holding an independent in-memory copy of the whole save. Closing the tab (or navigating) fires `visibilitychange`/`beforeunload` on *every* scene's listener, including ones with a stale in-memory copy — whichever persisted last silently overwrote the others' writes. Concretely: breed a pair in the Incubator, then close the tab, and the new egg vanished because Grove's stale copy (loaded before the egg existed) won the race. Fixed by making `SaveManager` a module-level singleton (`getSaveManager()`) so every scene shares one in-memory copy and there's a single writer. All scenes updated; regression covered by the browser verification below (egg now survives a reload after being bred).
- DoD verified end-to-end in a real browser: catch a wild creature -> breed two owned creatures of the same species -> egg counts down and survives a reload -> hatch a ready egg -> Book reflects the newly discovered species/variant.
- Vitest suite grew to 45 tests (added `canBreed`); `npx tsc -b` and `npm run build` stay clean.

### Phase 2 — Grove + catching
- Phaser boots via `BootScene` (generates the placeholder creature textures) → `GroveScene`.
- `GroveScene`: diorama background, coin counter, Book/Shop/Eggs tab stubs (each toasts "arrives in a later phase" — those screens are Phase 3/4 scope), wild-creature spawning (60–120s cadence, capped at 5 waiting creatures whether accrued offline or live), and previously-caught creatures re-rendered wandering the Grove on load, per the §3 core loop ("creature wanders the Grove").
- `CatchScene`: the timing-ring minigame — a ring shrinks over `CATCH_RING_DURATION_MS`; tapping resolves through `core/catch.ts`'s `resolveCatch`, so the rendering layer holds zero pass/fail logic of its own.
- `services/SaveManager.ts`: localStorage-backed, built on `core/save.ts`'s `createDefaultSave`/`migrateSave`; persists on every state change plus on tab-hide/beforeunload so the offline-spawn catch-up has an accurate `lastOpenedAt`.
- Placeholder sprites: one generated texture per variant tier (colored blob + eyes), swappable later for a real atlas without touching call sites (`creatureTextureKey`).
- DoD verified in a real browser (Chromium via Playwright): spawns render and are catchable, a resolved catch persists coins + the creature, and reloading the tab restores exact state (verified both mid-session and via a fully offline-aged save). No console errors.
- Vitest suite grew to 41 tests (added `SaveManager`); `npx tsc -b` and `npm run build` stay clean.

### Phase 1 — Core logic (no rendering)
- Scaffolded the project on the spec's fixed stack: Vite + TypeScript + Phaser 3 (Capacitor deferred to Phase 5), with the required `/src/core`, `/src/game`, `/src/services`, `/src/data` split.
- Removed the previous "Critter Ranch" vanilla-JS prototype that occupied this repo — different stack, different scope; this build starts fresh per this spec.
- `/src/core`: seedable RNG (`rng.ts`), creature model (`creature.ts`), catch resolution (`catch.ts`), breeding/inheritance (`breeding.ts`), economy (`economy.ts`), save schema v1 + migration scaffold (`save.ts`).
- `/src/data`: 12 MVP species across Meadow/Pond/Forest (`species.ts`), all tunable economy constants (`economy.ts`) — rarity odds, catch band widths, egg timers, inheritance/mutation/variant-upgrade rates, breeding cooldown, passive income rate, ad placement caps/cooldowns.
- Vitest suite: 38 tests across 6 files, including the required 10,000-roll breeding distribution tests (stat inheritance split, mutation rate, variant upgrade rate) — all within 2% of spec.
- DoD met: `npm test` passes; `npx tsc -b` and `npm run build` are clean.
