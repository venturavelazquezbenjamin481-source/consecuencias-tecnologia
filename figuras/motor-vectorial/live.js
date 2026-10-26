const DATA = __DATA__;
const stage = document.querySelector(".tv-stage");
const readout = document.querySelector("[data-readout]");
const actLayer = stage.querySelector(".tv-acts");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const M = DATA.model;
const P = DATA.P;
const K = { solidSvg, lineSvg, dotsSvg, fadedSvg, iso };
const D2R = Math.PI / 180;
// Hacia dónde se mueve la salida de la tobera con cada eje positivo
const DIRP = [-DATA.A1[1], DATA.A1[0]];
const DIRQ = [-DATA.A2[1], DATA.A2[0]];
const REST = { A: Math.hypot(...DATA.L0.A.map((v, i) => v - DATA.U.A[i])), B: Math.hypot(...DATA.L0.B.map((v, i) => v - DATA.U.B[i])) };

const servo = { p: { x: 0, v: 0 }, q: { x: 0, v: 0 } };
let cmd = { p: 0, q: 0 };
let firing = false;
let touring = !still.matches;
let tourClock = 0;
let idle = 0;
let frame = 0;
let last = 0;
let visible = false;
let drawn = null;

const clampCone = (p, q) => {
  const m = Math.hypot(p, q);
  return m > M.limit ? [(p * M.limit) / m, (q * M.limit) / m] : [p, q];
};
// Recorrido de demostración: dos vueltas de cono, cuatro escalones y reposo
const TOUR = 26;
function tourAt(t) {
  t %= TOUR;
  if (t < 12) {
    const a = (t / 6) * Math.PI * 2;
    const r = 5 * Math.min(1, t / 1.2) * Math.min(1, (12 - t) / 1.2);
    return [r * Math.cos(a), r * Math.sin(a)];
  }
  const steps = [[5, 0], [-5, 0], [0, 5], [0, -5], [0, 0]];
  const i = Math.min(steps.length - 1, Math.floor((t - 12) / 2.4));
  return steps[i];
}
const hold = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    tourClock = 0;
    run();
  }, 5000);
};

const controller = TURN.mount(stage, DATA.turn, { follow: (v) => v, onHold: () => hold() });

function stroke(id) {
  const L = controller.anchor("yaw", DATA.L0[id]).world;
  const U = DATA.U[id];
  return { L, mm: (Math.hypot(L[0] - U[0], L[1] - U[1], L[2] - U[2]) - REST[id]) * 10 };
}
const signed = (v, digits = 0) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(digits);
function draw() {
  const p = servo.p.x;
  const q = servo.q.x;
  controller.set({ pitch: p, yaw: q });
  const a = stroke("A");
  const b = stroke("B");
  actLayer.innerHTML = actuatorSvg(G, K, P, DATA.U.A, a.L, DATA.SIDE.A, "A") + actuatorSvg(G, K, P, DATA.U.B, b.L, DATA.SIDE.B, "B");
  // ángulo total entre el eje del motor y la vertical
  const e = controller.anchor("yaw", DATA.GC, [0, 0, -1]).direction;
  const delta = Math.acos(Math.min(1, -e[2])) / D2R;
  const side = firing ? M.thrustKN * Math.sin(delta * D2R) : 0;
  const text = `δ ${delta.toFixed(1)}° · ${firing ? `lateral ${side.toFixed(1)} kN` : "frío"} · A ${signed(a.mm)} mm · B ${signed(b.mm)} mm`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
  drawn = [p, q];
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    const [tp, tq] = tourAt(tourClock);
    cmd = { p: tp, q: tq };
  }
  let moving = false;
  for (const axis of ["p", "q"]) {
    const s = servo[axis];
    if (calm) {
      s.x = cmd[axis];
      s.v = 0;
      continue;
    }
    for (let i = 0; i < 4; i++) {
      const acc = M.omega * M.omega * (cmd[axis] - s.x) - 2 * M.zeta * M.omega * s.v;
      s.v = Math.max(-M.rate, Math.min(M.rate, s.v + (acc * dt) / 4));
      s.x += (s.v * dt) / 4;
    }
    if (Math.abs(cmd[axis] - s.x) < 1e-4 && Math.abs(s.v) < 1e-3) {
      s.x = cmd[axis];
      s.v = 0;
    } else moving = true;
  }
  if (moving || !drawn || drawn[0] !== servo.p.x || drawn[1] !== servo.q.x) draw();
  frame = visible && (moving || touring) ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);

// Puntero: la salida de la tobera apunta hacia él
const exit = iso([0, 0, DATA.GC[2] - DATA.exitS], P);
const cam = { sinA: Math.sin((P.azimuth * Math.PI) / 180), cosA: Math.cos((P.azimuth * Math.PI) / 180), sinE: Math.sin((P.elevation * Math.PI) / 180) };
stage.addEventListener("pointermove", (event) => {
  const box = stage.getBoundingClientRect();
  const vx = ((event.clientX - box.left) / box.width) * DATA.W - exit[0];
  const vy = ((event.clientY - box.top) / box.height) * DATA.H - exit[1];
  const a = vx / P.scale;
  const b = vy / (P.scale * cam.sinE);
  const fx = a * cam.sinA + b * cam.cosA;
  const fy = -a * cam.cosA + b * cam.sinA;
  const reach = Math.hypot(fx, fy);
  if (reach < 1e-6) return;
  const delta = M.limit * Math.min(1, reach / 160);
  const [p, q] = clampCone(delta * ((fx * DIRP[0] + fy * DIRP[1]) / reach), delta * ((fx * DIRQ[0] + fy * DIRQ[1]) / reach));
  cmd = { p, q };
  hold();
  run();
});
stage.addEventListener("pointerleave", () => {
  cmd = { p: 0, q: 0 };
  hold();
  run();
});
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 3 : 1;
  let { p, q } = cmd;
  if (event.key === "i" || event.key === "I") {
    firing = !firing;
    draw();
    return;
  }
  if (event.key === "ArrowUp") p += step;
  else if (event.key === "ArrowDown") p -= step;
  else if (event.key === "ArrowRight") q += step;
  else if (event.key === "ArrowLeft") q -= step;
  else if (event.key === "Escape" || event.key === "Home") p = q = 0;
  else return;
  event.preventDefault();
  [p, q] = clampCone(p, q);
  cmd = { p, q };
  hold();
  run();
});
if (still.matches) touring = false;
draw();
