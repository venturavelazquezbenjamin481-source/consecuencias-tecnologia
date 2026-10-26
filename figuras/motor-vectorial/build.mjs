import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./anatomy/kit/iso-kit.mjs";
import * as G from "./anatomy/kit/lathe.mjs";
import * as A from "./anatomy/kit/audit.mjs";
import { turning } from "./anatomy/kit/turn-build.mjs";
import * as TA from "./anatomy/kit/turn-audit.mjs";
import { kitScript, turnScript, glScript } from "./anatomy/scripts/inline-kit.mjs";
import { glCamera } from "./anatomy/kit/gl.mjs";
import { ACT, actuatorSvg, bellowsSvg } from "./actuators.mjs";
import { tubePieces, tubeSvg } from "./anatomy/kit/tube.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const THEME = argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;

// Cámara y lienzo
const W = 900;
const H = 1000;
const AZIMUTH = 40;
const ELEVATION = 27;

// Mundo en centímetros. G = centro del cardán.
const ZG = 380;
const GC = [0, 0, ZG];
const DECK = { x: -140, y: -140, w: 280, d: 280, r: 10 };
const DECK_H = 16;
const FOOT_H = 8;
const COLUMN = 26;
const COLUMN_AT = [[-114, 114], [114, -114]];
const PLATE_Z = [ZG + 52, ZG + 62];
const PLATE_R = 72;
const BEAM_Z = ZG + 84;
const BEAM_H = 30;
const BLOCK_Z = [ZG + 12, ZG + 24];

// Ejes del cardán: el actuador A (acimut −5°) mueve el eje 1, el B (85°) el eje 2.
const ACT_AZ = { A: -5, B: 85 };
const dir = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG), 0];
const A1 = dir(ACT_AZ.B);
const A2 = dir(ACT_AZ.A);
const polar = (deg, r, z) => [r * Math.cos(deg * DEG), r * Math.sin(deg * DEG), z];
// Punto sobre el eje del motor a la distancia s bajo el cardán
const E = (s) => [0, 0, ZG - s];
const EF = G.frameOf([0, 0, ZG], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
const onE = (deg, r, s) => polar(deg, r, ZG - s);

// Modelo (la verdad que muestran las lecturas)
export const MODEL = { thrustKN: 400, limit: 6, rate: 20, omega: 14, zeta: 0.8, leverM: 15 };

// Campana: r(s) cóncava (cuadrática), de la garganta a la salida
const BELL_S = [98, 214];
const bell = (s) => {
  const x = s - BELL_S[0];
  return 12 + 0.62 * x - 0.002155 * x * x;
};
const bellSlope = (s) => 0.62 - 2 * 0.002155 * (s - BELL_S[0]);
const EXIT_R = bell(BELL_S[1]);

// Actuadores: pivote superior U (fijo) y rótula L0 en el motor (reposo)
const U = { A: polar(ACT_AZ.A, 60, ZG + 44), B: polar(ACT_AZ.B, 60, ZG + 44) };
const LUG_S = 72;
const LUG_R = 35;
const L0 = { A: onE(ACT_AZ.A, LUG_R, LUG_S), B: onE(ACT_AZ.B, LUG_R, LUG_S) };
const SIDE = { A: dir(ACT_AZ.A + 90), B: dir(ACT_AZ.B - 90) };

export const P = k.fitProjection(
  [
    ...k.boxCorners(DECK, -DECK_H - FOOT_H, 0),
    [COLUMN_AT[0][0] - COLUMN, COLUMN_AT[0][1] + COLUMN, BEAM_Z + BEAM_H],
    [COLUMN_AT[1][0] + COLUMN, COLUMN_AT[1][1] - COLUMN, BEAM_Z + BEAM_H],
  ],
  W,
  H,
  { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const FADE = [0.04, 0.42];
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

export const R = A.recorder(P);
const statics = { back: [], front: [] };
function put(layer, name, centre, svg, shapes = [], bias = 0) {
  const recorded = shapes.map((shape, index) => R.solid(Object.assign(shape, { name: shape.name ?? (index ? `${name}#${index + 1}` : name) })));
  R.put({ name, layer, at: centre, bias, svg, shapes: recorded });
}

// ───────────── Base: losa, patas, foso de llamas ─────────────
const PIT = { x: -70, y: -70, w: 140, d: 140, r: 2 };
const PIT_D = 46;
function deck() {
  const feet = [];
  for (const x of [-122, 0, 122]) for (const y of [-122, 0, 122]) if (x || y) feet.push([x, y]);
  for (const [x, y] of byDepth(feet)) {
    const svg = S(k.cylinder(x, y, 10, -DECK_H - FOOT_H, 2, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 7.4, -DECK_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" });
    put("back", `stand.foot.${x}.${y}`, [x, y, -DECK_H - FOOT_H], svg, [A.cylinder(x, y, 10, -DECK_H - FOOT_H, 2, { ground: true }), A.cylinder(x, y, 7.4, -DECK_H - FOOT_H + 2, FOOT_H - 2)], -50);
  }
  // losa con el foso recortado
  const slab = k.slabOf(DECK, -DECK_H, DECK_H, P, 8, 1.6);
  const hole = k.onTop(k.roundedPlan(PIT, 3), 0, P, true);
  const screws = k.corners(DECK, 14);
  const inner = Ln(k.sideSeam(DECK, -DECK_H + 5, P, 8), { tone: "faint" });
  const body = `<g class="iso-solid"><path class="iso-fill" fill-rule="evenodd" d="${slab.fill}${hole}"/>${slab.shades.map((d, shade) => (d ? `<path class="iso-shade" data-shade="${shade}" d="${d}"/>` : "")).join("")}<path class="iso-top" fill-rule="evenodd" d="${slab.top}${hole}"/><path class="iso-line iso-crease" data-tone="faint" d="${slab.crease}"/><path class="iso-line iso-bevel" data-tone="faint" d="${slab.bevel}"/>${inner}<path class="iso-line iso-edge" data-tone="mid" d="${slab.outline}"/></g>`;
  const pit = pitSvg();
  const top = [
    Ln(k.planOutline(k.insetPlan(DECK, 7), 0, P), { tone: "lo" }),
    Ln(screws.map(([x, y]) => k.ring(x, y, 3, 0, P, 18)).join(""), { tone: "lo" }),
    Dots(screws.map(([x, y]) => at([x, y, 0])), { size: 0.55 }),
  ].join("");
  put("back", "stand.deck", [0, 0, -DECK_H], body + pit + top, [A.slab(DECK, -DECK_H, DECK_H, { ground: true })], -40);
}

// Paredes del foso vistas a través de la abertura, recortadas por ella
function pitSvg() {
  const ring = k.roundedPlan(PIT, 3);
  const n = ring.length;
  const walls = [[], [], [], []];
  const [vx, vy] = [Math.cos(AZIMUTH * DEG), Math.sin(AZIMUTH * DEG)];
  const [lx, ly] = [-Math.sin(AZIMUTH * DEG), Math.cos(AZIMUTH * DEG)];
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (b[1] - a[1]) / len;
    const ny = -(b[0] - a[0]) / len;
    // normal hacia dentro del foso: la pared se ve si mira al espectador
    if (-(nx * vx + ny * vy) <= 1e-9) continue;
    const shade = Math.min(3, Math.max(0, Math.floor(((-nx * lx - ny * ly + 1) / 2) * 4)));
    walls[shade].push(k.pathOf([at([a[0], a[1], 0]), at([b[0], b[1], 0]), at([b[0], b[1], -PIT_D]), at([a[0], a[1], -PIT_D])], true));
  }
  const hole = k.onTop(ring, 0, P, true);
  const floor = k.onTop(ring, -PIT_D, P, true);
  const grate = [];
  for (let x = PIT.x + 13; x < PIT.x + PIT.w - 4; x += 13) grate.push(k.lineOnTop([x, PIT.y], [x, PIT.y + PIT.d], -PIT_D, P));
  return `<defs><clipPath id="tv-pit"><path d="${hole}"/></clipPath></defs><g clip-path="url(#tv-pit)"><path class="tv-void" d="${hole}"/><path class="tv-pit-floor" d="${floor}"/>${Ln(grate.join(""), { tone: "faint" })}${walls.map((list, shade) => (list.length ? `<path class="iso-shade tv-pit-wall" data-shade="${shade}" d="${list.join("")}"/>` : "")).join("")}${Ln(floor, { tone: "lo" })}</g>${Ln(hole, { tone: "mid" })}`;
}

// Ángulo de acero alrededor del foso y aro de agua
let PIT_RIM = null;
function pitRim() {
  const out = [];
  const rim = k.insetPlan(PIT, -6);
  const frame = k.extrude(k.roundedPlan(rim, 3), 0, 2.2, P, { convex: false });
  void frame;
  for (const [x, y, w, d] of [[rim.x, rim.y, rim.w, 6], [rim.x, rim.y + rim.d - 6, rim.w, 6], [rim.x, rim.y + 6, 6, rim.d - 12], [rim.x + rim.w - 6, rim.y + 6, 6, rim.d - 12]]) {
    const plan = { x, y, w, d, r: 0.6 };
    out.push(S(k.slabOf(plan, 0, 2.2, P, 2, 0.3), { tone: "mid" }));
  }
  const bolts = [];
  for (let t = rim.x + 12; t < rim.x + rim.w - 6; t += 18) bolts.push([t, rim.y + 3], [t, rim.y + rim.d - 3]);
  for (let t = rim.y + 12; t < rim.y + rim.d - 6; t += 18) bolts.push([rim.x + 3, t], [rim.x + rim.w - 3, t]);
  out.push(Dots(bolts.map(([x, y]) => at([x, y, 2.2])), { size: 0.45 }));
  PIT_RIM = A.slab(rim, 0, 2.2);
  put("back", "stand.pit-rim", [0, 0, 1], out.join(""), [PIT_RIM], -30);
}

// Placa de identificación grabada y regla en el borde de la losa
function deckFurniture() {
  const LABEL = { x: 82, y: 50, w: 46, d: 16, r: 1.6 };
  const svg = S(k.slabOf(LABEL, 0, 1, P, 3, 0.4), { tone: "mid" }) + Ln(k.planOutline(k.insetPlan(LABEL, 1.6), 1, P, 3), { tone: "faint" }) + k.faceTextSvg(k.topMatrix([LABEL.x + 5, LABEL.y + 7], 1, P, "x"), "TVC-1 · 400 kN", { size: 4, tone: "lo" }) + Ln([0, 1].map((row) => k.lineOnTop([LABEL.x + 5, LABEL.y + 10 + row * 2.2], [LABEL.x + (row ? 30 : 40), LABEL.y + 10 + row * 2.2], 1, P)).join(""), { tone: "lo", free: true }) + Dots([at([LABEL.x + 2.6, LABEL.y + LABEL.d / 2, 1]), at([LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d / 2, 1])], { size: 0.45 });
  put("back", "stand.label", [LABEL.x + 25, LABEL.y + 8, 0], svg, [A.slab(LABEL, 0, 1)], -20);
  const STRIP = { x: -84, y: DECK.y + DECK.d - 14, w: 180, d: 8, r: 1 };
  const t = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y + 1, 0.8, [2.2, 4.4], P);
  put("back", "stand.strip", [STRIP.x + 100, STRIP.y + 4, 0], S(k.slabOf(STRIP, 0, 0.8, P, 3), { tone: "lo", crease: "none" }) + Ln(t.minor, { tone: "lo" }) + Ln(t.major, { tone: "mid" }) + Dots([at([STRIP.x + 2.2, STRIP.y + 4, 0.8]), at([STRIP.x + STRIP.w - 2.2, STRIP.y + 4, 0.8])], { size: 0.45 }), [A.slab(STRIP, 0, 0.8)], -20);
}

// ───────────── Pórtico ─────────────
function columns() {
  for (const [cx, cy] of COLUMN_AT) {
    const base = { x: cx - 24, y: cy - 24, w: 48, d: 48, r: 3 };
    const column = { x: cx - COLUMN / 2, y: cy - COLUMN / 2, w: COLUMN, d: COLUMN, r: 1.5 };
    const out = [S(k.slabOf(base, 0, 5, P, 3, 0.8), { tone: "mid" }), Dots(k.corners(base, 6).map(([x, y]) => at([x, y, 5])), { size: 0.55 }), Ln(k.corners(base, 6).map(([x, y]) => k.ring(x, y, 2.4, 5, P, 14)).join(""), { tone: "lo" })];
    out.push(S(k.slabOf(column, 5, BEAM_Z - 5, P, 3, 0.8), { tone: "mid" }));
    for (const z of [120, 250, 380]) {
      const splice = k.insetPlan(column, -2.2);
      out.push(S(k.slabOf(splice, z, 13, P, 3, 0.5), { tone: "mid" }));
      const xs = [splice.x + splice.w, cy];
      out.push(Dots([[splice.x + splice.w, cy - 6], [splice.x + splice.w, cy + 6]].flatMap(([x, y]) => [at([x, y, z + 4]), at([x, y, z + 9])]).concat([[cx - 6, splice.y + splice.d], [cx + 6, splice.y + splice.d]].flatMap(([x, y]) => [at([x, y, z + 4]), at([x, y, z + 9])])), { size: 0.42 }));
      void xs;
    }
    put("back", `stand.column.${cx}`, [cx, cy, 0], out.join(""), [A.box([base.x, base.y, 0], [base.x + base.w, base.y + base.d, 5]), A.box([column.x, column.y, 5], [column.x + column.w, column.y + column.d, BEAM_Z])], -10);
  }
}

const ALONG = G.unit3([1, -1, 0]);
const ACROSS = G.unit3([1, 1, 0]);
function beam() {
  const half = 14;
  const end = 160;
  const ringAt = (o) => [[-end, -half], [end, -half], [end, half], [-end, half]].map(([a, c]) => G.add3(G.mul3(ALONG, a), G.mul3(ACROSS, c))).map(([x, y]) => [x, y]);
  const top = BEAM_Z + BEAM_H;
  const line = (offset) => k.onTop([G.add3(G.mul3(ALONG, -end), G.mul3(ACROSS, offset)), G.add3(G.mul3(ALONG, end), G.mul3(ACROSS, offset))].map(([x, y]) => [x, y]), top, P);
  const bolts = [];
  for (let t = -150; t <= 150; t += 30) for (const s of [-1, 1]) bolts.push(at([...G.add3(G.mul3(ALONG, t), G.mul3(ACROSS, s * 8.5)).slice(0, 2), top]));
  const face = [];
  for (let t = -136; t <= 136; t += 68) {
    const p = G.add3(G.mul3(ALONG, t), G.mul3(ACROSS, half));
    face.push(k.segment([p[0], p[1], BEAM_Z], [p[0], p[1], top], P));
  }
  const svg = S(k.extrude(ringAt(), BEAM_Z, BEAM_H, P, { bevel: 0.9 }), { tone: "mid" }) + Ln(line(-half + 5) + line(half - 5), { tone: "lo" }) + Ln(face.join(""), { tone: "faint" }) + Dots(bolts, { size: 0.45 });
  put("front", "stand.beam", [0, 0, BEAM_Z + BEAM_H / 2], svg, [A.orientedBox([0, 0, BEAM_Z + BEAM_H / 2], [ALONG, ACROSS, [0, 0, 1]], [end, half, BEAM_H / 2])], 200);
}

// Placa de empuje colgada de dos células de carga
function thrustPlate() {
  const F = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const plate = S(k.cylinder(0, 0, PLATE_R, PLATE_Z[0], PLATE_Z[1] - PLATE_Z[0], P, 96, 1.2), { tone: "mid", inner: Ln(k.sideArc(0, 0, PLATE_R, PLATE_Z[0] + 4, P, 72), { tone: "faint" }) }) + Dots(G.dotsOf(F, PLATE_Z[1], PLATE_R - 5, 36, P, { all: true }), { size: 0.45 }) + Ln(k.ring(0, 0, PLATE_R - 9, PLATE_Z[1], P, 96), { tone: "faint" });
  put("front", "stand.plate", [0, 0, PLATE_Z[0]], plate, [A.cylinder(0, 0, PLATE_R, PLATE_Z[0], PLATE_Z[1] - PLATE_Z[0])], 100);
  for (const t of [-44, 44]) {
    const [x, y] = G.mul3(ALONG, t);
    const cell = S(k.cylinder(x, y, 11, PLATE_Z[1], 4, P, 40, 0.5), { tone: "mid" }) + S(k.cylinder(x, y, 8, PLATE_Z[1] + 4, 12, P, 36), { tone: "hi", inner: Ln(k.sideArc(x, y, 8, PLATE_Z[1] + 10, P, 24), { tone: "faint" }) }) + Ln(k.knurl(x, y, 8, PLATE_Z[1] + 11, PLATE_Z[1] + 15, 26, P), { tone: "lo" }) + S(k.cylinder(x, y, 11, PLATE_Z[1] + 16, BEAM_Z - PLATE_Z[1] - 16, P, 40, 0.5), { tone: "mid" });
    put("front", `stand.loadcell.${t}`, [x, y, PLATE_Z[1] + 8], cell, [A.cylinder(x, y, 11, PLATE_Z[1], 4), A.cylinder(x, y, 8, PLATE_Z[1] + 4, 12), A.cylinder(x, y, 11, PLATE_Z[1] + 16, BEAM_Z - PLATE_Z[1] - 16)], 150);
  }
}

// Cono de empuje: cuatro puntales de la placa al bloque del cardán
function thrustCone() {
  const BLOCK_R = 21;
  const block = S(k.cylinder(0, 0, BLOCK_R, BLOCK_Z[0], BLOCK_Z[1] - BLOCK_Z[0], P, 64, 0.8), { tone: "mid", inner: Ln(k.sideArc(0, 0, BLOCK_R, BLOCK_Z[0] + 4, P, 48), { tone: "faint" }) }) + Dots(G.dotsOf(G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]), BLOCK_Z[0] + 8, BLOCK_R, 16, P, { fade: FADE }), { size: 0.42 });
  put("front", "stand.gimbal-block", [0, 0, BLOCK_Z[0]], block, [A.cylinder(0, 0, BLOCK_R, BLOCK_Z[0], BLOCK_Z[1] - BLOCK_Z[0])], 20);
  for (const deg of [AZIMUTH, AZIMUTH + 90, AZIMUTH + 180, AZIMUTH - 90]) {
    // puntal con rótula en cada extremo: espárrago, bola y barra (llanta sobre la esfera)
    const BALL = 4;
    const STUD = 2.4;
    const ROD = 2.6;
    const seat = Math.sqrt(BALL ** 2 - STUD ** 2);
    const top = polar(deg, 56, PLATE_Z[0] - 2 - seat);
    const low = polar(deg, BLOCK_R - 6, BLOCK_Z[1] + 2 + seat);
    const axis = G.unit3(G.sub3(top, low));
    const F = G.frameAlong(low, axis);
    const length = G.len3(G.sub3(top, low));
    const end = Math.sqrt(BALL ** 2 - ROD ** 2);
    const name = `stand.strut.${deg}`;
    const ballTop = A.ball(top, BALL, { name: `${name}.ball-top` });
    const ballLow = A.ball(low, BALL, { name: `${name}.ball-low` });
    const svg = S(k.cylinder(low[0], low[1], STUD, BLOCK_Z[1], 2 + 0.01, P, 20), { tone: "mid" }) + S(G.disc(end, length - end, ROD, F, P), { tone: "mid", inner: Ln(G.arcOf(F, length / 2, ROD, P), { tone: "faint" }) }) + S(G.sphereOf(low, BALL, P), { tone: "hi" }) + S(G.sphereOf(top, BALL, P), { tone: "hi" }) + S(k.cylinder(top[0], top[1], STUD, top[2] + seat, PLATE_Z[0] - top[2] - seat, P, 20), { tone: "mid" });
    put("front", name, G.lerp3(low, top, 0.5), svg, [ballTop, ballLow, A.disc(F, end, length - end, ROD, { seated: true, cut: [ballTop, ballLow] }), A.cylinder(low[0], low[1], STUD, BLOCK_Z[1], 2, { seated: true, cut: [ballLow] }), A.cylinder(top[0], top[1], STUD, top[2] + seat, PLATE_Z[0] - top[2] - seat, { seated: true, cut: [ballTop] })], 30);
  }
}

// Soportes de los pivotes superiores de los actuadores (bola fija en U)
function upperBrackets() {
  for (const id of ["A", "B"]) {
    const u = U[id];
    const plan = { x: u[0] - 7, y: u[1] - 7, w: 14, d: 14, r: 1.4 };
    const stemFrom = u[2] + Math.sqrt(ACT.ball ** 2 - 2.6 ** 2);
    const svg = S(k.slabOf(plan, PLATE_Z[0] - 4, 4, P, 3, 0.5), { tone: "mid" }) + S(k.cylinder(u[0], u[1], 2.6, stemFrom, PLATE_Z[0] - 4 - stemFrom, P, 20), { tone: "mid", crease: "none" }) + S(G.sphereOf(u, ACT.ball, P), { tone: "hi" }) + Dots(k.corners(plan, 2.4).map(([x, y]) => at([x, y, PLATE_Z[0] - 4])), { size: 0.4 });
    put("mid", `stand.bracket.${id}`, u, svg, (() => { const ball = A.ball(u, ACT.ball); return [A.slab(plan, PLATE_Z[0] - 4, 4), A.cylinder(u[0], u[1], 2.6, stemFrom, PLATE_Z[0] - 4 - stemFrom, { seated: true, cut: [ball] }), ball]; })(), 60);
  }
}

// Tubo o cable fijo, troceado para ordenarse por profundidad
function staticTube(layer, name, route, r, { tone = "mid", touch, closed = false, gaps = [], maxLength = 30, limp = false, caps = true, bias = 0 } = {}) {
  R.route(name, route, r, { owner: name, touch, limp, closed, gaps });
  tubePieces(route, r, P, { maxLength, closed, gaps, caps, spacing: Math.max(0.8, Math.min(2, r * 0.4)) }).forEach((part, index) => R.put({ name: `${name}:${index}`, layer, at: part.mid, bias, svg: tubeSvg(part, { tone }), shapes: [A.tube(part.points, part.radii, { owner: name })], route: name, chunk: index }));
}

// Aro de agua alrededor del foso, con boquillas y su alimentación desde el borde de la losa
function deluge() {
  const ring = k.insetPlan(PIT, -3);
  const z = 2.2 + 1.6;
  const corners = [[ring.x, ring.y], [ring.x + ring.w, ring.y], [ring.x + ring.w, ring.y + ring.d], [ring.x, ring.y + ring.d]].map(([x, y]) => [x, y, z]);
  const mid = [(corners[0][0] + corners[1][0]) / 2, corners[0][1], z];
  const loop = G.resample(G.fillet([mid, corners[1], corners[2], corners[3], corners[0], mid], 14, 14, { P, tube: 1.6 }), 1);
  // la T donde entra la alimentación: el aro se interrumpe bajo la bola
  let best = 0;
  loop.forEach((p, i) => { if (Math.hypot(p[0] - (ring.x + ring.w), p[1] + 28) < Math.hypot(loop[best][0] - (ring.x + ring.w), loop[best][1] + 28)) best = i; });
  const TEE = loop[best];
  const teeAt = G.pathLength(loop.slice(0, best + 1));
  const TEE_R = 3.2;
  const cut = Math.sqrt(TEE_R ** 2 - 1.6 ** 2);
  // el aro empieza y termina en la bola de la T: dos extremos reales, con la bola como asiento
  const total = G.pathLength(loop);
  const around = [...G.cut(loop, teeAt + cut, total), ...G.cut(loop, 0, teeAt - cut).slice(1)];
  staticTube("back", "stand.deluge", around, 1.6, { touch: ["stand.pit-rim"], maxLength: 60, bias: -25 });
  const teeBall = A.ball(TEE, TEE_R, { seated: true, cut: [PIT_RIM] });
  put("back", "stand.deluge.tee", TEE, S(G.sphereOf(TEE, TEE_R, P), { tone: "hi" }), [teeBall], -24.5);
  const nozzles = [];
  for (let t = ring.x + 18; t < ring.x + ring.w - 16; t += 12) nozzles.push([t, ring.y, z + 1.6], [t, ring.y + ring.d, z + 1.6]);
  for (let t = ring.y + 18; t < ring.y + ring.d - 16; t += 12) nozzles.push([ring.x, t, z + 1.6], [ring.x + ring.w, t, z + 1.6]);
  put("back", "stand.deluge.nozzles", [0, 0, z + 1.6], Dots(nozzles.map((p) => at(p)), { size: 0.55, tone: "hi" }), nozzles.map((p) => A.ball(p, 0.55 / KS, { owner: "stand.deluge" })), -24);
  // alimentación: del aro al bloque de válvulas junto al borde de la losa
  const VALVE = { x: 108, y: -36, w: 18, d: 16, r: 1.6 };
  const from = [TEE[0] + cut, TEE[1], z];
  const to = [VALVE.x, TEE[1], z];
  staticTube("back", "stand.deluge.feed", [from, to], 1.6, { touch: ["stand.pit-rim"], bias: -24 });
  const svg = S(k.slabOf(VALVE, 0, 9, P, 3, 0.5), { tone: "mid", inner: Ln(k.sideSeam(VALVE, 3, P, 3), { tone: "faint" }) }) + S(k.cylinder(VALVE.x + 9, VALVE.y + 8, 3.4, 9, 2.4, P, 24), { tone: "hi" }) + Ln(k.knurl(VALVE.x + 9, VALVE.y + 8, 3.4, 9, 11.4, 18, P), { tone: "lo" }) + Dots(k.corners(VALVE, 2.2).map(([x, y]) => at([x, y, 9])), { size: 0.4 });
  put("back", "stand.deluge.valve", [VALVE.x + 9, VALVE.y + 8, 0], svg, [A.slab(VALVE, 0, 9), A.cylinder(VALVE.x + 9, VALVE.y + 8, 3.4, 9, 2.4)], -23);
}

// Escalera en la columna izquierda
function ladder() {
  const [cx, cy] = COLUMN_AT[0];
  const face = cy + COLUMN / 2;
  const out = [];
  const shapes = [];
  // los peldaños van primero: los largueros tapan sus extremos
  const rungs = [];
  for (let z = 36; z < BEAM_Z - 50; z += 26) rungs.push(k.segment([cx - 9, face + 9.3, z], [cx + 9, face + 9.3, z], P));
  out.push(Ln(rungs.join(""), { tone: "mid" }));
  for (const x of [cx - 9, cx + 9]) {
    out.push(S(k.slabOf({ x: x - 1.3, y: face + 8, w: 2.6, d: 2.6, r: 0.6 }, 16, BEAM_Z - 60, P, 2), { tone: "mid", crease: "none" }));
    shapes.push(A.box([x - 1.3, face + 8, 16], [x + 1.3, face + 10.6, BEAM_Z - 44]));
    for (const z of [60, BEAM_Z - 80]) {
      out.push(S(k.slabOf({ x: x - 1, y: face, w: 2, d: 8, r: 0.4 }, z, 2, P, 2), { tone: "mid", crease: "none" }));
      shapes.push(A.box([x - 1, face, z], [x + 1, face + 8, z + 2]));
    }
  }
  put("back", "stand.ladder", [cx, face + 9, 100], out.join(""), shapes, -5);
}

// Caja de conexiones sobre la placa y cables a los conectores de los soportes
function harness() {
  const BOX = { x: 14, y: 26, w: 26, d: 14, r: 1.6 };
  const z0 = PLATE_Z[1];
  const h = 11;
  const svg = S(k.slabOf(BOX, z0, h, P, 3, 0.6), { tone: "hi", crease: "lo", inner: Ln(k.sideSeam(BOX, z0 + h - 3, P, 3), { tone: "faint" }) }) + Ln(k.planOutline(k.insetPlan(BOX, 1.8), z0 + h, P, 3), { tone: "faint" }) + Ln([0, 1, 2].map((row) => k.lineOnTop([BOX.x + 4, BOX.y + 3.6 + row * 2.4], [BOX.x + (row === 1 ? 13 : 18), BOX.y + 3.6 + row * 2.4], z0 + h, P)).join(""), { tone: "lo", free: true }) + Dots(k.corners(BOX, 2.2).map(([x, y]) => at([x, y, z0 + h])), { size: 0.42 });
  put("front", "stand.harness.box", [BOX.x + 13, BOX.y + 7, z0], svg, [A.slab(BOX, z0, h)], 160);
  const r = 0.62;
  const routes = {
    A: [[BOX.x + BOX.w, BOX.y + 4, z0 + 4], [BOX.x + BOX.w + 6, BOX.y + 4, z0 + 4], [BOX.x + BOX.w + 6, BOX.y + 4, z0 + r], [66, BOX.y + 4, z0 + r], [76.5, -5.2, z0 + r], [76.5, -5.2, PLATE_Z[0] - 2], [U.A[0] + 7, U.A[1], PLATE_Z[0] - 2]],
    B: [[BOX.x + 4, BOX.y + BOX.d, z0 + 4], [BOX.x + 4, BOX.y + BOX.d + 6, z0 + 4], [BOX.x + 4, BOX.y + BOX.d + 6, z0 + r], [BOX.x + 4, 66, z0 + r], [5.2, 76.5, z0 + r], [5.2, 76.5, PLATE_Z[0] - 2], [U.B[0], U.B[1] + 7, PLATE_Z[0] - 2]],
  };
  for (const [id, points] of Object.entries(routes)) {
    const route = G.fillet(points, 2.4, 8);
    staticTube("front", `stand.harness.${id}`, route, r, { touch: ["stand.plate", "stand.harness.box", `stand.bracket.${id}`], limp: true, maxLength: 14, bias: 170 });
    const end = route[route.length - 1];
    put("front", `stand.harness.${id}.end`, end, Dots([at(end)], { size: 0.5, tone: "hi" }), [A.ball(end, 0.5 / KS)], 171);
  }
}

deck();
pitRim();
deckFurniture();
columns();
beam();
thrustPlate();
thrustCone();
upperBrackets();
deluge();
ladder();
harness();

// ───────────── Motor (grupos 3D) ─────────────
export const T = turning(P, { recorder: R });
const pitch = T.group("pitch", { hinge: { point: GC, axis: A1, range: [-MODEL.limit, MODEL.limit] } });
const yaw = T.group("yaw", { parent: pitch, hinge: { point: GC, axis: A2, range: [-MODEL.limit, MODEL.limit] } });
const live = T.layer("engine");
T.stack(["back", "engine", "mid", "front"]);
const Z = [0, 0, 1];
const frameOn = (o, a, u) => {
  const axis = G.unit3(a);
  const uu = G.unit3(G.sub3(u, G.mul3(axis, G.dot3(u, axis))));
  return { o, a: axis, u: uu, v: G.cross3(axis, uu) };
};
const EN = { group: yaw, layer: live };
const round = (name, s0, s1, r, extra = {}) => T.round({ name, ...EN, F: EF, s0, s1, r, tone: "hi", crease: "lo", ...extra });

// Cardán: orejas fijas (eje 1), cruceta (grupo pitch), orejas del motor (eje 2)
const SPIDER = 6;
const TRUNNION = 2.6;
const EAR_T = 3;
for (const sign of [-1, 1]) {
  const F = frameOn(GC, G.mul3(A1, sign), Z);
  T.prism({ name: `gimbal.ear1${sign > 0 ? "+" : "-"}`, layer: live, F, polygon: [[-8, -6], [BLOCK_Z[0] - ZG, -6], [BLOCK_Z[0] - ZG, 6], [-8, 6]], s0: SPIDER + TRUNNION, s1: SPIDER + TRUNNION + EAR_T, tone: "mid", bevel: 0.3, details: { dots: [{ at: [SPIDER + TRUNNION + EAR_T, 0, 0], normal: G.mul3(A1, sign), size: 0.5 }] } });
  T.round({ name: `gimbal.pin1${sign > 0 ? "+" : "-"}`, group: pitch, layer: live, F, s0: SPIDER, s1: SPIDER + TRUNNION, r: 3.4, tone: "mid", material: "steel" });
}
T.prism({ name: "gimbal.spider", group: pitch, layer: live, F: frameOn(GC, Z, A1), polygon: [[-SPIDER, -SPIDER], [SPIDER, -SPIDER], [SPIDER, SPIDER], [-SPIDER, SPIDER]], s0: -SPIDER, s1: SPIDER, tone: "hi", crease: "lo", bevel: 0.4, material: "steel" });
for (const sign of [-1, 1]) {
  const F = frameOn(GC, G.mul3(A2, sign), Z);
  T.prism({ name: `gimbal.ear2${sign > 0 ? "+" : "-"}`, ...EN, F, polygon: [[-14, -6], [4, -6], [6, -4], [6, 4], [4, 6], [-14, 6]], s0: SPIDER + TRUNNION, s1: SPIDER + TRUNNION + EAR_T, tone: "mid", bevel: 0.3, details: { dots: [{ at: [SPIDER + TRUNNION + EAR_T, 0, 0], normal: G.mul3(A2, sign), size: 0.5 }] } });
  T.round({ name: `gimbal.pin2${sign > 0 ? "+" : "-"}`, ...EN, F, s0: SPIDER, s1: SPIDER + TRUNNION, r: 3.4, tone: "mid", material: "steel" });
}

// Cuerpo del motor, de arriba abajo
round("engine.post", 14, 18, 16, { tone: "mid", details: { bolts: [{ s: 14, r: 13, count: 12, size: 0.42, phase: 0.1 }] } });
round("engine.dome", 18, 28, [16, 25.5], { details: { seams: [22] } });
round("engine.injector", 28, 32, 27.5, { tone: "mid", details: { bolts: [{ s: 28, r: 26.2, count: 32, size: 0.4 }] } });
round("engine.chamber.0", 32, 50, 22, { details: { seams: [36, 46] } });
round("engine.chamber.ring", 50, 53, 23.8, { tone: "mid" });
round("engine.chamber.1", 53, 68, 22);
round("engine.lugring", 68, 76, 25.5, { tone: "mid", details: { bolts: [{ s: 68, r: 24, count: 24, size: 0.38 }] } });
round("engine.chamber.2", 76, 80, 22);
round("engine.converge", 80, 94, [22, 12.6]);
round("engine.throat", 94, BELL_S[0], [12.6, 12]);
const BANDS = [[98, 128], [131, 164], [167, 196], [199, 214]];
BANDS.forEach(([s0, s1], index) => {
  T.lathe({ name: `engine.bell.${index}`, ...EN, F: EF, profile: [[s0, bell(s0)], [s1, bell(s1)]], radius: bell, slope: bellSlope, tone: "hi", crease: "lo", details: { ribs: { s0, s1, count: 120, fade: [0.1, 0.55], tone: "faint" } } });
  const next = BANDS[index + 1];
  if (next) round(`engine.bell.ring.${index}`, s1, next[0], bell(next[0]) + 1.8, { tone: "mid", details: { bolts: [{ s: s1, r: bell(s1) + 0.9, count: 40, size: 0.34, fade: FADE }] } });
});
round("engine.lip", BELL_S[1], BELL_S[1] + 3, EXIT_R + 2.2, { tone: "mid" });

// Orejetas de los actuadores y rótulas (bola con plano) en el anillo
for (const id of ["A", "B"]) {
  const az = ACT_AZ[id];
  const out = dir(az);
  const F = frameOn(onE(az, 0, LUG_S), out, Z);
  T.prism({ name: `engine.lug.${id}`, ...EN, F, polygon: [[-3, -2.2], [3, -2.2], [3, 2.2], [-3, 2.2]], s0: 25.5, s1: LUG_R - 4, tone: "mid", bevel: 0.25 });
  T.ball({ name: `engine.lugball.${id}`, ...EN, c: L0[id], r: ACT.ball, flats: [{ n: G.mul3(out, -1), d: 4 }], tone: "hi", material: "steel" });
}

// ───────────── Turbobomba y conductos (todo en el grupo yaw) ─────────────
const TP_AZ = 175;
const TP_C = polar(TP_AZ, 48, ZG);
const TF = G.frameOf(TP_C, [0, 0, -1], [1, 0, 0], [0, -1, 0]);
const OUT = dir(TP_AZ);
const tpPoint = (s, r, toward = OUT) => [TP_C[0] + toward[0] * r, TP_C[1] + toward[1] * r, ZG - s];
const tp = (name, s0, s1, r, extra = {}) => T.round({ name, ...EN, F: TF, s0, s1, r, tone: "hi", crease: "lo", ...extra });
tp("tp.inlet", 16, 18.5, 9, { tone: "mid", details: { bolts: [{ s: 16, r: 7.6, count: 8, size: 0.42 }] } });
tp("tp.neck", 18.5, 24, 7, { tone: "mid" });
tp("tp.lox", 24, 39, 13, { details: { seams: [27, 36] } });
tp("tp.ring.0", 39, 41, 14.4, { tone: "mid", details: { bolts: [{ s: 39, r: 13.7, count: 18, size: 0.38, fade: FADE }] } });
tp("tp.turbine", 41, 52, 15, { details: { seams: [44, 49] } });
tp("tp.ring.1", 52, 54, 14.4, { tone: "mid" });
tp("tp.fuel", 54, 68, 12, { details: { seams: [57, 65] } });
tp("tp.cap", 68, 71, 12, { tone: "mid", details: { bolts: [{ s: 71, r: 10.6, count: 10, size: 0.38, fade: FADE }] } });

// Un conducto recto con brida en cada extremo (las bridas son del conducto)
function duct(name, from, to, r, { flange = 1.5, thick = 1.2, ends = [true, true], chunk = 60, gaps: extra = [] } = {}) {
  const axis = G.unit3(G.sub3(to, from));
  const length = G.len3(G.sub3(to, from));
  const gaps = [...extra];
  if (ends[0]) gaps.push([0, thick]);
  if (ends[1]) gaps.push([length - thick, length]);
  T.tube({ name, ...EN, route: [from, to], r, chunk, gaps, tone: "hi", limp: false });
  [0, 1].forEach((end) => {
    if (!ends[end]) return;
    const centre = end ? G.add3(to, G.mul3(axis, -thick / 2)) : G.add3(from, G.mul3(axis, thick / 2));
    T.round({ name: `${name}.flange${end}`, ...EN, F: frameOn(centre, axis, Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : Z), s0: -thick / 2, s1: thick / 2, r: r * flange, tone: "mid", owner: name });
  });
}
// Codo: bola con dos planos donde aterrizan los tubos
function elbow(name, c, r, flats) {
  T.ball({ name, ...EN, c, r, flats: flats.map(([n, d]) => ({ n, d })), tone: "hi", material: "steel" });
  return flats.map(([n, d]) => G.add3(c, G.mul3(G.unit3(n), d)));
}

// LOX: de la bomba a la cámara, recto y horizontal
duct("pipe.lox", tpPoint(36, -13), onE(TP_AZ, 22, 36), 1.9, { flange: 1.5 });
// soporte de la turbobomba a la cámara
T.round({ name: "tp.strut", ...EN, F: frameOn(onE(TP_AZ, 22, 61), OUT, Z), s0: 0, s1: 48 - 12 - 22, r: 1.8, tone: "mid" });
// Escape de la turbina: tramo radial, codo y bajada hasta la altura de la salida
const EXH_R = 4.5;
const EXH_AT = 48 + 15 + 7.2;
const EXH_BALL = onE(TP_AZ, EXH_AT, 46);
const [exhDown] = elbow("exh.elbow", EXH_BALL, 7.2, [[[0, 0, -1], 4.7]]);
const EXH_END = onE(TP_AZ, EXH_AT, 200);
const BAND_AT = 120 - (46 + 4.7);
duct("exh.duct", exhDown, EXH_END, EXH_R, { ends: [false, false], chunk: 200, gaps: [[BAND_AT - 1, BAND_AT + 1]] });
T.round({ name: "exh.nozzle", ...EN, F: frameOn(EXH_END, [0, 0, -1], [1, 0, 0]), s0: 0, s1: 10, r: [EXH_R + 0.6, 7.4], tone: "mid", details: { seams: [2] } });
T.round({ name: "exh.band", ...EN, F: frameOn(onE(TP_AZ, EXH_AT, 120), [0, 0, -1], [1, 0, 0]), s0: -1, s1: 1, r: EXH_R + 0.8, tone: "mid", owner: "exh.duct" });
// Combustible: sale por abajo de la bomba, baja recto al colector en T y rodea la campana
const RING_S = 140;
const RING_R = 40;
const RING_T = 2.2;
const FUEL_X = tpPoint(71, -8);
const TEE = onE(TP_AZ, RING_R, RING_S);
const HALF = Math.asin(3.5 / RING_R) / DEG;
const [teeUp, teeA, teeB] = elbow("fuel.tee", TEE, 4.2, [[[0, 0, 1], 2.9], [dir(TP_AZ + HALF + 90), 3.5], [dir(TP_AZ - HALF - 90), 3.5]]);
duct("fuel.duct", FUEL_X, teeUp, 3, { flange: 1.33, ends: [true, false], chunk: 200 });
{
  const ring = G.arcPoints(EF, RING_S, RING_R, -(TP_AZ + HALF) * DEG, -(TP_AZ + 360 - HALF) * DEG, 96);
  T.tube({ name: "fuel.ring", ...EN, route: ring, r: RING_T, chunk: 40, turn: 30, tone: "hi", limp: false });
  void teeA;
  void teeB;
}
// Entrada de combustible: tramo corto, codo hacia arriba y brida donde llega el fuelle
const FIN_DIR = dir(130);
const FIN_BALL = [TP_C[0] + FIN_DIR[0] * 16.6, TP_C[1] + FIN_DIR[1] * 16.6, ZG - 64];
const [finUp] = elbow("fuel.inlet.elbow", FIN_BALL, 4.6, [[[0, 0, 1], 3.6]]);
const FIN_TOP = G.add3(finUp, [0, 0, 3]);
duct("fuel.inlet.riser", finUp, FIN_TOP, 2.6, { ends: [false, false] });
T.round({ name: "fuel.inlet.flange", ...EN, F: frameOn(FIN_TOP, [0, 0, 1], [1, 0, 0]), s0: 0, s1: 1.6, r: 4.2, tone: "mid", details: { bolts: [{ s: 1.6, r: 3.4, count: 6, size: 0.36 }] } });
// Generador de gas: cápsula junto a la turbina, con su salida a la turbina y un encendedor
const GG_DIR = dir(TP_AZ + 90);
const GG_C = [TP_C[0] + GG_DIR[0] * 26, TP_C[1] + GG_DIR[1] * 26];
const GGF = G.frameOf([GG_C[0], GG_C[1], ZG], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
T.round({ name: "gg.body", ...EN, F: GGF, s0: 31, s1: 50, r: 5.5, ends: ["dome", "dome"], tone: "hi", crease: "lo", material: "steel", details: { seams: [40.5] } });
T.round({ name: "gg.igniter", ...EN, F: GGF, s0: 31 - 5.5 - 3, s1: 31 - 5.5, r: 1.4, tone: "mid" });
// conector esférico entre el generador y la turbina (tangente a los dos)
T.ball({ name: "gg.outlet", ...EN, c: [TP_C[0] + GG_DIR[0] * 17.75, TP_C[1] + GG_DIR[1] * 17.75, ZG - 42], r: 2.75, tone: "hi", material: "steel" });
// Transductores de presión sobre la cámara y la turbobomba
for (const [name, az, s, r] of [["sensor.pc", 30, 60, 22], ["sensor.pc2", -60, 42, 22], ["sensor.tp", TP_AZ + 30, 64, 12]]) {
  const host = name === "sensor.tp" ? [TP_C[0], TP_C[1]] : [0, 0];
  const out = dir(az);
  const base = [host[0] + out[0] * r, host[1] + out[1] * r, ZG - s];
  const F = frameOn(base, out, Z);
  T.round({ name: `${name}.boss`, ...EN, F, s0: 0, s1: 2.2, r: 2, tone: "mid" });
  T.round({ name: `${name}.body`, ...EN, F, s0: 2.2, s1: 8, r: 2.6, tone: "hi", details: { seams: [3.4] } });
  T.round({ name: `${name}.cap`, ...EN, F, s0: 8, s1: 9.4, r: 1.8, tone: "mid" });
}
export const FEEDS = {
  lox: { top: [TP_C[0], TP_C[1], 400], bottom: [TP_C[0], TP_C[1], ZG - 16] },
  fuel: { top: [FIN_TOP[0], FIN_TOP[1], 396], bottom: [FIN_TOP[0], FIN_TOP[1], FIN_TOP[2] + 1.6] },
};

// Líneas fijas de alimentación, de la placa de empuje a la brida superior de cada fuelle
for (const [id, feed, r] of [["lox", FEEDS.lox, 5.2], ["fuel", FEEDS.fuel, 3.6]]) {
  const [x, y] = feed.top;
  const flangeR = r + 3;
  const svg = S(k.cylinder(x, y, r, feed.top[2] + 2, PLATE_Z[0] - feed.top[2] - 2, P, 32), { tone: "mid", crease: "none", inner: Ln([0.3, 0.6].map((f) => k.sideArc(x, y, r, feed.top[2] + 2 + f * (PLATE_Z[0] - feed.top[2] - 2), P, 24)).join(""), { tone: "faint" }) }) + S(k.cylinder(x, y, flangeR, feed.top[2], 2, P, 40, 0.3), { tone: "mid" }) + S(k.cylinder(x, y, flangeR, PLATE_Z[0] - 2, 2, P, 40, 0.3), { tone: "mid" });
  put("mid", `stand.feed.${id}`, [x, y, feed.top[2]], svg, [A.cylinder(x, y, flangeR, feed.top[2], 2), A.cylinder(x, y, r, feed.top[2] + 2, PLATE_Z[0] - feed.top[2] - 4), A.cylinder(x, y, flangeR, PLATE_Z[0] - 2, 2)], 40);
}

export const follow = (values) => ({ ...values });
export const poses = () => {
  const out = [];
  for (let p = -6; p <= 6; p += 1) for (let q = -6; q <= 6; q += 1) out.push({ pitch: p, yaw: q });
  return out;
};

const verify = argv.includes("--verify");
const out = T.build({ statics: R.items, poses, verify });
A.settle(R, P);
const layerOf = (name) => R.items.filter((item) => item.layer === name).sort((a, b) => a.key - b.key).map((item) => item.svg);
if (argv.includes("--audit")) {
  A.auditOrExit(R, P);
  TA.orbitOrExit(T, R, P, { poses: poses(), quick: argv.includes("--quick"), only: argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null });
}

// Lienzo de la página
const LABEL = "Banco de pruebas de vectorización de empuje: un motor cohete cuelga de un cardán de dos ejes bajo la placa de empuje de un pórtico de dos columnas. Dos actuadores electromecánicos, a 90° entre sí, empujan el motor por debajo del cardán y lo inclinan; bajo la tobera hay un foso de llamas en la losa.";
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<path class="iso-halo" d="${k.haloOf(DECK, -DECK_H - FOOT_H, DECK_H, P)}"/>`, ...layerOf("back")] });
const layerSvg = (list, cls) => `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-layer ${cls}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${list.join("")}</svg>`;
const restActs = ["lox", "fuel"].map((id) => bellowsSvg(G, k, P, FEEDS[id].top, FEEDS[id].bottom, [0, 0, 1], id, id === "fuel" ? { r: 5, core: 3.4, count: 14 } : {})).join("") + ["A", "B"].map((id) => actuatorSvg(G, k, P, U[id], L0[id], SIDE[id], id)).join("");
const actSvg = layerSvg([restActs], "tv-acts");
const midSvg = layerSvg(layerOf("mid"), "tv-mid");
const frontSvg = layerSvg(layerOf("front"), "tv-front");
const stage = `<div class="iso-stage iso-turn tv-stage" tabindex="0" role="application" aria-label="Motor con empuje vectorial. Mueve el puntero sobre la figura o usa las flechas para inclinar el motor; I enciende o apaga el motor.">${backSvg}<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-layer tv-fallback" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><linearGradient id="tv-fb" gradientUnits="userSpaceOnUse"><stop offset="0" class="tv-fb-0"/><stop offset=".35" class="tv-fb-1"/><stop offset="1" class="tv-fb-2"/></linearGradient></defs><path class="tv-fb-plume" fill="url(#tv-fb)"/></svg><canvas class="iso-layer tv-plume" aria-hidden="true"></canvas>${out.layerSvg("engine", { width: W, height: H })}${midSvg}${actSvg}${frontSvg}</div>`;

const DATA = {
  W, H, P, model: MODEL, turn: out.data,
  U, L0, SIDE, A1, A2, GC, FEEDS, exitS: BELL_S[1], exitR: EXIT_R, pit: [PIT.x, PIT.y, PIT.x + PIT.w, PIT.y + PIT.d], pitD: PIT_D, deck: [DECK.x, DECK.y, DECK.x + DECK.w, DECK.y + DECK.d],
  camera: glCamera(P),
};
// La biblioteca de tornos del kit, envuelta para no chocar con nombres de la página
const latheSource = readFileSync(join(HERE, "anatomy/kit/lathe.mjs"), "utf8").replace(/^import .*$/m, "");
const latheNames = [...latheSource.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
const G_SCRIPT = `const G = (() => {\n${latheSource.replace(/^export /gm, "")}\nreturn { ${latheNames.join(", ")} };\n})();\n`;
const ACT_SCRIPT = readFileSync(join(HERE, "actuators.mjs"), "utf8").replace(/^export /gm, "");
const CSS = out.css + "\n" + readFileSync(join(HERE, "tvc.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Empuje vectorial · banco TVC-1</span><span class="iso-plate-corner" data-corner="hint">Mueve el puntero para apuntar la tobera</span><span class="iso-plate-corner" data-corner="readout" data-readout>δ 0.0° · frío</span></div>`;
const caption = `Un cohete no tiene timón: se gobierna inclinando su motor. Este motor de ${MODEL.thrustKN} kN cuelga de un cardán de dos ejes, y dos actuadores electromecánicos, a 90° entre sí, lo empujan por debajo del cardán; la carrera que marca la lectura sale de la distancia real entre sus dos rótulas. Inclinar el empuje F un ángulo δ crea una fuerza lateral F·sen δ: a 6°, unos ${(MODEL.thrustKN * Math.sin(6 * DEG)).toFixed(0)} kN. Aplicada ${MODEL.leverM} m por debajo del centro de masa, eso es un par de ${((MODEL.thrustKN * Math.sin(6 * DEG) * MODEL.leverM) / 1000).toFixed(2)} MN·m que hace girar al vehículo. Los fuelles de las líneas de oxígeno y queroseno se doblan para seguir al motor. La I enciende y apaga.`;
const legend = k.plateHtml({
  fig: "",
  keys: [
    { mark: "lit", label: "Vástagos de los actuadores: su carrera inclina el motor" },
    { mark: "raised", label: "Motor, turbobomba y conductos: giran juntos sobre el cardán" },
    { mark: "flat", label: "Pórtico, placa de empuje y foso: fijos" },
  ],
  caption,
  body: "",
}).replace(/^[\s\S]*?(<figcaption)/, "$1").replace(/<\/figure>$/, "");
const controls = `<div class="tv-controls"><button type="button" class="tv-fire" data-fire><span class="tv-lamp" aria-hidden="true"></span><span data-fire-label>Encender</span></button><span class="tv-live" aria-live="polite" data-say></span></div>`;
const body = `<figure class="iso-figure tv"><div class="iso-plate">${corners}<style>${CSS}</style>${stage}${controls}</div>${legend}</figure>`;
const page = k.pageHtml({ title: "Empuje vectorial", theme: THEME, body, script: kitScript() + G_SCRIPT + ACT_SCRIPT + turnScript() + glScript() + (verify ? `window.__isoVerify = ${JSON.stringify(out.verify)};\n` : "") + LIVE, width: 940 });
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const name = `motor-vectorial${verify ? "-verify" : ""}${THEME === "light" ? "-light" : ""}.html`;
  writeFileSync(join(HERE, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${out.report.parts} parts · ${out.report.layers.map((l) => `${l.name}: ${l.planar} planes, ${l.dynamic} dynamic`).join(" · ")} · build ${out.report.seconds.toFixed(1)} s`);
}
