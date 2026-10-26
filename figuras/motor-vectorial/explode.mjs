// Despiece: cada conjunto sale en su orden, empujado por un muelle críticamente amortiguado.
// La misma función mueve la página y alimenta la auditoría, así que lo que se prueba es lo que se ve.
export const EXPLODE = {
  order: ["nozzle", "tp", "exh", "gg"],
  travel: { nozzle: 70, tp: 70, exh: 26, gg: 70 },
  omega: 7.5,
  stagger: 0.14,
};

// Respuesta al escalón de un muelle crítico, de 0 a 1
export function springStep(time, omega) {
  if (!(time > 0)) return 0;
  return 1 - (1 + omega * time) * Math.exp(-omega * time);
}

// Fracción de cada conjunto `time` segundos después de abrir (open) o de cerrar desde abierto
export function explodeAt(time, open, E = EXPLODE) {
  const out = {};
  const n = E.order.length;
  E.order.forEach((id, index) => {
    const delay = (open ? index : n - 1 - index) * E.stagger;
    const s = springStep(time - delay, E.omega);
    out[id] = open ? s : 1 - s;
  });
  return out;
}

// Valores de grupo (cm de recorrido) a partir de las fracciones
export function slidesOf(shares, E = EXPLODE) {
  const out = {};
  for (const id of E.order) out[id] = (shares[id] ?? 0) * E.travel[id];
  return out;
}
