/* ── Critter Ranch: sound & haptics (WebAudio synth, no assets) ── */

let _audioCtx = null;

function audioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!_audioCtx) _audioCtx = new AC();
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

// Browsers only allow audio after a user gesture — warm the context up early.
document.addEventListener("pointerdown", () => audioCtx(), { passive: true });

function soundOn() {
  return typeof state !== "undefined" && state && state.sound !== false;
}

function tone(freq, dur, type = "sine", gain = 0.06, delay = 0, slideTo = 0) {
  if (!soundOn()) return;
  const c = audioCtx();
  if (!c) return;
  try {
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  } catch (e) { /* audio is decoration, never break the game over it */ }
}

function buzz(pattern) {
  if (!soundOn()) return;
  if (navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {}
}

const SFX = {
  tap()      { tone(540, 0.05, "square", 0.025); buzz(8); },
  reveal()   { tone(660, 0.08, "triangle", 0.06); tone(880, 0.1, "triangle", 0.06, 0.06); buzz(15); },
  throwNet() { tone(280, 0.22, "sawtooth", 0.04, 0, 900); },
  success()  { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, "triangle", 0.07, i * 0.07)); buzz([25, 35, 45]); },
  fail()     { tone(240, 0.28, "sawtooth", 0.05, 0, 130); buzz(70); },
  coin()     { tone(990, 0.08, "triangle", 0.07); tone(1480, 0.12, "triangle", 0.07, 0.06); buzz(12); },
  care()     { tone(700, 0.07, "sine", 0.06); tone(940, 0.1, "sine", 0.06, 0.06); buzz(15); },
  pair()     { tone(440, 0.12, "sine", 0.05); tone(554, 0.16, "sine", 0.05, 0.1); },
  crack()    { tone(150, 0.06, "square", 0.07); tone(120, 0.06, "square", 0.07, 0.09); },
  hatch()    { [880, 1175, 1568].forEach((f, i) => tone(f, 0.1, "triangle", 0.07, 0.1 + i * 0.09)); buzz([20, 30, 20, 30, 50]); },
  mutation() { [1568, 1976, 2349, 3136].forEach((f, i) => tone(f, 0.12, "sine", 0.06, i * 0.06)); buzz([15, 20, 15, 20, 15, 20]); },
  unlock()   { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.07, i * 0.09)); buzz([30, 40, 60]); },
  error()    { tone(160, 0.12, "square", 0.04); buzz(40); },
  forage()   { tone(420, 0.06, "triangle", 0.05); },
};

function sfxPlay(name) {
  if (SFX[name]) SFX[name]();
}

function screenShake() {
  document.body.classList.remove("shake");
  void document.body.offsetWidth;
  document.body.classList.add("shake");
  setTimeout(() => document.body.classList.remove("shake"), 400);
}
