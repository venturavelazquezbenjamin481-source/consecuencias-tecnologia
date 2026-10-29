// Modelo puro del mecanismo del robot hexápodo (unidades: milímetros).
// Plano del mecanismo: x a lo largo del robot (+x = adelante, a la derecha
// vista desde el lado cercano), z hacia arriba. El lado lejano es un espejo en y.

export const MODELO = {
  // Marco de balsa (pieza 9)
  largo: 200, ancho: 120, barra: 95, tira: 12.5, grosor: 8,
  // Polea (pieza 8): centro en la flecha del motor, orificio excéntrico a 10 mm
  polea: { x: 0, z: 19, r: 25, excentrico: 10 },
  // Pivotes de las patas exteriores (alfileres en los segmentos de 12 cm)
  pivote: { x: 93.75, z: -4 },
  // Pata exterior: orificio superior 26 mm arriba del pivote, punta 46 mm abajo
  pataArriba: 26, pataAbajo: 46,
  // Pata central: punta a 59 mm bajo el orificio excéntrico
  centralAbajo: 59, centralLargo: 104,
  // Punta del eje de rotación en L (piezas 6 y 7), donde gira la pata central
  eje: { x: 0, z: 49 },
  // Medio ancho de un palito de paleta y del suelo
  palito: 5, suelo: -55,
  rpmMax: 100,
};

const M = MODELO;
const grados = Math.PI / 180;

// Posición del orificio excéntrico: 0° a la izquierda, 90° arriba, 180° a la derecha
export function excentrico(angulo) {
  const a = angulo * grados;
  return [M.polea.x - M.polea.excentrico * Math.cos(a), M.polea.z + M.polea.excentrico * Math.sin(a)];
}

const resta = (a, b) => [a[0] - b[0], a[1] - b[1]];
const suma = (a, b) => [a[0] + b[0], a[1] + b[1]];
const por = (a, s) => [a[0] * s, a[1] * s];
const largo = (a) => Math.hypot(a[0], a[1]);
const unitario = (a) => por(a, 1 / (largo(a) || 1));

// Largo de las bielas: se fija con el robot en la posición inicial (polea en 270°)
const C0 = excentrico(270);
export const LARGO_BIELA = largo(resta([M.pivote.x, M.pivote.z + M.pataArriba], C0));

// Punto superior de una pata exterior (lado -1 atrás, +1 adelante) dado el excéntrico
function puntaSuperior(lado, C) {
  const O = [lado * M.pivote.x, M.pivote.z];
  const r0 = M.pataArriba;
  const r1 = LARGO_BIELA;
  const d = largo(resta(C, O));
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const e = unitario(resta(C, O));
  const base = suma(O, por(e, a));
  const n = [-e[1], e[0]];
  const p1 = suma(base, por(n, h));
  const p2 = suma(base, por(n, -h));
  return p1[1] > p2[1] ? p1 : p2;
}

// Pose completa del mecanismo para un ángulo de polea (grados)
export function pose(angulo) {
  const C = excentrico(angulo);
  const E = [M.eje.x, M.eje.z];
  const patas = [-1, 1].map((lado) => {
    const O = [lado * M.pivote.x, M.pivote.z];
    const T = puntaSuperior(lado, C);
    const d = unitario(resta(T, O));
    return { lado, O, T, pie: suma(O, por(d, -M.pataAbajo)), inclinacion: Math.atan2(d[0], d[1]) / grados };
  });
  const u = unitario(resta(E, C));
  const pieCentral = suma(C, por(u, -M.centralAbajo));
  const central = { C, E, pie: pieCentral, punta: suma(pieCentral, por(u, M.centralLargo)), inclinacion: Math.atan2(u[0], u[1]) / grados };
  return { angulo, C, E, atras: patas[0], adelante: patas[1], central };
}

// Posición del ciclo: 1 de 0° a 90° (paso), 2 de 90° a 180° (siguiente paso), 3 de 180° a 360° (regreso a la posición inicial)
export function posicionDelCiclo(angulo) {
  const a = ((angulo % 360) + 360) % 360;
  if (a < 90) return 1;
  if (a < 180) return 2;
  return 3;
}

export const POSICIONES = [
  { n: 1, angulo: 55, texto: "La pata central sube y va a la izquierda; las bielas van a la izquierda y las patas exteriores a la derecha. El robot da un paso." },
  { n: 2, angulo: 125, texto: "Todo hace el movimiento contrario: la pata central va a la derecha, las bielas a la derecha y las patas exteriores a la izquierda. Siguiente paso." },
  { n: 3, angulo: 270, texto: "La polea llega a 270°: las seis patas vuelven a la posición inicial y el ciclo se repite." },
];
