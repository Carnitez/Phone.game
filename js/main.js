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
      } else if (ev.type === "expedition") {
        if (ev.success) {
          toast(`${ev.ico} ${ev.site}: success! +🪙 ${fmt(ev.coins)}${ev.net ? ` +${NETS[ev.net].ico} net` : ""}`, "good");
          sfxPlay("success");
        } else {
          toast(`${ev.ico} ${ev.site}: failed… +🪙 ${fmt(ev.coins)} salvage. The team needs rest.`, "bad");
          sfxPlay("fail");
        }
        flashCoins();
      } else if (ev.type === "achievement") {
        toast(`🏆 ${ev.achievement.name}! +🪙 ${fmt(ev.achievement.reward)}`, "good");
        sfxPlay("unlock");
        flashCoins();
      } else if (ev.type === "daily") {
        toast(`🌅 Daily bonus: +🪙 ${fmt(ev.coins)} +🕸️ net — the trader has new stock!`, "good");
        sfxPlay("coin");
        flashCoins();
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
