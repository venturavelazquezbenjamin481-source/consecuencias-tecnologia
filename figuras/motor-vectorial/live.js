const DATA = __DATA__;
const stage = document.querySelector(".tv-stage");
const readout = document.querySelector("[data-readout]");
const actLayer = stage.querySelector(".tv-acts");
const fireButton = document.querySelector("[data-fire]");
const fireLabel = document.querySelector("[data-fire-label]");
const apartButton = document.querySelector("[data-apart]");
const apartLabel = document.querySelector("[data-apart-label]");
const soundButton = document.querySelector("[data-sound]");
const throttleInput = document.querySelector("[data-throttle]");
const throttleOut = document.querySelector("[data-throttle-out]");
const consoleBox = document.querySelector("[data-console]");
const steps = Object.fromEntries([...document.querySelectorAll("[data-step]")].map((el) => [el.dataset.step, el]));
const clockText = document.querySelector("[data-clock]");
const teleText = document.querySelector("[data-tele]");
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

// ───────────── Secuencia de encendido ─────────────
// Segundos desde la orden: purga con nitrógeno, enfriamiento con oxígeno líquido, encendedor
// pirofórico (TEA-TEB, llama verde), generador de gas y turbobomba, ignición de la cámara, régimen.
const AT = { chill: 1.2, igniter: 2.2, gg: 2.35, main: 2.6 };
// Tras el corte: el generador se apaga primero, la cámara sigue y luego se purga
const CUT = { gg: 0.05, steam: 0.25, purge: [0.7, 1.1, 1.5], end: 2.2 };
// fase: off · start · run · stop. pc y gg son 0…1 sobre su valor nominal; heat es la pared de la tobera
const burn = { phase: "off", t: 0, cut: 0, pc: { x: 0, v: 0 }, gg: { x: 0, v: 0 }, heat: 0, pit: 0, green: -1, flash: -1, kick: -1, reached: 0, throttle: 1 };
const ORDER = DATA.seq;
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
// Recorrido: secuencia de encendido, dos vueltas de cono (la segunda a potencia reducida), cuatro
// escalones, corte, y luego la anatomía: despiece y cada conjunto resaltado por turno
const FIRE_AT = 0.8;
const CONE_AT = FIRE_AT + AT.main + 1.6;
const STEPS_AT = CONE_AT + 12;
const CUT_AT = STEPS_AT + 9.8;
const ANATOMY_AT = CUT_AT + 3.4;
const PART_TIME = 2.8;
const TOUR = ANATOMY_AT + 1.4 + DATA.assemblies.length * PART_TIME + 3;
function tourAt(t) {
  t %= TOUR;
  const fire = t > FIRE_AT && t < CUT_AT;
  const along = t - ANATOMY_AT - 1.4;
  const apartOn = t > ANATOMY_AT && along < DATA.assemblies.length * PART_TIME;
  const part = apartOn && along >= 0 ? DATA.assemblies[Math.min(DATA.assemblies.length - 1, Math.floor(along / PART_TIME))].id : null;
  let p = 0;
  let q = 0;
  if (t > CONE_AT && t < STEPS_AT) {
    const u = t - CONE_AT;
    const a = (u / 6) * Math.PI * 2;
    const r = 5 * Math.min(1, u / 1.2) * Math.min(1, (12 - u) / 1.2);
    p = r * Math.cos(a);
    q = r * Math.sin(a);
  } else if (t >= STEPS_AT && t < STEPS_AT + 9.6) {
    [p, q] = [[5, 0], [-5, 0], [0, 5], [0, -5]][Math.min(3, Math.floor((t - STEPS_AT) / 2.4))];
  }
  const throttle = t > CONE_AT + 6.5 && t < CONE_AT + 10.5 ? M.minThrottle + 10 : 100;
  return { p, q, fire, apart: apartOn, part, throttle };
}
const hold = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    // el recorrido retoma desde donde coincide con el motor: encendido, despiezado o en frío
    tourClock = apart.on ? ANATOMY_AT + 1.4 : burn.phase === "run" || burn.phase === "start" ? CONE_AT : 0;
    run();
  }, 6000);
};
const say = (text) => {
  if (liveText && liveText.textContent !== text) liveText.textContent = text;
};
const LABEL = { off: "Encender", start: "Abortar", run: "Apagar", stop: "Encender" };
function showPhase() {
  fireButton.toggleAttribute("data-on", burn.phase === "start" || burn.phase === "run");
  fireButton.setAttribute("data-phase", burn.phase);
  fireLabel.textContent = LABEL[burn.phase];
  consoleBox.setAttribute("data-phase", burn.phase);
}
// Orden del operador: encender arranca la secuencia; apagar durante el arranque la aborta
function setFire(on) {
  const lit = burn.phase === "start" || burn.phase === "run";
  if (on === lit) return;
  if (on) {
    burn.phase = "start";
    burn.t = 0;
    burn.reached = 0;
    burn.green = -1;
    say("secuencia de arranque: purga");
    sound.ensure();
  } else {
    say(burn.phase === "start" && burn.t < AT.main ? "arranque abortado, purga" : "corte de motor");
    burn.phase = "stop";
    burn.cut = 0;
  }
  showPhase();
}
function setThrottle(percent, quiet) {
  const v = Math.max(M.minThrottle, Math.min(100, Math.round(percent)));
  burn.throttle = v / 100;
  if (Number(throttleInput.value) !== v) throttleInput.value = String(v);
  throttleOut.textContent = `${v} %`;
  if (!quiet) say(`potencia ${v} por ciento`);
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

// ───────────── Vapor y humo ─────────────
// Bocanadas en el mundo: 0 vapor de agua (purga, foso), 1 hollín del generador, 2 niebla fría de oxígeno.
// Cada una es una gaussiana con ruido que el sombreador integra a lo largo del rayo.
const PUFFS = 24;
const puffs = [];
const puffData = new Float32Array(PUFFS * 4);
const puffKind = new Float32Array(PUFFS * 4);
const RISE = [16, 5, -40];
const PIT_RECT = DATA.pit;
const floorAt = (x, y) => (x > PIT_RECT[0] && x < PIT_RECT[2] && y > PIT_RECT[1] && y < PIT_RECT[3] ? -DATA.pitD : 0);
const jitter = (r) => (Math.random() * 2 - 1) * r;
function emit(kind, at, velocity, r0, r1, life, density) {
  if (still.matches) return;
  if (puffs.length >= PUFFS) puffs.shift();
  puffs.push({ kind, x: [...at], v: [...velocity], r0, r1, life, density, age: 0, seed: Math.random() });
}
function stepPuffs(dt) {
  for (const f of puffs) {
    f.age += dt;
    const drag = Math.exp(-dt * 1.4);
    f.v = [f.v[0] * drag, f.v[1] * drag, f.v[2] * drag + RISE[f.kind] * dt];
    for (let i = 0; i < 3; i++) f.x[i] += f.v[i] * dt;
    const r = f.r0 + (f.r1 - f.r0) * (1 - Math.exp((-3 * f.age) / f.life));
    const ground = floorAt(f.x[0], f.x[1]) + r * 0.35;
    if (f.x[2] < ground) {
      f.x[2] = ground;
      // al tocar el suelo se extiende
      f.v = [f.v[0] * 1.02 + f.v[2] * -0.25 * Math.sign(f.v[0] || 1), f.v[1] * 1.02, 0];
    }
  }
  for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].age > puffs[i].life) puffs.splice(i, 1);
}
function packPuffs() {
  puffKind.fill(0);
  puffs.forEach((f, i) => {
    const u = f.age / f.life;
    const r = f.r0 + (f.r1 - f.r0) * (1 - Math.exp(-3 * u));
    // aparece rápido, se disuelve despacio y no sube por encima del motor
    const fade = Math.min(1, u / 0.12) * (1 - u) ** 1.6 * Math.max(0, Math.min(1, (EXIT[2] + 34 - f.x[2]) / 50));
    puffData.set([f.x[0], f.x[1], f.x[2], r], i * 4);
    puffKind.set([f.density * fade, f.kind, f.seed, 0], i * 4);
  });
}
const crossed = (before, now, at) => before < at && now >= at;

// ───────────── Sonido ─────────────
// Ruido marrón grave que sigue a pc, un rugido de banda media, chasquidos y siseo de la purga.
// Se crea al primer clic (los navegadores no dejan sonar antes) y empieza en silencio.
const sound = (() => {
  let ctx = null;
  let on = false;
  let nodes = null;
  const make = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const length = ctx.sampleRate * 2;
    const white = ctx.createBuffer(1, length, ctx.sampleRate);
    const brown = ctx.createBuffer(1, length, ctx.sampleRate);
    const w = white.getChannelData(0);
    const b = brown.getChannelData(0);
    let acc = 0;
    for (let i = 0; i < length; i++) {
      w[i] = Math.random() * 2 - 1;
      acc = (acc + 0.02 * w[i]) / 1.02;
      b[i] = acc * 3.5;
    }
    const master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    const chain = (buffer, filters) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = Math.random();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      let node = src;
      const made = filters.map(([type, f, q]) => {
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = f;
        filter.Q.value = q;
        node.connect(filter);
        node = filter;
        return filter;
      });
      node.connect(gain).connect(master);
      src.start(0, Math.random());
      return { gain, filter: made[0] };
    };
    return {
      master,
      white,
      rumble: chain(brown, [["lowpass", 120, 0.7]]),
      roar: chain(white, [["bandpass", 700, 0.5]]),
      crackle: chain(white, [["highpass", 2400, 0.7]]),
      hiss: chain(white, [["highpass", 4200, 0.6]]),
    };
  };
  const to = (param, v, tau = 0.06) => param.setTargetAtTime(v, ctx.currentTime, tau);
  return {
    get on() {
      return on;
    },
    ensure() {
      if (on && ctx && ctx.state === "suspended") ctx.resume();
    },
    toggle() {
      if (!ctx) nodes = make();
      if (!nodes) return false;
      on = !on;
      if (on) ctx.resume();
      to(nodes.master.gain, on ? 0.9 : 0, 0.08);
      return on;
    },
    // un golpe corto de ruido: encendedor y cierre de válvulas
    pop(level = 1, f = 1600) {
      if (!on || !nodes) return;
      const src = ctx.createBufferSource();
      src.buffer = nodes.white;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = f;
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5 * level, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      src.connect(filter).connect(gain).connect(nodes.master);
      src.start(t, Math.random());
      src.stop(t + 0.4);
    },
    update(pc, gg, hiss) {
      if (!on || !nodes) return;
      to(nodes.rumble.gain.gain, 0.75 * pc ** 1.2);
      to(nodes.rumble.filter.frequency, 70 + 360 * pc);
      to(nodes.roar.gain.gain, 0.16 * pc + 0.05 * gg);
      to(nodes.roar.filter.frequency, 500 + 500 * pc);
      to(nodes.crackle.gain.gain, pc * (Math.random() < 0.35 ? 0.2 * Math.random() : 0.02), 0.01);
      to(nodes.hiss.gain.gain, 0.05 * hiss + 0.03 * gg);
    },
  };
})();

// ───────────── Pluma ─────────────
const PLUME = `
uniform vec3 uExit;
uniform vec3 uDir;
uniform float uPc;
uniform float uFlash;
uniform float uGreen;
uniform float uGG;
uniform vec3 uGGE;
uniform vec3 uGGD;
uniform vec4 uPuff[${PUFFS}];
uniform vec4 uPuffK[${PUFFS}];
uniform float uLight;
const float R0=${DATA.exitR.toFixed(2)};
const float LP=150.;
const float RG=${DATA.ggR.toFixed(2)};
const float LG=90.;
const vec4 PIT=vec4(${DATA.pit.map((v) => v.toFixed(1)).join(",")});
const vec4 DECK=vec4(${DATA.deck.map((v) => v.toFixed(1)).join(",")});
const float PITD=${DATA.pitD.toFixed(1)};
vec4 over(vec4 top,vec4 under){return top+under*(1.-top.a);}
vec4 inkFor(vec3 seen,float cover){vec3 absorbed=1.-seen;float a=max(max(absorbed.r,max(absorbed.g,absorbed.b)),cover);return vec4(vec3(a)-absorbed,a);}
float boxMask(vec2 p,vec4 b,float soft){return window(p.x,b.x,b.z,soft)*window(p.y,b.y,b.w,soft);}
// tramo [ta,tb] del rayo g0+tV dentro de un cilindro de eje (o,d), radio rb, entre s=s0 y s=s1
vec2 span(vec3 g0,vec3 V,vec3 o,vec3 d,float rb,float s0,float s1){
  vec3 w0=g0-o;
  vec3 a=V-dot(V,d)*d;
  vec3 b=w0-dot(w0,d)*d;
  float A=dot(a,a);
  float B=dot(b,a);
  float C=dot(b,b)-rb*rb;
  float disc=B*B-A*C;
  if(disc<=0.)return vec2(1.,0.);
  float sq=sqrt(disc);
  float vd=dot(V,d);
  float sw=dot(w0,d);
  float t1=(s0-sw)/vd;
  float t2=(s1-sw)/vd;
  return vec2(max((-B-sq)/A,min(t1,t2)),min((-B+sq)/A,max(t1,t2)));
}
// la pluma se acorta y se estrecha con poca presión (chorro sobreexpandido al arrancar)
float radiusAt(float s,float pc){return R0*(.78+.22*pc)*(1.-.12*smoothstep(0.,40.,s))+.11*max(s-30.,0.)*smoothstep(20.,90.,s);}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 g0=rayOf(vb);
  float T=uTime;
  float pc=clamp(uPc,0.,1.);
  float dith=hash12(gl_FragCoord.xy);
  vec3 d=normalize(uDir);
  float L=LP*(.3+.7*pc);
  float rough=1.+1.6*(1.-pc);
  vec3 hot=vec3(0.);
  vec3 soot=vec3(0.);
  float core=0.;
  float diamonds=0.;
  float green=0.;
  vec2 tt=span(g0,V,uExit,d,R0*1.9+.2*LP,-2.,L+10.);
  float sa=sqrt(dot(V-dot(V,d)*d,V-dot(V,d)*d));
  if(tt.y>tt.x&&(pc>.0004||uGreen>.001)){
    float dt=(tt.y-tt.x)/32.;
    float lam=27.*(.8+.2*pc);
    for(int i=0;i<32;i++){
      float t=tt.x+(float(i)+dith)*dt;
      vec3 p=g0+t*V;
      vec3 q=p-uExit;
      float s=dot(q,d);
      float r=length(q-s*d);
      float R=radiusAt(s,pc);
      float n1=fbm3(vec3(q.xy*.05,s*.045-T*4.2));
      float n2=noise3(vec3(q.xy*.16+3.,s*.13-T*9.1));
      float Re=R*(1.+((n1-.5)*.45*smoothstep(10.,120.,s)+(n2-.5)*.12)*rough);
      float rn=r/Re;
      float along=smoothstep(-2.,3.,s)*(1.-smoothstep(L*.62,L,s));
      float body=smoothstep(1.02,.8,rn)*along;
      float w=dt*sa/(2.*Re);
      hot+=mix(vec3(1.,.66,.2),vec3(1.,.42,.08),smoothstep(20.,120.,s))*body*w*(.7+1.1*exp(-max(s,0.)/55.))*(.75+.5*n2);
      green+=smoothstep(1.1,.6,rn)*smoothstep(-2.,3.,s)*exp(-max(s,0.)/26.)*w*(.6+.8*n1);
      soot+=vec3(1.)*smoothstep(1.2,.7,rn)*smoothstep(30.,110.,s)*(1.-smoothstep(L*.75,L+8.,s))*w*(.6+.8*n1);
      float rc=R*.38;
      core+=exp(-r*r/(rc*rc))*exp(-max(s,0.)/45.)*(dt*sa/(rc*1.772))*smoothstep(-2.,2.,s);
      for(int c=0;c<3;c++){
        float vc=16.+float(c)*lam;
        float ph=(s-vc)/(lam*.6);
        float tp=R0*.2*(1.05-clamp(ph,0.,1.)*.8)+.6;
        diamonds+=exp(-pow(r/tp,2.)*2.)*exp(-max(ph,0.)*2.4)*smoothstep(-.18,.02,ph)*(1.-smoothstep(.7,1.,ph))*(dt*sa/(tp*1.25))*exp(-float(c)*.45);
      }
    }
  }
  green*=uGreen;
  // escape de la turbina: rico en combustible, sale negro y prende en naranja al mezclarse con el aire
  float ggSoot=0.;
  float ggFire=0.;
  vec3 gd=normalize(uGGD);
  vec2 tg=span(g0,V,uGGE,gd,RG+.3*LG,-1.,LG);
  if(tg.y>tg.x&&uGG>.002){
    float dt=(tg.y-tg.x)/12.;
    float ga=sqrt(dot(V-dot(V,gd)*gd,V-dot(V,gd)*gd));
    for(int i=0;i<12;i++){
      float t=tg.x+(float(i)+dith)*dt;
      vec3 q=g0+t*V-uGGE;
      float s=dot(q,gd);
      float r=length(q-s*gd);
      float n=fbm3(vec3(q.xy*.11,s*.09-T*3.3));
      float Re=(RG*.8+.24*max(s,0.))*(.8+.45*n);
      float body=smoothstep(1.,.55,r/Re)*smoothstep(-1.,2.,s)*(1.-smoothstep(LG*.5,LG,s))*dt*ga/(2.*Re);
      ggSoot+=body*(.5+n);
      ggFire+=body*smoothstep(6.,20.,s)*exp(-max(s-20.,0.)/28.)*smoothstep(.45,.75,n);
    }
  }
  ggSoot*=uGG;
  ggFire*=uGG;
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
  float flick=.85+.3*noise2(vec2(T*13.,1.7));
  float floorLight=(onDeck*exp(-pow(rd/110.,2.))*.55+onPitFloor*exp(-pow(rp/60.,2.))*1.2)*pc*flick+onPitFloor*exp(-pow(rp/45.,2.))*uGreen*.5;
  // bocanadas: vapor iluminado por la pluma, hollín, niebla fría
  float tauW=0.;
  float tauS=0.;
  float tauF=0.;
  float warm=0.;
  for(int i=0;i<${PUFFS};i++){
    vec4 k=uPuffK[i];
    if(k.x<.002)continue;
    vec3 c=uPuff[i].xyz;
    float r=uPuff[i].w;
    vec3 w=c-g0;
    vec3 pp=g0+dot(w,V)*V;
    vec3 dv=c-pp;
    float d2=dot(dv,dv);
    if(d2>6.25*r*r)continue;
    vec2 uv=(vb-project(c))/(r*uK);
    float n=fbm3(vec3(uv*1.25+k.z*17.,T*.23+k.z*9.));
    float dens=k.x*exp(-d2/(r*r))*smoothstep(.18,.75,n+.3*exp(-d2/(r*r)))*1.6;
    dens*=mix(1.,inPit,step(pp.z,0.));
    vec3 q=pp-uExit;
    float s=dot(q,d);
    float rr=length(q-s*d);
    float lit=pc*flick*(exp(-rr/45.)*smoothstep(-30.,5.,s)+.8*exp(-length(pp-hitP)/80.))+uGG*.6*exp(-length(pp-uGGE)/30.);
    if(k.y<.5){tauW+=dens;warm+=dens*lit;}
    else if(k.y<1.5){tauS+=dens;warm+=dens*lit*.5;}
    else{tauF+=dens;warm+=dens*lit*.6;}
  }
  float aW=1.-exp(-tauW*1.4);
  float aF=1.-exp(-tauF*1.4);
  float aS=1.-exp(-tauS*1.8);
  float glow=warm/max(tauW+tauS+tauF,1e-3);
  vec3 steamDark=vec3(.6,.63,.68)*(.34*aW*(1.-.5*min(glow,1.)))+vec3(.55,.68,.82)*.42*aF+vec3(1.,.56,.24)*min(glow,1.)*(aW+aF+aS*.6)*.5;
  vec3 ggDark=vec3(1.,.48,.14)*ggFire*1.6+vec3(.5,.24,.08)*min(glow,1.)*aS*.4;
  vec3 dark=hot*2.1*pc+vec3(1.,.9,.68)*core*1.1*pc+vec3(1.,.97,.9)*diamonds*4.5*pc*smoothstep(.5,.95,pc)+vec3(.3,1.,.42)*green*1.4+vec3(1.,.5,.15)*floorLight*.5+ggDark+vec3(1.,.82,.6)*uFlash*exp(-pow(length(vb-project(uExit+d*R0*.35))/(R0*uK*.75),2.))*.45;
  dark=tonemap(dark,1.)+steamDark;
  float m=max(dark.r,max(dark.g,dark.b));
  vec4 darkInk=vec4(min(dark,vec3(1.)),min(m,1.));
  // papel: cuerpo naranja saturado, núcleo pálido junto a la tobera, hollín gris en los bordes
  float e=1.-exp(-2.2*(length(hot)*.9+core*.6)*pc);
  vec3 seen=mix(vec3(1.),vec3(1.,.6,.14),smoothstep(0.,.42,e));
  seen=mix(seen,vec3(1.,.84,.34),smoothstep(.4,.78,e));
  seen=mix(seen,vec3(1.,.98,.9),smoothstep(.7,.95,core*pc));
  float lens=min(diamonds*pc*smoothstep(.5,.95,pc),1.);
  seen=mix(seen,vec3(1.,.97,.86),lens*.75);
  float ge=1.-exp(-1.8*green);
  seen=mix(seen,vec3(.5,.93,.55),ge*(1.-e*.6));
  vec4 flame=inkFor(seen,.9*smoothstep(.55,.9,max(e,ge*.8)));
  float fe=1.-exp(-1.6*ggFire);
  vec4 ggFlame=inkFor(mix(vec3(1.),vec3(.98,.5,.16),fe),.0);
  float sootA=(1.-exp(-1.2*length(soot)*pc))*.45;
  float ggA=(1.-exp(-1.4*ggSoot))*.7;
  vec4 smoke=vec4(vec3(.42,.38,.35)*sootA,sootA);
  vec4 ggSmoke=vec4(vec3(.25,.22,.2)*ggA,ggA);
  vec4 cloud=inkFor(mix(vec3(1.),mix(vec3(.84,.86,.89),vec3(1.,.8,.6),min(glow,1.)),aW),0.);
  vec4 fog=inkFor(mix(vec3(1.),vec3(.82,.88,.94),aF),0.);
  vec4 puffSoot=vec4(vec3(.3,.27,.25)*aS*.8,aS*.8);
  vec4 tint=inkFor(mix(vec3(1.),vec3(1.,.74,.46),min(floorLight*.75,.7)),0.);
  vec4 lightInk=over(flame,over(ggFlame,over(ggSmoke,over(cloud,over(fog,over(puffSoot,over(smoke,tint)))))));
  vec4 ink=mix(darkInk,lightInk,uLight);
  ink.rgb=min(ink.rgb,vec3(ink.a));
  float nz=(hash12(gl_FragCoord.xy+fract(T*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(T*.37)*57.)-1.)/255.;
  gl_FragColor=clamp(ink+vec4(nz)*smoothstep(0.,1.5/255.,ink.a),0.,1.);
}`;
const plume = glLayer({ canvas: stage.querySelector(".tv-plume"), fragment: PLUME, view: [DATA.W, DATA.H], camera: DATA.camera, uniforms: ["uExit", "uDir", "uPc", "uFlash", "uGreen", "uGG", "uGGE", "uGGD", "uPuff", "uPuffK"], fixed: { uLight: LIGHT } });
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
const greenOf = () => (burn.green >= 0 ? burst(burn.green, 0.04, 0.22) : 0);
const flashOf = () => (burn.flash >= 0 && !still.matches ? burst(burn.flash, 0.06, 0.2) : 0);
function paintPlume() {
  if (!plume) return paintFallback();
  const pc = burn.pc.x;
  const flash = flashOf();
  const green = greenOf();
  if (pc < 1e-3 && flash < 1e-3 && green < 1e-3 && burn.gg.x < 2e-3 && !puffs.length) {
    if (plumeLive) plume.clear();
    plumeLive = false;
    return;
  }
  const exit = controller.anchor("nozzle", EXIT, [0, 0, -1]);
  const gg = controller.anchor("exh", DATA.ggExit, [0, 0, -1]);
  packPuffs();
  plume.draw({ uExit: exit.world, uDir: exit.direction, uPc: pc, uFlash: flash, uGreen: green, uGG: burn.gg.x, uGGE: gg.world, uGGD: gg.direction, uPuff: puffData, uPuffK: puffKind }, still.matches ? 0.8 : clock);
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
  const state = burn.pc.x > 0.02 ? `${side.toFixed(1)} kN lateral` : burn.phase === "start" ? "arranque" : burn.heat > 0.05 ? "enfriando" : "frío";
  const opened = EX.order.some((id) => shareOf(id) > 0.01);
  const named = DATA.assemblies.find((entry) => entry.id === focus);
  const text = opened || apart.on ? `despiece · ${named ? named.name.toLowerCase() : "elige un conjunto"}` : `δ ${delta.toFixed(1)}° · ${state} · A ${signed(a.mm)} · B ${signed(b.mm)} mm`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", `${text}${burn.pc.x > 0.02 ? ` · par sobre el vehículo ${(side * M.leverM).toFixed(0)} kN·m` : ""}`);
  drawn = [p, q];
}
// Consola: paso de la secuencia, reloj T−/T+ y telemetría
let shown = "";
function showConsole() {
  const ph = burn.phase;
  const t = burn.t;
  let now = null;
  if (ph === "start") now = t < AT.chill ? "purge" : t < AT.igniter ? "chill" : t < AT.gg ? "igniter" : t < AT.main ? "gg" : "main";
  else if (ph === "run") now = "full";
  else if (ph === "stop") now = "cut";
  if (now && now !== "cut") burn.reached = Math.max(burn.reached, ORDER.indexOf(now));
  const clock = ph === "off" ? "T− —" : ph === "stop" ? `corte +${burn.cut.toFixed(1)} s` : t < AT.main ? `T−${(AT.main - t).toFixed(1)} s` : `T+${(t - AT.main).toFixed(1)} s`;
  const pc = burn.pc.x;
  const wall = Math.round(290 + 1150 * burn.heat);
  const tele = `pc ${(M.pcMPa * pc).toFixed(1)} MPa · F ${(M.thrustKN * pc).toFixed(0)} kN · pared ${wall} K`;
  const key = `${ph}|${now}|${burn.reached}|${clock}|${tele}`;
  if (key === shown) return;
  shown = key;
  ORDER.forEach((id, i) => {
    const el = steps[id];
    const state = id === now ? "now" : ph !== "off" && id !== "cut" && i <= burn.reached ? "done" : "";
    if (el.getAttribute("data-state") !== state) {
      if (state) el.setAttribute("data-state", state);
      else el.removeAttribute("data-state");
    }
  });
  clockText.textContent = clock;
  teleText.textContent = tele;
}

// Un paso de simulación (sin dibujar): servos, despiece, secuencia, calor, vapor y sonido
function step(dt) {
  clock += dt;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    const s = tourAt(tourClock);
    if (!s.apart) cmd = { p: s.p, q: s.q };
    setApart(s.apart);
    if (s.apart) select(s.part);
    setFire(s.fire && !s.apart);
    if (Math.round(burn.throttle * 100) !== s.throttle) setThrottle(s.throttle, true);
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
  if (apart.waiting || exploding()) moving = true;

  // secuencia
  const phaseBefore = burn.phase;
  const exit = controller.anchor("nozzle", EXIT, [0, 0, -1]);
  const ex = exit.world;
  const d = exit.direction;
  const gge = controller.anchor("exh", DATA.ggExit, [0, 0, -1]).world;
  const along = (s, r) => [ex[0] + d[0] * s + jitter(r), ex[1] + d[1] * s + jitter(r), ex[2] + d[2] * s];
  let hiss = 0;
  if (burn.phase === "start") {
    const t0 = burn.t;
    const t1 = (burn.t += dt);
    for (const at of [0.1, 0.5, 0.9]) if (crossed(t0, t1, at)) {
      for (let i = 0; i < 3; i++) emit(0, along(4, 6), [d[0] * 70 + jitter(18), d[1] * 70 + jitter(18), d[2] * 70], 7, 32, 1.6, 0.8);
      sound.pop(0.25, 3800);
    }
    if (t1 < AT.chill) hiss = 1;
    else if (t1 < AT.main + 0.1) {
      hiss = 0.6;
      // niebla fría: el oxígeno que se tira por la cámara para enfriarla cae pesado al foso
      if (Math.floor(t0 / 0.07) !== Math.floor(t1 / 0.07)) emit(2, along(2, DATA.exitR * 0.7), [d[0] * 40 + jitter(12), d[1] * 40 + jitter(12), d[2] * 40], 8, 38, 3.2, 0.6);
    }
    if (crossed(t0, t1, AT.igniter)) {
      burn.green = 0;
      say("encendedor");
      sound.pop(0.8, 1100);
    }
    if (crossed(t0, t1, AT.gg)) {
      say("generador de gas");
      for (let i = 0; i < 2; i++) emit(1, gge, [jitter(12), jitter(12), -45], 4, 18, 1.6, 0.8);
    }
    if (crossed(t0, t1, AT.main)) {
      burn.flash = 0;
      burn.kick = 0;
      say("ignición");
      sound.pop(1, 300);
    }
    if (t1 > AT.main && burn.pc.x > 0.94 * burn.throttle) {
      burn.phase = "run";
      say(`régimen, ${Math.round(M.thrustKN * burn.throttle)} kilonewtons`);
      showPhase();
    }
  } else if (burn.phase === "run") burn.t += dt;
  else if (burn.phase === "stop") {
    const c0 = burn.cut;
    const c1 = (burn.cut += dt);
    if (crossed(c0, c1, CUT.gg) && burn.gg.x > 0.2) for (let i = 0; i < 3; i++) emit(1, gge, [jitter(15), jitter(15), -30], 5, 24, 2.2, 0.85);
    if (crossed(c0, c1, CUT.steam) && burn.heat > 0.1) {
      for (let i = 0; i < 2; i++) emit(0, along(6, 10), [d[0] * 30 + jitter(12), d[1] * 30 + jitter(12), d[2] * 30], 14, 42, 2.4, 0.45);
      sound.pop(0.5, 500);
    }
    for (const at of CUT.purge) if (crossed(c0, c1, at)) {
      for (let i = 0; i < 2; i++) emit(0, along(4, 6), [d[0] * 60 + jitter(15), d[1] * 60 + jitter(15), d[2] * 60], 6, 24, 1.4, 0.45);
      sound.pop(0.2, 3800);
    }
    if (c1 > CUT.purge[0] && c1 < CUT.end) hiss = 0.8;
    if (c1 > CUT.end && burn.pc.x < 0.01) {
      burn.phase = "off";
      say("apagado");
      showPhase();
    }
  }
  const mainOn = (burn.phase === "start" && burn.t >= AT.main) || burn.phase === "run";
  const ggOn = (burn.phase === "start" && burn.t >= AT.gg) || burn.phase === "run" || (burn.phase === "stop" && burn.cut < CUT.gg);
  const target = mainOn ? burn.throttle : 0;
  const pcBefore = burn.pc.x;
  settle(burn.pc, target, dt, target > burn.pc.x ? 0.2 : 0.14, calm);
  settle(burn.gg, ggOn ? 1 : 0, dt, 0.12, calm);
  if (burn.green >= 0 && (burn.green += dt) > 1.2) burn.green = -1;
  if (burn.flash >= 0 && (burn.flash += dt) > 1.5) burn.flash = -1;
  if (burn.kick >= 0 && (burn.kick += dt) > 0.9) burn.kick = -1;
  // la pared se calienta en ~3 s y se enfría en ~7 s; el foso guarda el calor (y hierve el agua)
  const pc = burn.pc.x;
  const ease = (x, to, tau) => (calm ? to : x + (to - x) * (1 - Math.exp(-dt / tau)));
  burn.heat = ease(burn.heat, pc, pc > burn.heat ? 2.6 : 7);
  burn.pit = ease(burn.pit, pc, pc > burn.pit ? 0.8 : 4);
  if (burn.heat < 0.002 && pc === 0) burn.heat = 0;
  if (burn.pit < 0.01 && pc === 0) burn.pit = 0;
  // vapor del agua de enfriamiento del foso, donde pega el chorro
  const rate = 16 * burn.pit;
  if (rate > 0.4 && Math.random() < rate * dt) {
    const k = (ex[2] + DATA.pitD) / Math.max(-d[2], 0.2);
    const hit = [ex[0] + d[0] * k + jitter(36), ex[1] + d[1] * k + jitter(36), -DATA.pitD + 10];
    const out = [hit[0] - ex[0], hit[1] - ex[1]];
    const n = Math.hypot(...out) || 1;
    emit(0, hit, [(out[0] / n) * 30 + jitter(20), (out[1] / n) * 30 + jitter(20), 60 + Math.random() * 45], 14, 58, 2.6, 0.36 * Math.min(1, burn.pit * 1.4));
  }
  stepPuffs(dt);
  sound.update(pc, burn.gg.x, hiss);
  const redraw = moving || pcBefore !== pc || phaseBefore !== burn.phase;
  return { redraw, alive: redraw || burn.phase !== "off" || burn.heat > 0 || burn.gg.x > 0 };
}
let heatShown = -1;
function render(redraw) {
  if (redraw || !drawn || drawn[0] !== servo.p.x || drawn[1] !== servo.q.x) draw();
  paintPlume();
  showConsole();
  if (Math.abs(burn.heat - heatShown) > 0.004 || (burn.heat === 0 && heatShown !== 0)) {
    heatShown = burn.heat;
    stage.style.setProperty("--tv-heat", heatShown.toFixed(3));
  }
  // golpe de la ignición: la losa vibra una fracción de segundo
  if (burn.kick >= 0 && !still.matches) {
    const a = 2.4 * Math.exp(-burn.kick / 0.16);
    stage.style.translate = `${(a * Math.sin(burn.kick * 97)).toFixed(2)}px ${(a * 0.6 * Math.sin(burn.kick * 71 + 1)).toFixed(2)}px`;
  } else if (stage.style.translate) stage.style.translate = "";
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const s = step(dt);
  render(s.redraw);
  const alive = s.alive || touring || puffs.length > 0 || burn.green >= 0 || burn.flash >= 0 || burn.kick >= 0;
  frame = visible && alive ? requestAnimationFrame(tick) : 0;
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
  setFire(!(burn.phase === "start" || burn.phase === "run"));
  run();
};
const toggleApart = () => {
  hold();
  setApart(!apart.on);
  run();
};
apartButton.addEventListener("click", toggleApart);
soundButton.addEventListener("click", () => {
  const on = sound.toggle();
  soundButton.toggleAttribute("data-on", on);
  soundButton.setAttribute("aria-pressed", String(on));
  say(on ? "sonido activado" : "sonido apagado");
});
throttleInput.addEventListener("input", () => {
  hold();
  setThrottle(Number(throttleInput.value));
  run();
});
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
  const nudge = event.shiftKey ? 3 : 1;
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
  if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") {
    event.preventDefault();
    hold();
    setThrottle(burn.throttle * 100 + (event.key === "+" || event.key === "=" ? 5 : -5));
    run();
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
  if (event.key === "ArrowUp") p += nudge;
  else if (event.key === "ArrowDown") p -= nudge;
  else if (event.key === "ArrowRight") q += nudge;
  else if (event.key === "ArrowLeft") q -= nudge;
  else if (event.key === "Escape" || event.key === "Home") p = q = 0;
  else return;
  event.preventDefault();
  [p, q] = clampCone(p, q);
  cmd = { p, q };
  hold();
  run();
});
if (still.matches) touring = false;
showPhase();
draw();
showConsole();
// Ganchos para las pruebas (el navegador sin GPU es lento: las envolventes avanzarían a cámara lenta)
window.__tv = {
  // fija ángulos y potencia en régimen
  set(p, q, pc = burn.pc.x) {
    touring = false;
    clearTimeout(idle);
    cmd = { p, q };
    servo.p = { x: p, v: 0 };
    servo.q = { x: q, v: 0 };
    burn.phase = pc > 0 ? "run" : "off";
    burn.t = pc > 0 ? 20 : 0;
    burn.pc = { x: pc, v: 0 };
    burn.gg = { x: pc > 0 ? 1 : 0, v: 0 };
    burn.heat = burn.pit = pc;
    burn.flash = burn.green = burn.kick = -1;
    showPhase();
    draw();
    paintPlume();
    showConsole();
  },
  // avanza la simulación `seconds` a pasos de 1/30 s y dibuja una vez
  warp(seconds) {
    touring = false;
    clearTimeout(idle);
    for (let t = 0; t < seconds; t += 1 / 30) step(1 / 30);
    render(true);
  },
  fire(on = true) {
    touring = false;
    clearTimeout(idle);
    setFire(on);
  },
  throttle: (v) => setThrottle(v, true),
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
