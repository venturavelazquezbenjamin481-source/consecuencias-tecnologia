// Actuadores electromecánicos dibujados por fotograma con el kit 2D.
// Se usa igual en Node (pose de reposo) y en la página (cada fotograma).
// U: pivote superior (fijo), L: rótula en el motor (se mueve con el cardán).
export const ACT = { ball: 4.4, cup: 4.2, head: [6, 11], barrel: [11, 62], barrelR: 6.6, gland: [62, 67], rodR: 2.6, motor: [12.4, 42], motorR: 4.4, motorAt: 11.2 };

// Fuelle de una línea de alimentación: entre la brida fija (top) y la brida
// del motor (bottom, con su eje `axis`); cada onda se reparte a lo largo de la curva.
export function bellowsSvg(G, k, P, top, bottom, axis, id, { r = 7.6, core = 5.6, count = 9, pitch = 1.1 } = {}) {
  const V = G.viewOf(P);
  const items = [];
  const a0 = [0, 0, -1];
  const a1 = G.mul3(axis, -1);
  const length = G.len3(G.sub3(bottom, top));
  // curva de Hermite entre las dos bridas, tangente a cada una
  const at = (t) => {
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1;
    const h10 = t ** 3 - 2 * t ** 2 + t;
    const h01 = -2 * t ** 3 + 3 * t ** 2;
    const h11 = t ** 3 - t ** 2;
    return [0, 1, 2].map((c) => h00 * top[c] + h10 * length * a0[c] + h01 * bottom[c] + h11 * length * a1[c]);
  };
  const tangent = (t) => G.unit3(G.sub3(at(Math.min(1, t + 0.01)), at(Math.max(0, t - 0.01))));
  // el núcleo va en tramos cuyas uniones quedan bajo cada onda
  for (let i = 0; i < count; i++) {
    const p0 = at(i / count);
    const p1 = at((i + 1) / count);
    const F = G.frameAlong(p0, G.unit3(G.sub3(p1, p0)));
    items.push({ key: G.dot3(G.lerp3(p0, p1, 0.5), V), svg: k.solidSvg(G.disc(0, G.len3(G.sub3(p1, p0)), core, F, P), { tone: "mid", crease: "none" }) });
  }
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const F = G.frameAlong(at(t), tangent(t));
    items.push({ key: G.dot3(at(t), V) + 0.01, svg: k.solidSvg(G.disc(-pitch / 2, pitch / 2, r, F, P), { tone: "hi" }) });
  }
  items.sort((a, b) => a.key - b.key);
  return `<g data-bellows="${id}">${items.map((item) => item.svg).join("")}</g>`;
}

export function actuatorSvg(G, k, P, U, L, side, id) {
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const axis = G.unit3(G.sub3(L, U));
  const length = G.len3(G.sub3(L, U));
  side = G.unit3(G.sub3(side, G.mul3(axis, G.dot3(side, axis))));
  const F = G.frameOf(U, axis, side, G.cross3(axis, side));
  const V = G.viewOf(P);
  const items = [];
  const put = (centre, svg) => items.push({ key: G.dot3(centre, V), svg });
  const along = (s) => G.add3(U, G.mul3(axis, s));
  const seat = Math.sqrt(ACT.ball ** 2 - ACT.cup ** 2);
  // copa superior sobre la bola fija
  put(along(4), S(G.disc(seat, 6, ACT.cup, F, P), { tone: "mid" }));
  // cabeza, cilindro y prensaestopas
  const head = [[ACT.head[0], 0], [ACT.head[0], 6.2], [ACT.head[0] + 1.6, 7], [ACT.head[1], 7], [ACT.head[1], 0]];
  put(along(8.5), S(G.lathe(head, F, P, { steps: 40 }), { tone: "hi" }) + k.dotsSvg(G.dotsOf(F, ACT.head[0] + 1.6, 6, 8, P, { fade: [0.04, 0.42] }), { size: 0.4, tone: "mid" }));
  const seams = [24, 40, 54].map((s) => G.arcOf(F, s, ACT.barrelR, P)).join("");
  put(along(36), S(G.disc(ACT.barrel[0], ACT.barrel[1], ACT.barrelR, F, P), { tone: "hi", inner: Ln(seams, { tone: "faint" }) }));
  const gland = [[ACT.gland[0], ACT.barrelR], [ACT.gland[0] + 1.6, 5.6, 1], [ACT.gland[0] + 2.4, 5.2], [ACT.gland[1], 5.2]];
  put(along(64.5), S(G.solidOf(gland, F, P, { steps: 36 }), { tone: "hi", inner: Ln(G.circleOf(F, ACT.gland[1], ACT.rodR + 0.5, P, 24), { tone: "faint" }) }));
  // vástago (la parte que se ve cambia con la carrera) y copa inferior sobre la rótula del motor
  const rodEnd = length - 6;
  put(along((ACT.gland[1] + rodEnd) / 2), S(G.disc(ACT.gland[1], rodEnd, ACT.rodR, F, P), { tone: "hi", lit: true }));
  put(along(length - 3.5), S(G.disc(rodEnd, length - seat, ACT.cup, F, P), { tone: "mid", inner: Ln(G.arcOf(F, rodEnd + 1.2, ACT.cup, P), { tone: "faint" }) }));
  // motor paralelo y placa de la caja de engranes
  const MF = G.frameOf(G.add3(U, G.mul3(side, ACT.motorAt)), axis, side, F.v);
  put(G.pointOf(MF, 27, 0, 0), S(G.disc(ACT.motor[0], ACT.motor[1], ACT.motorR, MF, P), { tone: "mid" }) + k.fadedSvg(G.ribsOf(MF, ACT.motor[0] + 2, ACT.motor[1] - 2, ACT.motorR, 16, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }));
  put(G.pointOf(MF, ACT.motor[1] + 0.8, 0, 0), S(G.disc(ACT.motor[1], ACT.motor[1] + 1.6, ACT.motorR - 0.6, MF, P), { tone: "mid" }));
  const SF = G.frameOf(U, axis, side, F.v);
  put(G.pointOf(SF, 10.5, ACT.motorAt / 2, 0), S(G.prismOf(SF, G.stadium(7.6, 5.2, ACT.motorAt), 9.4, 12.4, P), { tone: "mid" }) + k.dotsSvg([G.pointOf(SF, 9.4, 0, 0), G.pointOf(SF, 9.4, ACT.motorAt, 0)].map((p) => k.iso(p, P)), { size: 0.42 }));
  items.sort((a, b) => a.key - b.key);
  return `<g data-act="${id}">${items.map((item) => item.svg).join("")}</g>`;
}
