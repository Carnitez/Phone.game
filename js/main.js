/* ── Critter Ranch: boot ───────────────────────────────────── */

(function boot() {
  if (!load()) newGame();

  bindEvents();
  setTab("ranch");

  // Main loop: 1s tick advances pairs/eggs/markets and re-renders.
  setInterval(() => {
    const events = tick();
    for (const ev of events) {
      if (ev.type === "hatch") {
        const c = ev.child;
        const muts = (c.newMutations || []).length;
        toast(
          `🐣 ${c.name} hatched! Lv ${creatureLevel(c)}` +
          (muts ? ` — ${muts} MUTATION${muts > 1 ? "S" : ""}! 🧬✨` : ""),
          muts ? "good" : ""
        );
      } else if (ev.type === "egg") {
        toast("🥚 An egg appeared!", "good");
      }
    }
    render();
  }, 1000);

  // Catch up instantly when returning to the app.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) { tick(); render(); }
  });
})();
