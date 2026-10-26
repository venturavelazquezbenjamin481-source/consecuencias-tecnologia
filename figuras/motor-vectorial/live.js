const DATA = __DATA__;
const stage = document.querySelector(".tv-stage");
const readout = document.querySelector("[data-readout]");
const actLayer = stage.querySelector(".tv-acts");
const fireButton = document.querySelector("[data-fire]");
const fireLabel = document.querySelector("[data-fire-label]");
const apartButton = document.querySelector("[data-apart]");
const apartLabel = document.querySelector("[data-apart-label]");
const partButtons = [...document.querySelectorAll("[data-part]")];
const infoTitle = document.querySelector("[data-info-title]");
const infoText = document.querySelector("[data-info-text]");
const INFO_REST = { title: infoTitle.textContent, text: infoText.textContent };
const liveText = document.querySelector("[data-say]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const M = DATA.model;
const P = DATA.P;
const K = { solidSvg, lineSvg, dotsSvg, fadedSvg, iso };
const D2R = Math.PI / 180;
const LIGHT = (stage.closest("[data-theme]")?.getAttribute("data-theme") ?? "dark") !== "dark" ? 1 : 0;
// Hacia dónde se mueve la salida de la tobera con cada eje positivo
const DIRP = [-DATA.A1[1], DATA.A1[0]];
const DIRQ = [-DATA.A2[1], DATA.A2[0]];
const REST = { A: Math.hypot(...DATA.L0.A.map((v, i) => v - DATA.U.A[i])), B: Math.hypot(...DATA.L0.B.map((v, i) => v - DATA.U.B[i])) };
const EXIT = [0, 0, DATA.GC[2] - DATA.exitS];

const servo = { p: { x: 0, v: 0 }, q: { x: 0, v: 0 } };
let cmd = { p: 0, q: 0 };
// Combustión: `on` es la orden; pc (presión de cámara 0…1) sube y baja en un muelle crítico
const burn = { on: false, t: 0, pc: { x: 0, v: 0 }, flash: -1, tour: false };
let touring = !still.matches;
let tourClock = 0;
let idle = 0;
let frame = 0;
let last = 0;
let visible = false;
let drawn = null;
let clock = 0;

const clampCone = (p, q) => {
  const m = Math.hypot(p, q);
  return m > M.limit ? [(p * M.limit) / m, (q * M.limit) / m] : [p, q];
};
// Recorrido: encendido, dos vueltas de cono, cuatro escalones, apagado, y luego la anatomía:
// despiece y cada conjunto resaltado por turno, antes de volver a montar
const ANATOMY_AT = 27;
const PART_TIME = 2.8;
const TOUR = ANATOMY_AT + 1.4 + DATA.assemblies.length * PART_TIME + 3;
function tourAt(t) {
  t %= TOUR;
  const fire = t > 0.8 && t < 25;
  const along = t - ANATOMY_AT - 1.4;
  const apartOn = t > ANATOMY_AT && along < DATA.assemblies.length * PART_TIME;
  const part = apartOn && along >= 0 ? DATA.assemblies[Math.min(DATA.assemblies.length - 1, Math.floor(along / PART_TIME))].id : null;
  let p = 0;
  let q = 0;
  if (t > 3 && t < 15) {
    const a = ((t - 3) / 6) * Math.PI * 2;
    const r = 5 * Math.min(1, (t - 3) / 1.2) * Math.min(1, (15 - t) / 1.2);
    p = r * Math.cos(a);
    q = r * Math.sin(a);
  } else if (t >= 15 && t < 24.6) {
    [p, q] = [[5, 0], [-5, 0], [0, 5], [0, -5]][Math.min(3, Math.floor((t - 15) / 2.4))];
  }
  return { p, q, fire, apart: apartOn, part };
}
const hold = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    // el recorrido retoma desde donde coincide con el motor: encendido, despiezado o en frío
    tourClock = apart.on ? ANATOMY_AT + 1.4 : burn.on ? 1 : 0;
    run();
  }, 6000);
};
const say = (text) => {
  if (liveText && liveText.textContent !== text) liveText.textContent = text;
};
function setFire(on) {
  if (burn.on === on) return;
  burn.on = on;
  if (on) burn.flash = 0;
  fireButton.toggleAttribute("data-on", on);
  fireLabel.textContent = on ? "Apagar" : "Encender";
  say(on ? "encendido" : "apagado");
}

// ───────────── Despiece y selección ─────────────
const EX = DATA.explode;
const apart = { on: false, waiting: false, clock: 0, groups: Object.fromEntries(EX.order.map((id) => [id, { from: 0, to: 0, start: -1e9 }])) };
let focus = null;
let pinned = null;
const shareOf = (id) => {
  const g = apart.groups[id];
  return g.from + (g.to - g.from) * springStep(apart.clock - g.start, EX.omega);
};
const exploding = () => EX.order.some((id) => apart.clock - apart.groups[id].start < 2 && apart.groups[id].from !== apart.groups[id].to);
// Cada conjunto sale en su turno (y vuelve en el orden inverso) desde donde esté
function launch(open) {
  const n = EX.order.length;
  EX.order.forEach((id, i) => {
    const g = apart.groups[id];
    g.from = shareOf(id);
    g.to = open ? 1 : 0;
    g.start = still.matches ? -1e9 : apart.clock + (open ? i : n - 1 - i) * EX.stagger;
    if (still.matches) g.from = g.to;
  });
  apart.waiting = false;
}
function setApart(on) {
  if (apart.on === on) return;
  apart.on = on;
  if (on) {
    setFire(false);
    cmd = { p: 0, q: 0 };
    apart.waiting = true;
  } else {
    apart.waiting = false;
    launch(false);
    select(null);
    pinned = null;
  }
  apartButton.toggleAttribute("data-on", on);
  apartLabel.textContent = on ? "Montar" : "Despiezar";
  stage.toggleAttribute("data-apart", on);
  say(on ? "despiece" : "montado");
}
function select(id) {
  if (focus === id) return;
  focus = id;
  for (const el of document.querySelectorAll(".tv-stage")) {
    if (id) el.setAttribute("data-focus", id);
    else el.removeAttribute("data-focus");
  }
  partButtons.forEach((button) => button.toggleAttribute("data-on", button.dataset.part === id));
  const a = DATA.assemblies.find((entry) => entry.id === id);
  infoTitle.textContent = a ? `${String(DATA.assemblies.indexOf(a) + 1).padStart(2, "0")} · ${a.name}` : INFO_REST.title;
  infoText.textContent = a ? a.text : INFO_REST.text;
}

const controller = TURN.mount(stage, DATA.turn, { follow: (v) => v, onHold: () => hold() });

// ───────────── Pluma ─────────────
const PLUME = `
uniform vec3 uExit;
uniform vec3 uDir;
uniform float uPc;
uniform float uFlash;
uniform float uLight;
const float R0=${DATA.exitR.toFixed(2)};
const float LP=150.;
const vec4 PIT=vec4(${DATA.pit.map((v) => v.toFixed(1)).join(",")});
const vec4 DECK=vec4(${DATA.deck.map((v) => v.toFixed(1)).join(",")});
const float PITD=${DATA.pitD.toFixed(1)};
vec4 over(vec4 top,vec4 under){return top+under*(1.-top.a);}
vec4 inkFor(vec3 seen,float cover){vec3 absorbed=1.-seen;float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);return vec4(vec3(a)-absorbed,a);}
float boxMask(vec2 p,vec4 b,float soft){return window(p.x,b.x,b.z,soft)*window(p.y,b.y,b.w,soft);}
float radiusAt(float s){return R0*(1.-.12*smoothstep(0.,40.,s))+.11*max(s-30.,0.)*smoothstep(20.,90.,s);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 g0=rayOf(vb);
  float T=uTime;
  float pc=clamp(uPc,0.,1.);
  float dith=hash12(gl_FragCoord.xy);
  vec3 d=normalize(uDir);
  // tramo del rayo dentro del cilindro que acota la pluma
  float RB=R0*1.9+.2*LP;
  vec3 w0=g0-uExit;
  vec3 a=V-dot(V,d)*d;
  vec3 b=w0-dot(w0,d)*d;
  float A=dot(a,a);
  float B=dot(b,a);
  float C=dot(b,b)-RB*RB;
  float disc=B*B-A*C;
  vec3 hot=vec3(0.);
  vec3 soot=vec3(0.);
  float core=0.;
  float diamonds=0.;
  if(disc>0.&&pc>.0004){
    float sq=sqrt(disc);
    float ta=(-B-sq)/A;
    float tb=(-B+sq)/A;
    // y entre los planos s=-2 y s=LP+10
    float vd=dot(V,d);
    float s0=dot(w0,d);
    float t1=(-2.-s0)/vd;
    float t2=(LP+10.-s0)/vd;
    ta=max(ta,min(t1,t2));
    tb=min(tb,max(t1,t2));
    float dt=max(tb-ta,0.)/32.;
    float lam=27.;
    for(int i=0;i<32;i++){
      float t=ta+(float(i)+dith)*dt;
      vec3 p=g0+t*V;
      vec3 q=p-uExit;
      float s=dot(q,d);
      float r=length(q-s*d);
      float R=radiusAt(s);
      float n1=fbm3(vec3(q.xy*.05,s*.045-T*4.2));
      float n2=noise3(vec3(q.xy*.16+3.,s*.13-T*9.1));
      float Re=R*(1.+(n1-.5)*.45*smoothstep(10.,120.,s)+(n2-.5)*.12);
      float rn=r/Re;
      float along=smoothstep(-2.,3.,s)*(1.-smoothstep(LP*.62,LP,s));
      float body=smoothstep(1.02,.8,rn)*along;
      float w=dt*sqrt(A)/(2.*Re);
      hot+=mix(vec3(1.,.66,.2),vec3(1.,.42,.08),smoothstep(20.,120.,s))*body*w*(.7+1.1*exp(-max(s,0.)/55.))*(.75+.5*n2);
      soot+=vec3(1.)*smoothstep(1.2,.7,rn)*smoothstep(30.,110.,s)*(1.-smoothstep(LP*.75,LP+8.,s))*w*(.6+.8*n1);
      float rc=R*.38;
      core+=exp(-r*r/(rc*rc))*exp(-max(s,0.)/45.)*(dt*sqrt(A)/(rc*1.772))*smoothstep(-2.,2.,s);
      for(int c=0;c<3;c++){
        float vc=16.+float(c)*lam;
        float ph=(s-vc)/(lam*.6);
        float tp=R0*.2*(1.05-clamp(ph,0.,1.)*.8)+.6;
        diamonds+=exp(-pow(r/tp,2.)*2.)*exp(-max(ph,0.)*2.4)*smoothstep(-.18,.02,ph)*(1.-smoothstep(.7,1.,ph))*(dt*sqrt(A)/(tp*1.25))*exp(-float(c)*.45);
      }
    }
  }
  // luz sobre la losa y el fondo del foso, alrededor del punto donde apunta el chorro
  vec3 hitD=uExit+d*((uExit.z-0.)/max(-d.z,.2));
  vec3 pd=onFloor(vb,0.);
  float inPit=boxMask(pd.xy,PIT,.4);
  vec3 pf=onFloor(vb,-PITD);
  float onPitFloor=inPit*boxMask(pf.xy,PIT+vec4(4.,4.,-4.,-4.),.6);
  float onDeck=(1.-inPit)*boxMask(pd.xy,DECK+vec4(6.,6.,-6.,-6.),2.);
  float rd=length(pd.xy-hitD.xy);
  vec3 hitP=uExit+d*((uExit.z+PITD)/max(-d.z,.2));
  float rp=length(pf.xy-hitP.xy);
  float floorLight=(onDeck*exp(-pow(rd/110.,2.))*.55+onPitFloor*exp(-pow(rp/60.,2.))*1.2)*pc;
  vec3 dark=hot*2.1*pc+vec3(1.,.9,.68)*core*1.1*pc+vec3(1.,.97,.9)*diamonds*4.5*pc*smoothstep(.5,.95,pc)+vec3(1.,.5,.15)*floorLight*.5+vec3(1.,.82,.6)*uFlash*exp(-pow(length(vb-project(uExit+d*R0*.35))/(R0*uK*.75),2.))*.45;
  dark=tonemap(dark,1.);
  float m=max(dark.r,max(dark.g,dark.b));
  vec4 darkInk=vec4(dark,m);
  // papel: cuerpo naranja saturado, núcleo pálido junto a la tobera, hollín gris en los bordes
  float e=1.-exp(-2.2*(length(hot)*.9+core*.6)*pc);
  vec3 seen=mix(vec3(1.),vec3(1.,.6,.14),smoothstep(0.,.42,e));
  seen=mix(seen,vec3(1.,.84,.34),smoothstep(.4,.78,e));
  seen=mix(seen,vec3(1.,.98,.9),smoothstep(.7,.95,core*pc));
  float lens=min(diamonds*pc*smoothstep(.5,.95,pc),1.);
  seen=mix(seen,vec3(1.,.97,.86),lens*.75);
  vec4 flame=inkFor(seen,.9*smoothstep(.55,.9,e));
  float sootA=(1.-exp(-1.2*length(soot)*pc))*.45;
  vec4 smoke=vec4(vec3(.42,.38,.35)*sootA,sootA);
  vec4 tint=inkFor(mix(vec3(1.),vec3(1.,.74,.46),min(floorLight*.75,.7)),0.);
  vec4 lightInk=over(flame,over(smoke,tint));
  vec4 ink=mix(darkInk,lightInk,uLight);
  ink.rgb=min(ink.rgb,vec3(ink.a));
  float nz=(hash12(gl_FragCoord.xy+fract(T*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(T*.37)*57.)-1.)/255.;
  gl_FragColor=clamp(ink+vec4(nz)*smoothstep(0.,1.5/255.,ink.a),0.,1.);
}`;
const plume = glLayer({ canvas: stage.querySelector(".tv-plume"), fragment: PLUME, view: [DATA.W, DATA.H], camera: DATA.camera, uniforms: ["uExit", "uDir", "uPc", "uFlash"], fixed: { uLight: LIGHT } });
if (plume) stage.setAttribute("data-gl", "");
let plumeLive = false;
// Respaldo sin WebGL: la silueta de la pluma con un degradado, en el mismo eje
const fbPath = stage.querySelector(".tv-fb-plume");
const fbGrad = stage.querySelector("#tv-fb");
function paintFallback() {
  const pc = burn.pc.x;
  if (pc < 1e-3) {
    fbPath.setAttribute("d", "");
    return;
  }
  const exit = controller.anchor("nozzle", EXIT, [0, 0, -1]);
  const d = exit.direction;
  const F = G.frameAlong(exit.world, d);
  const pts = [];
  for (const [s, r] of [[0, DATA.exitR * 0.98], [60, DATA.exitR * 0.9 + 3], [120, DATA.exitR * 0.88 + 9]]) for (let i = 0; i < 24; i++) pts.push(iso(G.pointOf(F, s * pc, r, (i / 24) * Math.PI * 2), P));
  fbPath.setAttribute("d", pathOf(G.hullOf(pts), true));
  const a = iso(exit.world, P);
  const b = iso(G.add3(exit.world, G.mul3(d, 125 * pc)), P);
  fbGrad.setAttribute("x1", a[0].toFixed(1));
  fbGrad.setAttribute("y1", a[1].toFixed(1));
  fbGrad.setAttribute("x2", b[0].toFixed(1));
  fbGrad.setAttribute("y2", b[1].toFixed(1));
  fbPath.style.opacity = String(pc);
}
function paintPlume() {
  if (!plume) return paintFallback();
  const pc = burn.pc.x;
  const flash = burn.flash >= 0 && !still.matches ? burst(burn.flash, 0.06, 0.2) : 0;
  if (pc < 1e-3 && flash < 1e-3) {
    if (plumeLive) plume.clear();
    plumeLive = false;
    return;
  }
  const exit = controller.anchor("nozzle", EXIT, [0, 0, -1]);
  plume.draw({ uExit: exit.world, uDir: exit.direction, uPc: pc, uFlash: flash }, still.matches ? 0.8 : clock);
  plumeLive = true;
}

// ───────────── Dibujo ─────────────
function stroke(id) {
  const L = controller.anchor("yaw", DATA.L0[id]).world;
  const U = DATA.U[id];
  return { L, mm: (Math.hypot(L[0] - U[0], L[1] - U[1], L[2] - U[2]) - REST[id]) * 10 };
}
const signed = (v, digits = 0) => (Math.abs(v) < 0.5 * 10 ** -digits ? "±" : v > 0 ? "+" : "−") + Math.abs(v).toFixed(digits);
function draw() {
  const p = servo.p.x;
  const q = servo.q.x;
  const slides = slidesOf(Object.fromEntries(EX.order.map((id) => [id, shareOf(id)])), EX);
  controller.set({ pitch: p, yaw: q, ...slides });
  const a = stroke("A");
  const b = stroke("B");
  const up = controller.anchor("yaw", DATA.GC, [0, 0, 1]).direction;
  const feed = (id, opts) => bellowsSvg(G, K, P, DATA.FEEDS[id].top, controller.anchor("yaw", DATA.FEEDS[id].bottom).world, up, id, opts);
  actLayer.innerHTML = feed("lox", {}) + feed("fuel", { r: 5, core: 3.4, count: 14 }) + actuatorSvg(G, K, P, DATA.U.A, a.L, DATA.SIDE.A, "A") + actuatorSvg(G, K, P, DATA.U.B, b.L, DATA.SIDE.B, "B");
  // ángulo total entre el eje del motor y la vertical
  const delta = Math.acos(Math.min(1, up[2])) / D2R;
  const thrust = M.thrustKN * burn.pc.x;
  const side = thrust * Math.sin(delta * D2R);
  const state = burn.pc.x > 0.02 ? `${side.toFixed(1)} kN lateral` : "frío";
  const opened = EX.order.some((id) => shareOf(id) > 0.01);
  const named = DATA.assemblies.find((entry) => entry.id === focus);
  const text = opened || apart.on ? `despiece · ${named ? named.name.toLowerCase() : "elige un conjunto"}` : `δ ${delta.toFixed(1)}° · ${state} · A ${signed(a.mm)} · B ${signed(b.mm)} mm`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", `${text}${burn.pc.x > 0.02 ? ` · par sobre el vehículo ${(side * M.leverM).toFixed(0)} kN·m` : ""}`);
  drawn = [p, q];
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    const step = tourAt(tourClock);
    if (!step.apart) cmd = { p: step.p, q: step.q };
    setApart(step.apart);
    if (step.apart) select(step.part);
    setFire(step.fire && !step.apart);
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
  apart.clock += dt;
  if (apart.waiting && Math.abs(servo.p.x) < 0.05 && Math.abs(servo.q.x) < 0.05) launch(true);
  const parting = apart.waiting || exploding();
  if (parting) moving = true;
  const pcBefore = burn.pc.x;
  const burning = settle(burn.pc, burn.on ? 1 : 0, dt, burn.on ? 0.18 : 0.22, calm);
  if (burn.flash >= 0) burn.flash += dt;
  if (burn.flash > 1.5) burn.flash = -1;
  if (moving || burning || pcBefore !== burn.pc.x || !drawn || drawn[0] !== servo.p.x || drawn[1] !== servo.q.x) draw();
  paintPlume();
  const flame = plume && burn.pc.x > 1e-3 && !calm;
  frame = visible && (moving || touring || burning || flame || burn.flash >= 0) ? requestAnimationFrame(tick) : 0;
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
addEventListener("resize", () => paintPlume());

// Puntero: la salida de la tobera apunta hacia él
const exitScreen = iso(EXIT, P);
const cam = { sinA: Math.sin((P.azimuth * Math.PI) / 180), cosA: Math.cos((P.azimuth * Math.PI) / 180), sinE: Math.sin((P.elevation * Math.PI) / 180) };
stage.addEventListener("pointermove", (event) => {
  if (apart.on) return;
  const box = stage.getBoundingClientRect();
  const vx = ((event.clientX - box.left) / box.width) * DATA.W - exitScreen[0];
  const vy = ((event.clientY - box.top) / box.height) * DATA.H - exitScreen[1];
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
const toggleFire = () => {
  hold();
  if (apart.on) setApart(false);
  setFire(!burn.on);
  run();
};
const toggleApart = () => {
  hold();
  setApart(!apart.on);
  run();
};
apartButton.addEventListener("click", toggleApart);
const choose = (id, pin) => {
  hold();
  setApart(true);
  if (pin !== undefined) pinned = pin;
  select(id);
  run();
};
partButtons.forEach((button) => {
  const id = button.dataset.part;
  button.addEventListener("pointerenter", () => choose(id));
  button.addEventListener("focus", () => choose(id));
  button.addEventListener("pointerleave", () => {
    if (pinned !== id) select(pinned);
  });
  button.addEventListener("click", () => choose(pinned === id ? null : id, pinned === id ? null : id));
});
fireButton.addEventListener("click", toggleFire);
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 3 : 1;
  let { p, q } = cmd;
  if (event.key === "i" || event.key === "I") {
    event.preventDefault();
    toggleFire();
    return;
  }
  if (event.key === "d" || event.key === "D") {
    event.preventDefault();
    toggleApart();
    return;
  }
  const digit = Number(event.key);
  if (Number.isInteger(digit) && digit >= 1 && digit <= DATA.assemblies.length) {
    event.preventDefault();
    const id = DATA.assemblies[digit - 1].id;
    choose(id, id);
    return;
  }
  if (event.key === "Escape" && apart.on) {
    event.preventDefault();
    hold();
    setApart(false);
    run();
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
// Gancho para las pruebas: fija ángulos y potencia sin esperar a las envolventes
window.__tv = {
  set(p, q, pc = burn.pc.x) {
    touring = false;
    clearTimeout(idle);
    cmd = { p, q };
    servo.p = { x: p, v: 0 };
    servo.q = { x: q, v: 0 };
    burn.on = pc > 0;
    burn.pc = { x: pc, v: 0 };
    burn.flash = -1;
    fireButton.toggleAttribute("data-on", burn.on);
    fireLabel.textContent = burn.on ? "Apagar" : "Encender";
    draw();
    paintPlume();
  },
};

// ───────────── Fig. 2: sonda a lo largo del eje ─────────────
const cut = document.querySelector(".tv-cut");
const probe = cut.querySelector(".tv-probe");
const readout2 = document.querySelector("[data-readout2]");
const CD = DATA.cut;
const P2 = CD.P;
const F2 = G.frameOf([0, 0, CD.Z0], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
const gasAt = (s) => {
  const x = (s - CD.s0) / CD.ds;
  const i = Math.max(0, Math.min(CD.gas.length - 2, Math.floor(x)));
  return CD.gas[i] + (CD.gas[i + 1] - CD.gas[i]) * (x - i);
};
const AZ2 = P2.azimuth;
const theta2 = (az) => (-az * Math.PI) / 180;
const S_MIN = 33;
const S_MAX = CD.exitS;
let probeS = null;
function machAt(s) {
  const ratio = (gasAt(s) / CD.throatR) ** 2;
  return machOf(Math.max(1, ratio), s > CD.throatS, CD.gamma);
}
function drawProbe() {
  if (probeS === null) {
    probe.innerHTML = "";
    readout2.textContent = "Mach · presión · temperatura";
    return;
  }
  const s = probeS;
  const r = gasAt(s);
  // la circunferencia del gas a esa altura: contra la pared de atrás y a través de la cuña abierta
  const back = G.arcOf(F2, s, r, P2, { inward: true, from: theta2(AZ2 + 315), to: theta2(AZ2 + 45) });
  const open = G.arcOf(F2, s, r, P2, { from: theta2(AZ2 + 45), to: theta2(AZ2 - 45), least: -1 });
  probe.innerHTML = lineSvg(back + open, { tone: "lit" }).replace("<path", '<path style="stroke-width:1.2"');
  const M = machAt(s);
  const p = M_PC * pOf(M, CD.gamma);
  const T = M_TC * tOf(M, CD.gamma);
  const where = s < 80 ? "cámara" : s < CD.throatS - 1 ? "convergente" : s < CD.throatS + 3 ? "garganta" : "campana";
  readout2.textContent = `${where} · Mach ${M.toFixed(2)} · ${p >= 1 ? p.toFixed(2) + " MPa" : (p * 1000).toFixed(0) + " kPa"} · ${T.toFixed(0)} K`;
}
const M_PC = DATA.model.pcMPa;
const M_TC = DATA.model.tcK;
const yOf = (s) => iso([0, 0, CD.Z0 - s], P2)[1];
cut.addEventListener("pointermove", (event) => {
  const box = cut.getBoundingClientRect();
  const y = ((event.clientY - box.top) / box.height) * CD.H;
  const s = S_MIN + ((y - yOf(S_MIN)) / (yOf(S_MAX) - yOf(S_MIN))) * (S_MAX - S_MIN);
  probeS = Math.max(S_MIN, Math.min(S_MAX, s));
  drawProbe();
});
cut.addEventListener("pointerleave", () => {
  probeS = null;
  drawProbe();
});
cut.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  probeS = Math.max(S_MIN, Math.min(S_MAX, (probeS ?? CD.throatS) + (event.key === "ArrowDown" ? 4 : -4)));
  drawProbe();
});
window.__tv.tour = (t) => {
  touring = true;
  tourClock = t;
  run();
};
window.__tv.probe = (s) => {
  probeS = s;
  drawProbe();
};
