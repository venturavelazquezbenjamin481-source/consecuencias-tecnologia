// Fig. 2: corte de un cuarto de la cámara de empuje. Se quita la cuña de 90° que mira al espectador:
// por ella se ve el interior de los 270° restantes, con las dos caras cortadas de la pared.
import { tubePieces, tubeSvg } from "./anatomy/kit/tube.mjs";

export const GAMMA = 1.2;

// Perfil interior (radio del gas) y exterior (pared), en cm, por estación s bajo el cardán
export function profiles(bell, BELL_S) {
  const T = 1.2;
  const throatS = 96;
  const throatR = bell(BELL_S[0]) - T;
  const gas = (s) => {
    if (s < 28) return 25.5 - 2 - ((28 - s) / 10) * 9.5;
    if (s <= 80) return 20.4;
    if (s <= throatS) return 20.4 + ((throatR - 20.4) * (s - 80)) / (throatS - 80);
    if (s <= BELL_S[0]) return throatR;
    return bell(s) - T;
  };
  const wall = (s) => {
    if (s < 28) return gas(s) + 2;
    if (s <= 80) return 22;
    if (s <= 94) return 22 + ((12.6 - 22) * (s - 80)) / 14;
    if (s <= BELL_S[0]) return 12.6 + ((bell(BELL_S[0]) - 12.6) * (s - 94)) / (BELL_S[0] - 94);
    return bell(s);
  };
  return { gas, wall, throatS, throatR, T };
}

// Mach a partir de la relación de áreas A/A* (rama subsónica o supersónica)
export function machOf(ratio, supersonic, g = GAMMA) {
  const f = (M) => (1 / M) * ((2 / (g + 1)) * (1 + ((g - 1) / 2) * M * M)) ** ((g + 1) / (2 * (g - 1)));
  let lo = supersonic ? 1 : 1e-4;
  let hi = supersonic ? 20 : 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if ((f(mid) > ratio) === supersonic) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
export const pOf = (M, g = GAMMA) => (1 + ((g - 1) / 2) * M * M) ** (-g / (g - 1));
export const tOf = (M, g = GAMMA) => 1 / (1 + ((g - 1) / 2) * M * M);

export function sectionSvg(k, G, P, { bell, BELL_S, EXIT_R, Z0, rings, injector }) {
  const { gas, wall, T } = profiles(bell, BELL_S);
  const DEG = Math.PI / 180;
  const AZ = P.azimuth ?? 40;
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const point = (az, r, s) => [Math.cos(az * DEG) * r, Math.sin(az * DEG) * r, Z0 - s];
  const slope = (fn, s) => (fn(s + 0.05) - fn(s - 0.05)) / 0.1;
  // la cuña quitada va de AZ − 45° a AZ + 45°; queda de A0 a A1 (270°)
  const A0 = AZ + 45;
  const A1 = AZ + 315;
  const CUTS = [A0, A1];
  const F = G.frameOf([0, 0, Z0], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
  const theta = (az) => -az * DEG;
  const layers = { back: [], interior: [], plane: [], exterior: [], front: [], faces: [], lines: [] };
  const named = (name, svg) => `<g data-name="${name}">${svg}</g>`;
  const toneFill = (tone) => (tone === 4 ? `class="iso-top" style="stroke:var(--anatomy-top);stroke-width:.45;stroke-linejoin:round"` : `class="iso-shade" data-shade="${tone}" style="stroke:var(--anatomy-shade-${tone});stroke-width:.45;stroke-linejoin:round"`);
  // Superficie de revolución sombreada por filas. En cada fila se calculan los ángulos exactos donde
  // la luz cruza los umbrales de tono del kit y donde la cara deja de mirar al espectador, así que las
  // fronteras entre tonos son curvas continuas y no una escalera de facetas.
  const L = G.lightOf(P);
  const BANDS = [0, 0.2, 0.42, 0.62];
  const crossings = (a, b, c) => {
    const R = Math.hypot(a, b);
    if (R < 1e-9 || Math.abs(c) > R) return [];
    const d = Math.atan2(b, a);
    const w = Math.acos(c / R);
    return [d + w, d - w].map((x) => x / DEG);
  };
  const into = (deg) => {
    let x = deg;
    while (x < A0) x += 360;
    while (x > A0 + 360) x -= 360;
    return x;
  };
  function surface(fn, s0, s1, side, ds = 1) {
    const shades = [[], [], [], [], []];
    const rows = Math.max(1, Math.ceil((s1 - s0) / ds));
    for (let i = 0; i < rows; i++) {
      const a = s0 + ((s1 - s0) * i) / rows;
      const b = s0 + ((s1 - s0) * (i + 1)) / rows;
      const g = slope(fn, (a + b) / 2);
      const norm = Math.hypot(1, g);
      const cuts = [A0, A1];
      for (const t of BANDS) cuts.push(...crossings(side * L[0], side * L[1], t * norm - side * L[2] * g));
      cuts.push(...crossings(side * V[0], side * V[1], -side * V[2] * g));
      const list = [...new Set(cuts.map(into).filter((x) => x >= A0 - 1e-9 && x <= A1 + 1e-9).map((x) => +x.toFixed(6)))].sort((x, y) => x - y);
      for (let j = 0; j < list.length - 1; j++) {
        const p = list[j];
        const q = list[j + 1];
        if (q - p < 1e-4) continue;
        const mid = ((p + q) / 2) * DEG;
        const n = G.mul3([Math.cos(mid), Math.sin(mid), g], side);
        if (G.dot3(n, V) <= 0) continue;
        const tone = G.toneOf(n, P);
        const steps = Math.max(1, Math.ceil((q - p) / 3));
        const top = [];
        const low = [];
        for (let k2 = 0; k2 <= steps; k2++) {
          const az = p + ((q - p) * k2) / steps;
          top.push(at(point(az, fn(a), a)));
          low.push(at(point(az, fn(b), b)));
        }
        shades[tone].push(k.pathOf([...top, ...low.reverse()], true));
      }
    }
    return shades.map((list, tone) => (list.length ? `<path ${toneFill(tone)} d="${list.join("")}"/>` : "")).join("");
  }
  // Las caras de fuera solo se ven en los cuartos delanteros y un poco más allá de la silueta:
  // detrás quedan tapadas por la pared interior, que ya está dibujada
  const SEEN = [[A0, AZ + 108], [AZ + 252, A1]];
  const annulus = (s, r0, r1, spans = SEEN) =>
    spans
      .map(([a, b]) => {
        const outer = [];
        const inner = [];
        for (let j = 0; j <= 48; j++) {
          const az = a + ((b - a) * j) / 48;
          outer.push(at(point(az, r1, s)));
          inner.push(at(point(az, r0, s)));
        }
        return `<path class="iso-top" d="${k.pathOf([...outer, ...inner.reverse()], true)}"/>`;
      })
      .join("");
  // Silueta exterior analítica y arcos de borde, limitados al sector que queda
  const profileOf = (fn, s0, s1, n = 40) => Array.from({ length: n + 1 }, (_, i) => s0 + ((s1 - s0) * i) / n).map((s) => [s, fn(s)]);
  const sides = (fn, s0, s1) => G.silhouetteOf(profileOf(fn, s0, s1), F, P, { slope: (s) => slope(fn, s), radius: fn });
  const rim = (s, r, opts = {}) => SEEN.map(([a, b]) => G.arcOf(F, s, r, P, { from: theta(b), to: theta(a), ...opts })).join("");
  // Cara cortada: polígono (r, s) llevado al plano vertical de acimut az
  const faceAt = (az, poly) => k.pathOf(poly.map(([r, s]) => at(point(az, r, s))), true);
  const faces = (name, poly, extra = () => "") => {
    for (const az of CUTS) layers.faces.push(named(name, `<path class="iso-top" d="${faceAt(az, poly)}"/>${extra(az)}<path class="iso-line iso-edge" data-tone="mid" d="${faceAt(az, poly)}"/>`));
  };
  const ring = (fnIn, fnOut, s0, s1, ds) => {
    const out = [];
    for (let s = s0; s <= s1 + 1e-6; s += ds) out.push([fnOut(Math.min(s, s1)), Math.min(s, s1)]);
    for (let s = s1; s >= s0 - 1e-6; s -= ds) out.push([fnIn(Math.max(s, s0)), Math.max(s, s0)]);
    return out;
  };

  // Cuerpos huecos: interior, exterior, siluetas y caras cortadas
  const hollow = [
    ["engine.dome", 18.2, 28, 0.5],
    ["engine.chamber", 32, 94, 1],
    ["engine.throat", 94, BELL_S[0], 0.5],
    ["engine.bell", BELL_S[0], BELL_S[1], 1.5],
  ];
  for (const [name, s0, s1, ds] of hollow) {
    layers.interior.push(named(name, surface(gas, s0, s1, -1, ds)));
    layers.exterior.push(named(name, surface(wall, s0, s1, 1, ds) + k.lineSvg(sides(wall, s0, s1), { tone: "mid" })));
    faces(name, ring(gas, wall, s0, s1, ds));
  }
  // Borde interior de la salida
  layers.lines.push(named("engine.bell", k.lineSvg(rim(BELL_S[1] + 3, gas(BELL_S[1]), { inward: true }), { tone: "lo" })));
  // Placa de cierre de la cúpula (sólida) y placa del inyector, con su cara superior en el sector
  layers.exterior.push(named("engine.post", surface(() => 16, 14, 18.2, 1, 2) + annulus(14, 0.01, 16, [[A0, A1]]) + k.lineSvg(G.arcOf(F, 14, 16, P, { from: theta(A1), to: theta(A0), least: -1 }), { tone: "mid" }) + k.lineSvg(sides(() => 16, 14, 18.2), { tone: "mid" })));
  faces("engine.post", [[0, 14], [16, 14], [16, 18.2], [0, 18.2]]);
  const holes = [];
  for (const r of [5, 10, 15, 20]) {
    const count = Math.round((r * 2 * Math.PI * 0.75) / 2.6);
    for (let j = 1; j < count; j++) holes.push(at(point(A0 + ((A1 - A0) * j) / count, r, 28)));
  }
  layers.interior.push(named("engine.injector", annulus(28, 0.01, gas(28)) + k.dotsSvg(holes, { size: 0.55, tone: "lo" })));
  layers.exterior.push(named("engine.injector", surface(() => injector.r, 28, 32, 1, 2) + annulus(28, wall(28), injector.r) + k.lineSvg(rim(28, injector.r), { tone: "mid" }) + k.lineSvg(sides(() => injector.r, 28, 32), { tone: "mid" })));
  const orifices = [5, 10, 15, 20];
  faces("engine.injector", [[0, 28], [injector.r, 28], [injector.r, 32], [0, 32]], (az) => orifices.map((r) => k.lineSvg(k.pathOf([at(point(az, r, 28)), at(point(az, r, 32))]), { tone: "lo" })).join(""));
  // Labio de salida y anillos rigidizadores, sólidos
  const solidRing = (name, s0, s1, r0, r1) => {
    layers.exterior.push(named(name, surface(() => r1, s0, s1, 1, 1) + annulus(s0, r0, r1) + k.lineSvg(rim(s0, r1), { tone: "mid" }) + k.lineSvg(sides(() => r1, s0, s1), { tone: "mid" })));
    faces(name, [[r0, s0], [r1, s0], [r1, s1], [r0, s1]]);
  };
  solidRing("engine.lip", BELL_S[1], BELL_S[1] + 3, gas(BELL_S[1]), EXIT_R + 2.2);
  for (const [s0, s1, r] of rings.list) solidRing(s0 < 80 ? "engine.chamber" : "engine.bell", s0, s1, wall(s0), r);

  // Colector de combustible: un tubo de 270° fuera de la campana, cortado en las dos caras
  const arc = [];
  for (let j = 0; j <= 120; j++) arc.push(point(A0 + ((A1 - A0) * j) / 120, rings.manifoldR, rings.manifoldS));
  for (const piece of tubePieces(arc, rings.manifoldT, P, { maxLength: 18 })) {
    const front = G.dot3(piece.mid, V) > 0;
    (front ? layers.front : layers.back).push(named("fuel.ring", tubeSvg(piece, { tone: "mid" })));
  }

  // Flujos en el plano del eje que mira al espectador (dentro del fluido)
  const C = [-Math.sin(AZ * DEG), Math.cos(AZ * DEG), 0];
  const inPlane = (x, s) => [C[0] * x, C[1] * x, Z0 - s];
  const flow = (name, pts, tone, free) => layers.plane.push(named(name, k.lineSvg(k.pathOf(pts.map(([x, s]) => at(inPlane(x, s)))), { tone, flow: true, free })));
  for (const x of [-15, -10, -5, 0, 5, 10, 15]) flow("engine.dome", [[x * 0.85, 19.5], [x, 28], [x, 32], [x * 1.04, 41]], "blue", "both");
  for (const f of [-0.7, -0.35, 0, 0.35, 0.7]) {
    const pts = [];
    for (let s = 32.2; s <= BELL_S[1]; s += 2) pts.push([f * gas(s), s]);
    flow("engine.bell", pts, "lit", "end");
  }
  // Queroseno: del colector cruza la pared por la toma y sube por el canal hasta el inyector (en cada cara)
  for (const az of CUTS) {
    const pts = [[rings.manifoldR - rings.manifoldT, rings.manifoldS], [gas(rings.manifoldS) + T / 2, rings.manifoldS]];
    for (let s = rings.manifoldS - 2; s > 32; s -= 2) pts.push([gas(s) + T / 2, s]);
    pts.push([gas(32) + T / 2, 32]);
    layers.lines.push(named("fuel.ring", k.lineSvg(k.pathOf(pts.map(([r, s]) => at(point(az, r, s)))), { tone: "red", flow: true })));
  }
  const svg = [...layers.back, ...layers.interior, ...layers.plane, ...layers.exterior, ...layers.front, ...layers.faces, ...layers.lines].join("");
  return { svg, gas, wall, A0, A1, CUTS };
}
