/* ── Critter Ranch: boot ───────────────────────────────────── */

(function boot() {
  if (!load()) newGame();

  bindEvents();
  setTab("ranch");

  // Main loop: 1s tick advances pairs/eggs/markets; tickUpdate refreshes
  // timers in place and re-renders only on structural changes.
  setInterval(() => {
    const events = tick();
    for (const ev of events) {
      if (ev.type === "hatch") {
        queueHatch(ev.child);
      } else if (ev.type === "egg") {
        toast("🥚 An egg appeared!", "good");
        sfxPlay("pair");
      }
    }
    tickUpdate();
  }, 1000);

  // Catch up instantly when returning to the app.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      const events = tick();
      for (const ev of events) {
        if (ev.type === "hatch") queueHatch(ev.child);
      }
      render();
    }
  });
})();
