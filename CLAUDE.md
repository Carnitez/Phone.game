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

## CHANGELOG

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
