// Piezas que se mueven: patas, bielas, polea y uniones de clip.
// Se usa igual en Node (para las imágenes) y en el navegador (versión interactiva).
// Recibe el kit (k), el torno (G), la proyección (P) y el modelo ya calculado.

export function crearPiezas(k, G, P, MODELO, pose, { pasosPunta = 20 } = {}) {
  const M = MODELO;
  const R = M.palito;
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const camino = (puntos, cerrado) => k.pathOf(puntos.map(at), cerrado);

  // Partes que no cambian de forma: se calculan una vez y luego solo se trasladan
  const memo = new Map();
  const fijo = (clave, fn) => {
    if (!memo.has(clave)) memo.set(clave, fn());
    return memo.get(clave);
  };
  const mover = ([x, z], svg) => `<g transform="${k.translateAlong(P, [x, 0, z])}">${svg}</g>`;

  // Capas en y (lado cercano; el lejano es el espejo)
  const CAPA = {
    marco: 60,
    polea: [61, 65],
    pata: [65.5, 67.5],
    bielaAtras: [68, 70],
    bielaAdelante: [70.5, 72.5],
  };

  // Marco de referencia de un plano vertical paralelo a x-z
  const plano = (lado) => G.frameOf([0, 0, 0], [0, lado, 0], [1, 0, 0], [0, 0, 1]);

  // Contorno de un palito (estadio) entre dos centros de punta, en (x, z)
  function estadio(p0, p1, r = R, pasos = pasosPunta) {
    const dx = p1[0] - p0[0];
    const dz = p1[1] - p0[1];
    const base = Math.atan2(dz, dx);
    const puntos = [];
    for (let i = 0; i <= pasos; i++) {
      const a = base + Math.PI / 2 + (i / pasos) * Math.PI;
      puntos.push([p0[0] + r * Math.cos(a), p0[1] + r * Math.sin(a)]);
    }
    for (let i = 0; i <= pasos; i++) {
      const a = base - Math.PI / 2 + (i / pasos) * Math.PI;
      puntos.push([p1[0] + r * Math.cos(a), p1[1] + r * Math.sin(a)]);
    }
    return puntos;
  }

  // Punto en el plano del lado (x, z) a la profundidad y
  const en = (lado, [x, z], y) => [x, lado * y, z];

  // Veta de madera: dos líneas a lo largo del palito que terminan en el borde redondo
  function veta(lado, p0, p1, y, desfases = [-2.2, 1.6]) {
    const dx = p1[0] - p0[0];
    const dz = p1[1] - p0[1];
    const l = Math.hypot(dx, dz) || 1;
    const t = [dx / l, dz / l];
    const n = [-t[1], t[0]];
    return desfases
      .map((o) => {
        const h = Math.sqrt(R * R - o * o) - 0.15;
        const a = [p0[0] + n[0] * o - t[0] * h, p0[1] + n[1] * o - t[1] * h];
        const b = [p1[0] + n[0] * o + t[0] * h, p1[1] + n[1] * o + t[1] * h];
        return camino([en(lado, a, y), en(lado, b, y)]);
      })
      .join("");
  }

  // Un orificio en la cara visible de un palito
  const orificio = (lado, [x, z], y, r = 1.3) => G.circleOf(G.frameAlong([x, 0, z], [0, 1, 0]), lado * y, r, P, 20);

  // Palito de paleta entre dos centros de punta
  function palito(lado, p0, p1, [y0, y1], { tono = "hi", lit = false, orificios = [], clase = "" } = {}) {
    const F = plano(lado);
    const caraVisible = lado > 0 ? y1 : y0;
    const cuerpo = G.prismOf(F, estadio(p0, p1), y0, y1, P);
    const detalle = lado > 0 ? Ln(veta(lado, p0, p1, caraVisible), { tone: "faint" }) + orificios.map((o) => Ln(orificio(lado, o, caraVisible), { tone: "lo" })).join("") : "";
    return `<g class="${clase}">${S(cuerpo, { tone: tono, lit, inner: detalle })}</g>`;
  }

  // Espiral de clip plana sobre una cara, con la punta cortada como un punto
  function espiral(lado, punto, y, opciones = {}) {
    if (lado < 0) return "";
    return mover(punto, fijo(`espiral${lado}|${y}|${JSON.stringify(opciones)}`, () => espiralEn(lado, [0, 0], y, opciones)));
  }
  function espiralEn(lado, [x, z], y, { vueltas = 1.6, r0 = 1.3, r1 = 3, giro = 0 } = {}) {
    const pts = [];
    const n = Math.round(vueltas * 28);
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const a = giro + s * vueltas * Math.PI * 2;
      const r = r0 + (r1 - r0) * s;
      pts.push(en(lado, [x + r * Math.cos(a), z + r * Math.sin(a)], y + 0.15));
    }
    const fin = at(pts[pts.length - 1]);
    return `<g class="clip">${Ln(camino(pts), { tone: "hi" })}${D([fin], { size: 0.9, tone: "hi" })}</g>`;
  }

  // Tramo de alambre de clip entre dos capas (visible en el hueco)
  function alambre(lado, punto, y0, y1, r = 0.5) {
    return mover(punto, fijo(`alambre${lado}|${y0}|${y1}`, () => {
      const F = G.frameOf([0, 0, 0], [0, lado, 0], [1, 0, 0], [0, 0, 1]);
      return S(G.disc(y0, y1, r, F, P, { steps: 12 }), { tone: "mid", crease: "none" });
    }));
  }

  // Resorte de clip que separa dos piezas (enrollado en el alambre)
  function resorte(lado, [x, z], y0, y1, r = 1.4, vueltas = 3) {
    const c = k.coil(lado * y0, lado * y1, [x, z], r, vueltas, "y", P);
    return { atras: Ln(c.back, { tone: "lo" }), frente: Ln(c.front, { tone: "mid" }) };
  }

  // Alfiler con cabeza de bolita: pivote de las patas exteriores
  function alfiler(lado, [x, z], y0, y1) {
    const F = G.frameOf([x, 0, z], [0, lado, 0], [1, 0, 0], [0, 0, 1]);
    const cuerpo = S(G.disc(y0, y1 + 0.4, 0.45, F, P, { steps: 12 }), { tone: "mid", crease: "none" });
    const cabeza = S(G.sphereOf([x, lado * (y1 + 1.6), z], 1.9, P, { steps: 28 }), { tone: "hi" });
    return { cuerpo, cabeza };
  }

  // Polea: disco con ranura, cubo, marcas de grados y orificio excéntrico
  function polea(lado, angulo, opciones = {}) {
    return `<g class="pieza p8">${poleaCuerpo(lado, opciones)}${poleaMarcas(lado, angulo)}</g>`;
  }
  function poleaCuerpo(lado, { lit = true } = {}) {
    const [y0, y1] = CAPA.polea;
    const F = G.frameOf([M.polea.x, 0, M.polea.z], [0, lado, 0], [-1, 0, 0], [0, 0, 1]);
    const ranura = () => Ln(G.arcOf(F, y0 + 1.5, M.polea.r, P) + G.arcOf(F, y1 - 1.5, M.polea.r, P), { tone: "faint" });
    return fijo(`polea${lado}${lit}`, () => S(G.disc(y0, y1, M.polea.r, F, P), { tone: "hi", lit, inner: ranura() }));
  }
  function poleaMarcas(lado, angulo) {
    const [y0, y1] = CAPA.polea;
    const c = [M.polea.x, M.polea.z];
    const F = G.frameOf([c[0], 0, c[1]], [0, lado, 0], [-1, 0, 0], [0, 0, 1]);
    const a = (angulo * Math.PI) / 180;
    const sAfuera = y1;
    const partes = [];
    if (lado > 0) {
      const giro = (r, t) => G.pointOf(F, sAfuera, r, t);
      // Anillo de marcas: cada 30° una marca larga, cada 10° una corta (giran con la polea)
      partes.push(Ln(G.circleOf(F, sAfuera, M.polea.r - 2, P), { tone: "lo" }));
      let menores = "";
      let mayores = "";
      for (let i = 0; i < 36; i++) {
        const t = a + (i * Math.PI) / 18;
        const largo = i % 3 === 0 ? 3.2 : 1.6;
        const d = camino([giro(M.polea.r - 2, t), giro(M.polea.r - 2 - largo, t)]);
        if (i % 3 === 0) mayores += d;
        else menores += d;
      }
      partes.push(Ln(menores, { tone: "lo" }), Ln(mayores, { tone: "mid" }));
      // Línea de referencia del centro al excéntrico
      partes.push(Ln(camino([giro(3, a), giro(M.polea.excentrico - 1.8, a)]), { tone: "lit" }));
      // Orificio central donde entra la flecha del motor
      partes.push(Ln(G.circleOf(F, sAfuera, 3, P, 24), { tone: "lo" }));
      // Flecha en "D" que asoma en el centro
      const flecha = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => giro(2.1, a * 0.0 + (i / 12) * Math.PI * 2 + 0.3));
      partes.push(Ln(camino(flecha, true), { tone: "mid" }));
      // Orificio excéntrico
      partes.push(Ln(G.circleOf(G.frameAlong(G.pointOf(F, sAfuera, M.polea.excentrico, a), [0, 1, 0]), 0, 1.8, P, 20), { tone: "lo" }));
    }
    return partes.join("");
  }

  // Todo el mecanismo de un lado para un ángulo de polea. Devuelve SVG en orden de pintado.
  function lado(signo, angulo, opciones = {}) {
    return capasDe(signo, angulo, opciones).map((c) => c.svg).join("");
  }

  // Las capas de un lado en orden de pintado; "fija" indica que no cambia con el ángulo
  function capasDe(signo, angulo, { lit = true } = {}) {
    const p = pose(angulo);
    const capas = [];
    const pata = CAPA.pata;
    const ba = CAPA.bielaAtras;
    const bd = CAPA.bielaAdelante;
    // Alfileres, separadores de clip y alambres que cruzan huecos (detrás de las patas)
    const fijos = fijo(`pivotes${signo}`, () => {
      const pivotes = [p.atras.O, p.adelante.O].map((O) => ({ O, pin: alfiler(signo, O, CAPA.marco, pata[1]), res: resorte(signo, O, CAPA.marco + 0.3, pata[0] - 0.3) }));
      const resE = resorte(signo, p.E, CAPA.marco + 0.3, pata[0] - 0.3, 1.4, 3);
      return {
        atras: pivotes.map(({ pin, res }) => res.atras + pin.cuerpo + res.frente).join("") + resE.atras + alambre(signo, p.E, CAPA.marco, pata[0]) + resE.frente,
        cabezas: pivotes.map(({ pin }) => pin.cabeza).join(""),
      };
    });

    capas.push({ y: 60.2, svg: fijos.atras, fija: true });
    capas.push({ y: 63, svg: `<g class="pieza p8">${poleaCuerpo(signo, { lit })}</g>`, fija: true });
    capas.push({ y: 63.1, svg: `<g class="pieza p8">${poleaMarcas(signo, angulo)}</g>` });
    // Alambre del excéntrico (sale de la polea y atraviesa patas y bielas)
    capas.push({ y: 65.2, svg: alambre(signo, p.C, CAPA.polea[1], pata[0]) });

    // Patas 1, 3 y 5
    const pataSvg = (l, n) => palito(signo, l.pie, l.T, pata, { orificios: [l.O, l.T], clase: `pieza p${n}` });
    let patas = pataSvg(p.atras, 1) + pataSvg(p.adelante, 5);
    patas += palito(signo, p.central.pie, p.central.punta, pata, { orificios: [p.C, p.E], clase: "pieza p3" });
    capas.push({ y: 66.5, svg: patas });
    // Cabezas de alfiler y espiral en la punta de la pata central
    capas.push({ y: 67.6, svg: fijos.cabezas + espiral(signo, p.E, pata[1], { giro: 0.6 }), fija: true });
    // Alambres entre pata y biela
    capas.push({ y: 67.7, svg: alambre(signo, p.atras.T, pata[1], ba[0]) + alambre(signo, p.adelante.T, pata[1], bd[0]) + alambre(signo, p.C, pata[1], bd[1]) });
    // Bielas 2 y 4
    capas.push({ y: 69, svg: palito(signo, p.atras.T, p.C, ba, { tono: "hi", orificios: [p.atras.T, p.C], clase: "pieza p2" }) + espiral(signo, p.atras.T, ba[1], { giro: 2.2 }) });
    capas.push({ y: 71.5, svg: palito(signo, p.C, p.adelante.T, bd, { tono: "hi", orificios: [p.C, p.adelante.T], clase: "pieza p4" }) + espiral(signo, p.adelante.T, bd[1], { giro: 4.1 }) + espiral(signo, p.C, bd[1], { giro: 1.1, r1: 3.4, vueltas: 1.9 }) });

    if (signo < 0) capas.reverse();
    return capas;
  }

  // Sombras suaves de los pies sobre el tapete
  function sombras(angulo) {
    const p = pose(angulo);
    const pies = [p.atras.pie, p.central.pie, p.adelante.pie];
    let out = "";
    for (const signo of [-1, 1]) {
      for (const pie of pies) {
        const alto = pie[1] - R - M.suelo;
        const fuerza = Math.max(0, 1 - alto / 30);
        if (fuerza <= 0.02) continue;
        const plan = { x: pie[0] - 6, y: signo * 66.5 - 3, w: 12, d: 6, r: 3 };
        out += `<path class="iso-halo" style="opacity:${(0.32 * fuerza).toFixed(2)}" d="${k.haloOf(plan, M.suelo, 0.1, P)}"/>`;
      }
    }
    return out;
  }

  return { lado, capasDe, sombras, polea, palito, CAPA, estadio };
}
