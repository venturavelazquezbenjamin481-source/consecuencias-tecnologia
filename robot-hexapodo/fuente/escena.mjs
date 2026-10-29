// Escena fija del robot: tapete de corte, marco de balsa, motores, pila,
// interruptor, cables y eje en L. Devuelve el SVG ya ordenado por profundidad.
import * as k from "./skill/kit/iso-kit.mjs";
import * as G from "./skill/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "./skill/kit/tube.mjs";
import * as A from "./skill/kit/audit.mjs";
import { MODELO } from "./modelo.mjs";

export const ANCHO = 640;
export const ALTO = 420;
export const AZIMUT = 62;

// Tapete de corte
export const TAPETE = { x: -128, y: -90, w: 256, d: 182, r: 5 };
const SUELO = MODELO.suelo;

// Puntos extremos para encuadrar la cámara
const extremos = [
  ...k.boxCorners(TAPETE, SUELO - 3, SUELO),
  [0, 75, 76], [0, -75, 76], [-110, -70, 30], [110, 75, 30],
];
export const P = k.fitProjection(extremos, ANCHO, ALTO, { pad: 18, azimuth: AZIMUT });

export function escena() {
  const R = A.recorder(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const camino = (puntos, cerrado) => k.pathOf(puntos.map(at), cerrado);
  const centroDe = (plan, z, h) => [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];

  // Pone una losa (prisma sobre el piso) con su forma registrada
  function losa(nombre, plan, z, h, estilo = {}, { pasos = 3, bisel = 0, inner = "", extra = "", bias = 0, clase = "", meta = {} } = {}) {
    const svg = S(k.slabOf(plan, z, h, P, pasos, bisel), { ...estilo, inner }) + extra;
    return R.put({ name: nombre, at: centroDe(plan, z, h), bias, svg: clase ? `<g class="${clase}">${svg}</g>` : svg, shapes: [R.solid(A.slab(plan, z, h, { name: nombre, ...meta }, pasos))] });
  }

  // Cilindro sobre cualquier eje
  function rodillo(nombre, F, s0, s1, r, estilo = {}, { inner = "", extra = "", bias = 0, clase = "" } = {}) {
    const svg = S(G.disc(s0, s1, r, F, P), { ...estilo, inner }) + extra;
    return R.put({ name: nombre, at: G.pointOf(F, (s0 + s1) / 2, 0, 0), bias, svg: clase ? `<g class="${clase}">${svg}</g>` : svg, shapes: [R.solid(A.disc(F, s0, s1, r, { name: nombre }))] });
  }

  // ---------- Tapete de corte con cuadrícula de 1 cm ----------
  const fondo = [];
  fondo.push(`<path class="iso-halo" d="${k.haloOf(TAPETE, SUELO - 3, 3, P)}"/>`);
  let cuadMenor = "";
  let cuadMayor = "";
  for (let x = -110; x <= 110; x += 10) {
    const d = k.lineOnTop([x, TAPETE.y + 14], [x, TAPETE.y + TAPETE.d - 14], SUELO, P);
    if (x % 50 === 0) cuadMayor += d;
    else cuadMenor += d;
  }
  for (let y = TAPETE.y + 14; y <= TAPETE.y + TAPETE.d - 14 + 1e-6; y += 10) {
    const d = k.lineOnTop([TAPETE.x + 10, y], [TAPETE.x + TAPETE.w - 10, y], SUELO, P);
    if (Math.round(y - TAPETE.y - 14) % 50 === 0) cuadMayor += d;
    else cuadMenor += d;
  }
  // Marco de la cuadrícula: un rectángulo cerrado donde terminan todas las líneas
  const marcoCuad = k.planOutline({ x: TAPETE.x + 10, y: TAPETE.y + 14, w: TAPETE.w - 20, d: TAPETE.d - 28, r: 0 }, SUELO, P, 1);
  const regla = { x: TAPETE.x + 10, y: TAPETE.y + TAPETE.d - 11, w: TAPETE.w - 20, d: 7, r: 1 };
  const marcas = k.topTicks(regla.x + 2, regla.x + regla.w - 2, 2, 5, regla.y + 0.8, SUELO + 0.5, [1.6, 3.4], P);
  fondo.push(
    S(k.slabOf(TAPETE, SUELO - 3, 3, P, 6, 0.8), {
      tone: "mid",
      inner: Ln(cuadMenor, { tone: "faint" }) + Ln(cuadMayor, { tone: "lo" }) + Ln(marcoCuad, { tone: "lo" }),
    }),
  );
  fondo.push(S(k.slabOf(regla, SUELO, 0.5, P, 3), { tone: "lo", crease: "none" }));
  fondo.push(Ln(marcas.minor, { tone: "lo" }), Ln(marcas.major, { tone: "mid" }));
  fondo.push(D([at([regla.x + 1.2, regla.y + 3.5, SUELO + 0.5]), at([regla.x + regla.w - 1.2, regla.y + 3.5, SUELO + 0.5])], { size: 0.45 }));
  R.solid(A.slab(TAPETE, SUELO - 3, 3, { name: "stand.tapete", ground: true }, 6));

  // ---------- Marco de balsa (pieza 9) ----------
  const T = MODELO.tira;
  const g = MODELO.grosor;
  const travesanos = [-1, 1].map((s) => ({ x: s > 0 ? 100 - T : -100, y: -60, w: T, d: 120, r: 0.6 }));
  const largueros = [-1, 1].map((s) => ({ x: -100, y: s > 0 ? 60 - T : -60, w: 200, d: T, r: 0.6 }));
  const barra = { x: -T / 2, y: -47.5, w: T, d: 95, r: 0.4 };
  // Veta de la balsa: líneas a lo largo de cada tira, de punta a punta
  const vetaX = (plan, z) => [0.3, 0.62].map((f) => k.lineOnTop([plan.x, plan.y + plan.d * f], [plan.x + plan.w, plan.y + plan.d * f], z, P)).join("");
  const vetaY = (plan, z) => [0.35, 0.7].map((f) => k.lineOnTop([plan.x + plan.w * f, plan.y], [plan.x + plan.w * f, plan.y + plan.d], z, P)).join("");
  // Los travesaños descansan sobre las patas (que se dibujan aparte), así que cuentan como apoyo
  travesanos.forEach((plan, i) => losa(`marco.travesano${i}`, plan, -g, g, { tone: "mid" }, { inner: Ln(vetaY(plan, 0), { tone: "faint" }), clase: "pieza p9", meta: { ground: true } }));
  largueros.forEach((plan, i) => {
    // Tornillos donde el larguero cruza cada travesaño
    const tornillos = [-1, 1].map((s) => [s * (100 - T / 2), plan.y + plan.d / 2]);
    const cabezas = Ln(tornillos.map(([x, y]) => k.ring(x, y, 1.9, g, P, 18)).join(""), { tone: "lo" }) + Ln(tornillos.map(([x, y]) => k.lineOnTop([x - 1.3, y], [x + 1.3, y], g, P)).join(""), { tone: "mid" });
    losa(`marco.larguero${i}`, plan, 0, g, { tone: "mid" }, { inner: Ln(vetaX(plan, g), { tone: "faint" }), extra: cabezas, bisel: 0.4, clase: "pieza p9" });
  });
  losa("marco.barra", barra, 0, g, { tone: "mid" }, { inner: Ln(vetaY(barra, g), { tone: "faint" }), clase: "pieza p9" });

  // ---------- Motorreductores de 100 rpm ----------
  const Z0 = g;
  const zFlecha = MODELO.polea.z;
  for (const s of [1, -1]) {
    const caja = s > 0 ? { x: -11, y: 23, w: 37, d: 22.5, r: 1.2 } : { x: -26, y: -45.5, w: 37, d: 22.5, r: 1.2 };
    const yc = caja.y + caja.d / 2;
    const costura = Ln(k.sideSeam(caja, zFlecha, P, 3), { tone: "faint" });
    const tapa = k.planOutline(k.insetPlan(caja, 2.4), Z0 + 22, P, 3);
    const agujeros = [caja.x + 5, caja.x + caja.w - 5].map((x) => k.ring(x, yc, 1.5, Z0 + 22, P, 14)).join("");
    losa(`motor${s}.caja`, caja, Z0, 22, { tone: "hi" }, { inner: costura, extra: Ln(tapa, { tone: "faint" }) + Ln(agujeros, { tone: "lo" }), bisel: 0.5, clase: "pieza motor" });
    // Lata del motor a lo largo de x
    const x0 = s > 0 ? caja.x + caja.w : caja.x;
    const dir = s > 0 ? [1, 0, 0] : [-1, 0, 0];
    const F = G.frameOf([x0, yc, zFlecha], dir, [0, 1, 0], [0, 0, 1]);
    const bandas = Ln(G.arcOf(F, 6, 10, P) + G.arcOf(F, 18, 10, P), { tone: "faint" });
    rodillo(`motor${s}.lata`, F, 0, 24, 10, { tone: "mid" }, { inner: bandas, clase: "pieza motor" });
    rodillo(`motor${s}.tapa`, F, 24, 27, 8, { tone: "lo" }, { clase: "pieza motor" });
    // Terminales: lengüetas en la tapa
    for (const t of [-5, 5]) {
      const Ft = G.frameOf(G.pointOf(F, 27, 0, 0), dir, [0, 1, 0], [0, 0, 1]);
      const poly = [[t - 1.2, -0.8], [t + 1.2, -0.8], [t + 1.2, 0.8], [t - 1.2, 0.8]];
      R.put({ name: `motor${s}.terminal${t}`, at: G.pointOf(Ft, 1.2, t, 0), svg: S(G.prismOf(Ft, poly, 0, 2.6, P), { tone: "mid" }), shapes: [R.solid(A.prism(Ft, poly, 0, 2.6, { name: `motor${s}.terminal${t}` }))] });
    }
    // Flecha que sale del marco hacia la polea
    const Ff = G.frameOf([0, 0, zFlecha], [0, s, 0], [1, 0, 0], [0, 0, 1]);
    rodillo(`motor${s}.flecha`, Ff, 45.5, 58, 2.7, { tone: "mid", crease: "none" });
    rodillo(`motor${s}.flecha2`, Ff, 60, 61, 2.7, { tone: "mid", crease: "none" });
    // Cinta que sujeta la caja a la barra central (dos tiras, una a cada lado de la flecha)
    const yA = s > 0 ? caja.y : -(caja.y + caja.d);
    const tiras = [
      [yA - 0.4, yA + caja.d + 0.4, Z0 + 22, 0.4],
      [yA - 0.4, yA, Z0 + 0.4, 21.6],
      [yA - 8, yA - 0.4, Z0, 0.4],
      [yA + caja.d, yA + caja.d + 0.4, Z0 + 0.4, 21.6],
      [yA + caja.d + 0.4, 47.5, Z0, 0.4],
    ];
    for (const xb of [-5.5, 3]) {
      tiras.forEach(([ya, yb, z, h], i) => {
        const plan = s > 0 ? { x: xb, y: ya, w: 2.5, d: yb - ya, r: 0.1 } : { x: xb, y: -yb, w: 2.5, d: yb - ya, r: 0.1 };
        losa(`cinta${s}.${xb}.${i}`, plan, z, h, { tone: "lo", crease: "none" }, { pasos: 1, clase: "cinta" });
      });
    }
  }

  // ---------- Pila de 9 V con su broche ----------
  const pila = { x: -24, y: -13, w: 48.5, d: 26, r: 2 };
  const zPila = Z0 + 17.5;
  const etiqueta = Ln(k.sideSeam(pila, Z0 + 3, P, 4) + k.sideSeam(pila, Z0 + 14.5, P, 4), { tone: "lo" });
  const texto = k.faceTextSvg(k.topMatrix([4, 5], zPila, P, "x"), "9V", { size: 6, tone: "mid", anchor: "middle" });
  losa("pila", pila, Z0, 17.5, { tone: "hi" }, { inner: etiqueta, extra: texto, pasos: 4, bisel: 0.6, clase: "pieza pila" });
  const broche = { x: -31, y: -11, w: 7.2, d: 22, r: 1.6 };
  losa("pila.broche", broche, Z0 + 2.5, 13, { tone: "lo" }, { pasos: 3, bisel: 0.4, clase: "pieza pila" });

  // ---------- Interruptor sobre el larguero cercano ----------
  const inter = { x: -72, y: 49.5, w: 20, d: 9, r: 1 };
  const palanca = { x: -64.5, y: 52.2, w: 4, d: 3.6, r: 0.8 };
  const ranuraI = k.planOutline({ x: -68, y: 53.2, w: 12, d: 1.6, r: 0.8 }, Z0 + 7, P, 3);
  losa("interruptor", inter, Z0, 7, { tone: "hi" }, { extra: Ln(ranuraI, { tone: "lo" }), bisel: 0.4, clase: "pieza interruptor" });
  losa("interruptor.palanca", palanca, Z0 + 7, 3.4, { tone: "hi", lit: true }, { pasos: 2, clase: "pieza interruptor palanca" });

  // ---------- Eje de rotación en L (piezas 6 y 7), uno por lado ----------
  for (const s of [1, -1]) {
    const y0 = s > 0 ? 50 : -60;
    // Base: medio palito acostado, punta redonda hacia +x, fijo con 3 alfileres
    const anillo = [];
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      anillo.push([47 + 5 * Math.cos(a), y0 + 5 + 5 * Math.sin(a)]);
    }
    anillo.push([-5, y0 + 10], [-5, y0]);
    const veta = [y0 + 3, y0 + 6.6].map((yy) => k.lineOnTop([-5, yy], [47 + Math.sqrt(25 - (yy - y0 - 5) ** 2) - 0.15, yy], Z0 + 2, P)).join("");
    const triangulo = [[18, y0 + 2.6], [34, y0 + 2.6], [26, y0 + 7.4]];
    const cabezas = triangulo.map(([x, y]) => [x, y, Z0 + 2 + 1.6]);
    const baseSvg = S(k.extrude(anillo, Z0, 2, P), { tone: "hi", inner: Ln(veta, { tone: "faint" }) });
    R.put({ name: `eje${s}.base`, at: [21, y0 + 5, Z0 + 1], svg: `<g class="pieza p6">${baseSvg}</g>`, shapes: [R.solid(A.extruded(anillo, Z0, 2, { name: `eje${s}.base` }))] });
    for (const [i, c] of cabezas.entries()) {
      R.put({ name: `eje${s}.alfiler${i}`, at: c, bias: 0.5, svg: `<g class="pieza p6">${S(G.sphereOf(c, 1.7, P, { steps: 24 }), { tone: "hi" })}</g>`, shapes: [R.solid(A.ball(c, 1.7, { name: `eje${s}.alfiler${i}` }))] });
    }
    // Brazo vertical: medio palito parado, con el orificio donde gira la pata central
    const E = [MODELO.eje.x, MODELO.eje.z];
    const brazo = [[-5, Z0 + 2], [5, Z0 + 2]];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      brazo.push([E[0] + 5 * Math.cos(a), E[1] + 5 * Math.sin(a)]);
    }
    const Fb = G.frameOf([0, 0, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
    const ys = s > 0 ? [58, 60] : [-60, -58];
    const cara = ys[1];
    const hueco = G.circleOf(G.frameAlong([E[0], 0, E[1]], [0, 1, 0]), cara, 1.3, P, 20);
    const vetaB = [-2.2, 1.8].map((o) => camino([[o, cara, Z0 + 2], [o, cara, E[1] + Math.sqrt(25 - o * o) - 0.15]])).join("");
    const brazoSvg = S(G.prismOf(Fb, brazo, ys[0], ys[1], P), { tone: "hi", inner: s > 0 ? Ln(vetaB, { tone: "faint" }) + Ln(hueco, { tone: "lo" }) : "" });
    R.put({ name: `eje${s}.brazo`, at: [0, (ys[0] + ys[1]) / 2, (Z0 + E[1]) / 2], svg: `<g class="pieza p7">${brazoSvg}</g>`, shapes: [R.solid(A.prism(Fb, brazo, ys[0], ys[1], { name: `eje${s}.brazo`, owner: `eje${s}` }))] });
  }

  // ---------- Cables (rojo = positivo, negro = negativo) ----------
  const cables = [];
  function cable(nombre, puntos, color) {
    const ruta = G.fillet(puntos, 3.2, 7, { P, tube: 0.75 });
    const piezas = tubePieces(ruta, 0.75, P, { maxLength: 14 });
    piezas.forEach((pz, i) => {
      R.put({ name: `${nombre}#${i}`, at: pz.mid, svg: `<g class="cable cable-${color}">${tubeSvg(pz, { tone: color === "rojo" ? "red" : "hi" })}${flujoDe(k, P, ruta, pz, color === "negro")}</g>`, shapes: [A.tube(pz.points, pz.radii, { name: nombre })], route: nombre, chunk: i });
    });
    R.route(nombre, ruta, 0.75, { limp: true });
    cables.push({ nombre, ruta, color });
  }
  // Broche (+) -> interruptor
  cable("cable.pila-interruptor", [[-31, 4, 15], [-40, 4, 16], [-62, 30, 16], [-62, 45, 11.5], [-62, 49.5, 11.5]], "rojo");
  // Interruptor -> motor cercano (lengüeta exterior)
  cable("cable.interruptor-motor1", [[-52, 52, 11.5], [-47, 52, 11.5], [-44, 48.6, 9.3], [56.5, 48.6, 9.3], [60, 39.25, 19], [55.6, 39.25, 19]], "rojo");
  // Interruptor -> motor lejano (lengüeta interior: polaridad invertida)
  cable("cable.interruptor-motor2", [[-56, 49.5, 11.5], [-56, 45, 11.5], [-58, -20, 10], [-59, -29.25, 19], [-55.6, -29.25, 19]], "rojo");
  // Broche (-) -> motor lejano (lengüeta exterior)
  cable("cable.pila-motor2", [[-31, -5, 15], [-36, -5, 15], [-36, -16, 15], [-64, -22, 15], [-64, -39.25, 19], [-55.6, -39.25, 19]], "negro");
  // Broche (-) -> motor cercano (lengüeta interior), por encima de la pila
  cable("cable.pila-motor1", [[-27.4, -8, 23.5], [-27.4, -8, 31], [27, -8, 31], [31, -8, 21], [31, -8, 13], [57, -8, 13], [60, 10, 15], [60, 29.25, 19], [55.6, 29.25, 19]], "negro");

  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  const cuerpo = R.items.map((it) => it.svg).join("");
  return { R, fondo: fondo.join(""), cuerpo, cables };
}

// Marca de corriente que viaja por un cable: cada tramo sabe dónde empieza en pantalla
export function flujoDe(k, P, ruta, pz, inverso) {
  const pant = ruta.map((p) => k.iso(p, P));
  let s3 = 0;
  let s2 = 0;
  let inicio = 0;
  for (let i = 1; i < ruta.length; i++) {
    const d3 = Math.hypot(ruta[i][0] - ruta[i - 1][0], ruta[i][1] - ruta[i - 1][1], ruta[i][2] - ruta[i - 1][2]);
    const d2 = Math.hypot(pant[i][0] - pant[i - 1][0], pant[i][1] - pant[i - 1][1]);
    if (s3 + d3 >= pz.from) {
      inicio = s2 + d2 * ((pz.from - s3) / (d3 || 1));
      break;
    }
    s3 += d3;
    s2 += d2;
  }
  const d = k.pathOf(pz.points.map((p) => k.iso(p, P)));
  return `<path class="flujo${inverso ? " flujo-inverso" : ""}" d="${d}" style="--inicio:${inicio.toFixed(2)}px"/>`;
}
