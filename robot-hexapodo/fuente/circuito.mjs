// Circuito eléctrico: pila de 9 V, interruptor y dos motorreductores con la polaridad invertida.
// Los dos motores se dibujan lado a lado con la flecha hacia el frente para que se vea
// que giran en sentidos opuestos.
import * as k from "./skill/kit/iso-kit.mjs";
import * as G from "./skill/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "./skill/kit/tube.mjs";
import * as A from "./skill/kit/audit.mjs";
import { flujoDe } from "./escena.mjs";

export const ANCHO_C = 640;
export const ALTO_C = 400;
const MESA = { x: -122, y: -64, w: 244, d: 128, r: 5 };

export const PC = k.fitProjection([...k.boxCorners(MESA, -3, 0), [-45, 52, 54], [45, 52, 54]], ANCHO_C, ALTO_C, { pad: 22, azimuth: 62 });

export function construirCircuito(P = PC) {
  const R = A.recorder(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const camino = (puntos, cerrado) => k.pathOf(puntos.map(at), cerrado);
  const centroDe = (plan, z, h) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
  function losa(nombre, plan, z, h, estilo = {}, { pasos = 3, bisel = 0, inner = "", extra = "", clase = "", meta = {} } = {}) {
    const svg = S(k.slabOf(plan, z, h, P, pasos, bisel), { ...estilo, inner }) + extra;
    return R.put({ name: nombre, at: centroDe(plan, z, h), svg: clase ? `<g class="${clase}">${svg}</g>` : svg, shapes: [R.solid(A.slab(plan, z, h, { name: nombre, ...meta }, pasos))] });
  }
  function rodillo(nombre, F, s0, s1, r, estilo = {}, { inner = "", extra = "", clase = "" } = {}) {
    const svg = S(G.disc(s0, s1, r, F, P), { ...estilo, inner }) + extra;
    return R.put({ name: nombre, at: G.pointOf(F, (s0 + s1) / 2, 0, 0), svg: clase ? `<g class="${clase}">${svg}</g>` : svg, shapes: [R.solid(A.disc(F, s0, s1, r, { name: nombre }))] });
  }

  // Tapete de corte
  const fondo = [`<path class="iso-halo" d="${k.haloOf(MESA, -3, 3, P)}"/>`];
  let menor = "";
  let mayor = "";
  const cuad = { x: MESA.x + 8, y: MESA.y + 8, w: MESA.w - 16, d: MESA.d - 16, r: 0 };
  for (let x = -110; x <= 110; x += 10) (x % 50 === 0 ? (mayor += k.lineOnTop([x, cuad.y], [x, cuad.y + cuad.d], 0, P)) : (menor += k.lineOnTop([x, cuad.y], [x, cuad.y + cuad.d], 0, P)));
  for (let y = cuad.y + 10; y < cuad.y + cuad.d; y += 10) menor += k.lineOnTop([cuad.x, y], [cuad.x + cuad.w, y], 0, P);
  fondo.push(S(k.slabOf(MESA, -3, 3, P, 6, 0.8), { tone: "mid", inner: Ln(menor, { tone: "faint" }) + Ln(mayor, { tone: "lo" }) + Ln(k.planOutline(cuad, 0, P, 1), { tone: "lo" }) }));
  R.solid(A.slab(MESA, -3, 3, { name: "stand.mesa", ground: true }, 6));

  // Motorreductores: A a la izquierda, B a la derecha, flecha hacia el frente (+y)
  const MOT = [
    { id: "A", sx: -45, lado: -1, mas: 21.25, giro: -1 },
    { id: "B", sx: 45, lado: 1, mas: 31.25, giro: 1 },
  ];
  const zc = 27;
  const pinesMotor = [];
  for (const m of MOT) {
    const caja = m.lado < 0 ? { x: m.sx - 26, y: 15, w: 37, d: 22.5, r: 1.2 } : { x: m.sx - 11, y: 15, w: 37, d: 22.5, r: 1.2 };
    const bloque = { x: caja.x + 4, y: 17, w: 29, d: 18.5, r: 0.6 };
    losa(`motor${m.id}.bloque`, bloque, 0, 16, { tone: "mid" }, { inner: Ln([0.35, 0.7].map((f) => k.lineOnTop([bloque.x, bloque.y + bloque.d * f], [bloque.x + bloque.w, bloque.y + bloque.d * f], 16, P)).join(""), { tone: "faint" }) });
    const signos = [
      [m.mas, "+"],
      [m.mas === 21.25 ? 31.25 : 21.25, "−"],
    ];
    const xs = m.lado < 0 ? caja.x + 5 : caja.x + caja.w - 5;
    const marcas = signos.map(([y, t]) => `<g class="${t === "+" ? "signo-mas" : "signo-menos"}">${k.faceTextSvg(k.topMatrix([xs, y + 2], 38, P, "x"), t, { size: 8, tone: "hi", anchor: "middle" })}</g>`).join("");
    losa(`motor${m.id}.caja`, caja, 16, 22, { tone: "hi" }, { inner: Ln(k.sideSeam(caja, zc, P, 3), { tone: "faint" }), extra: Ln(k.planOutline(k.insetPlan(caja, 2.4), 38, P, 3), { tone: "faint" }) + marcas, bisel: 0.5, clase: "pieza motor" });
    const x0 = m.lado < 0 ? caja.x : caja.x + caja.w;
    const dir = [m.lado, 0, 0];
    const F = G.frameOf([x0, 26.25, zc], dir, [0, 1, 0], [0, 0, 1]);
    rodillo(`motor${m.id}.lata`, F, 0, 24, 10, { tone: "mid" }, { inner: Ln(G.arcOf(F, 6, 10, P) + G.arcOf(F, 18, 10, P), { tone: "faint" }), clase: "pieza motor" });
    rodillo(`motor${m.id}.tapa`, F, 24, 27, 8, { tone: "lo" }, { clase: "pieza motor" });
    for (const t of [-5, 5]) {
      const Ft = G.frameOf(G.pointOf(F, 27, 0, 0), dir, [0, 1, 0], [0, 0, 1]);
      const poly = [[t - 1.2, -0.8], [t + 1.2, -0.8], [t + 1.2, 0.8], [t - 1.2, 0.8]];
      R.put({ name: `motor${m.id}.terminal${t}`, at: G.pointOf(Ft, 1.3, t, 0), svg: S(G.prismOf(Ft, poly, 0, 2.6, P), { tone: "mid" }), shapes: [R.solid(A.prism(Ft, poly, 0, 2.6, { name: `motor${m.id}.terminal${t}` }))] });
    }
    // Flecha y polea con la marca de giro
    const Ff = G.frameOf([m.sx, 0, zc], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    rodillo(`motor${m.id}.flecha`, Ff, 37.5, 48, 2.7, { tone: "mid", crease: "none" });
    const Fp = G.frameOf([m.sx, 0, zc], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    const cara = 52;
    const r = 25;
    const p = (rr, t) => G.pointOf(Fp, cara, rr, t);
    // Flecha curva del sentido de giro (es lo que se quiere mostrar)
    const desde = m.giro < 0 ? 2.6 : 0.55;
    const hasta = m.giro < 0 ? 0.55 : 2.6;
    const arco = [];
    for (let i = 0; i <= 40; i++) arco.push(p(16, desde + (hasta - desde) * (i / 40)));
    const fin = hasta;
    const tg = m.giro < 0 ? -1 : 1;
    const punta = [p(16, fin + tg * 0.22), p(19.2, fin - tg * 0.05), p(12.8, fin - tg * 0.05)];
    const marcasPolea = Ln(G.circleOf(Fp, cara, r - 2, P), { tone: "lo" }) + Ln(G.circleOf(Fp, cara, 3, P, 24), { tone: "lo" }) + Ln(G.circleOf(G.frameAlong(p(10, Math.PI / 2), [0, 1, 0]), 0, 1.8, P, 20), { tone: "lo" });
    const giroSvg = `<path class="giro" d="${camino(arco)}"/><path class="giro-punta" d="${camino(punta, true)}"/>`;
    const ranura = Ln(G.arcOf(Fp, 49.5, r, P) + G.arcOf(Fp, 50.5, r, P), { tone: "faint" });
    R.put({ name: `motor${m.id}.polea`, at: G.pointOf(Fp, 50, 0, 0), svg: `<g class="pieza motor">${S(G.disc(48, 52, r, Fp, P), { tone: "hi", inner: ranura }) + marcasPolea + giroSvg}</g>`, shapes: [R.solid(A.disc(Fp, 48, 52, r, { name: `motor${m.id}.polea` }))] });
    pinesMotor.push({ id: m.id, at: at([m.sx + 13, 52, zc - 13]) });
  }

  // Pila de 9 V
  const pila = { x: -24, y: -48, w: 48.5, d: 26, r: 2 };
  losa("pila", pila, 0, 17.5, { tone: "hi" }, { clase: "pieza pila", inner: Ln(k.sideSeam(pila, 3, P, 4) + k.sideSeam(pila, 14.5, P, 4), { tone: "lo" }), extra: k.faceTextSvg(k.topMatrix([2, -32], 17.5, P, "x"), "9V", { size: 7, tone: "mid", anchor: "middle" }), pasos: 4, bisel: 0.6 });
  losa("pila.broche", { x: -31, y: -46, w: 7.2, d: 22, r: 1.6 }, 2.5, 13, { tone: "lo" }, { bisel: 0.4, clase: "pieza pila" });

  // Interruptor deslizable
  const inter = { x: -30, y: -2, w: 20, d: 9, r: 1 };
  losa("interruptor", inter, 0, 7, { tone: "hi" }, { clase: "pieza interruptor", extra: Ln(k.planOutline({ x: -26, y: 1.7, w: 12, d: 1.6, r: 0.8 }, 7, P, 3), { tone: "lo" }), bisel: 0.4 });
  losa("interruptor.palanca", { x: -17.5, y: 0.7, w: 4, d: 3.6, r: 0.8 }, 7, 3.4, { tone: "hi", lit: true }, { pasos: 2, clase: "pieza interruptor palanca" });

  // Cables
  function cable(nombre, puntos, color) {
    const ruta = G.fillet(puntos, 7, 9, { P, tube: 0.75 });
    tubePieces(ruta, 0.75, P, { maxLength: 14 }).forEach((pz, i) => {
      R.put({ name: `${nombre}#${i}`, at: pz.mid, svg: `<g class="cable cable-${color}">${tubeSvg(pz, { tone: color === "rojo" ? "red" : "hi" })}${flujoDe(k, P, ruta, pz, color === "negro")}</g>`, shapes: [A.tube(pz.points, pz.radii, { name: nombre })], route: nombre, chunk: i });
    });
    R.route(nombre, ruta, 0.75, { limp: true });
  }
  const zs = 1.2;
  cable("rojo.pila-interruptor", [[-31, -27, 9], [-38, -27, 9], [-48, -16, zs], [-48, -8, zs], [-40, 2.5, 3.5], [-30, 2.5, 3.5]], "rojo");
  cable("rojo.interruptor-A", [[-20, 7, 3.5], [-20, 10.5, 3.5], [-26, 14, zs], [-96, 14, zs], [-106, 21.25, 8], [-106, 21.25, zc], [-100.6, 21.25, zc]], "rojo");
  cable("rojo.interruptor-B", [[-10, 2.5, 3.5], [-6, 2.5, 3.5], [2, -2, zs], [88, -2, zs], [106, 8, zs], [106, 21.25, 16], [106, 21.25, zc], [100.6, 21.25, zc]], "rojo");
  cable("negro.pila-A", [[-31, -35, 9], [-38, -35, 9], [-46, -42, zs], [-106, -42, zs], [-116, -32, zs], [-116, 22, 6], [-116, 31.25, 14], [-116, 31.25, zc], [-100.6, 31.25, zc]], "negro");
  cable("negro.pila-B", [[-31, -40, 9], [-36, -40, 9], [-42, -54, zs], [106, -54, zs], [116, -44, zs], [116, 22, 6], [116, 31.25, 14], [116, 31.25, zc], [100.6, 31.25, zc]], "negro");

  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  return { R, fondo: fondo.join(""), cuerpo: R.items.map((it) => it.svg).join(""), pinesMotor };
}

export const CSS_CIRCUITO = `.signo-mas .iso-face-text{fill:#d9473f;font-weight:700}.signo-menos .iso-face-text{font-weight:700}.giro{fill:none;stroke:var(--anatomy-lit);stroke-width:1.6px;stroke-linecap:round;vector-effect:non-scaling-stroke}.giro-punta{fill:var(--anatomy-lit);stroke:var(--anatomy-lit);stroke-width:1px;stroke-linejoin:round;vector-effect:non-scaling-stroke}`;

export const POLEAS_C = [
  { id: "A", c: [-45, 52, 27], giro: -1 },
  { id: "B", c: [45, 52, 27], giro: 1 },
];

export function circuitoSvg({ extra = "" } = {}) {
  const C = construirCircuito();
  const pines = C.pinesMotor.map(({ id, at: [x, y] }) => `<g class="pin"><circle class="fondo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.4"/><text x="${x.toFixed(1)}" y="${(y + 0.3).toFixed(1)}">${id}</text></g>`).join("");
  return `<style>${CSS_CIRCUITO}</style>` + k.figureSvg({ width: ANCHO_C, height: ALTO_C, label: "Circuito: pila de 9 V, interruptor y dos motorreductores con la polaridad invertida.", body: [C.fondo, C.cuerpo, extra, pines] });
}

if (process.argv[1].endsWith("circuito.mjs")) {
  const C = construirCircuito();
  A.auditOrExit(C.R, PC, {});
}
