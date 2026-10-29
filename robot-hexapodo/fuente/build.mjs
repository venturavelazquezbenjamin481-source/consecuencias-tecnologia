// Genera las páginas del robot hexápodo: la figura base y las de exportación.
import { writeFileSync, mkdirSync } from "node:fs";
import * as k from "./skill/kit/iso-kit.mjs";
import * as G from "./skill/kit/lathe.mjs";
import * as A from "./skill/kit/audit.mjs";
import { MODELO, pose, POSICIONES } from "./modelo.mjs";
import { crearPiezas } from "./piezas.mjs";
import { escena, P, ANCHO, ALTO } from "./escena.mjs";

export const E = escena();
const piezas = crearPiezas(k, G, P, MODELO, pose);

export function figura(angulo, { extra = "" } = {}) {
  return k.figureSvg({
    width: ANCHO,
    height: ALTO,
    label: `Robot hexápodo de palitos de paleta sobre un tapete de corte. Polea en ${angulo}°.`,
    body: [
      E.fondo,
      `<g data-dyn="sombras">${piezas.sombras(angulo)}</g>`,
      `<g data-dyn="lejano">${piezas.lado(-1, angulo, { lit: false })}</g>`,
      `<g data-fijo>${E.cuerpo}</g>`,
      `<g data-dyn="cercano">${piezas.lado(1, angulo)}</g>`,
      extra,
    ],
  });
}

export const CSS_ROBOT = `
.cable-rojo .tb-body{fill:#d9473f}.cable-rojo .tb-shine{fill:#ef7a70}.cable-rojo .tb-shade{fill:#a8322c}
.cable-negro .tb-body{fill:#3a3a3e}.cable-negro .tb-shine{fill:#5c5c62}.cable-negro .tb-shade{fill:#232326}
.cable-negro .tb-edge{stroke:#18181a}
.flujo{fill:none;stroke:none}
`;

if (process.argv[1].endsWith("build.mjs")) {
  mkdirSync("out", { recursive: true });
  const body = `<style>${CSS_ROBOT}</style>` + k.plateHtml({ fig: "Fig 1", title: "Robot hexápodo", hint: "", readout: "polea 270°", body: `<div class="iso-stage">${figura(Number(process.argv[2] ?? 270))}</div>` });
  writeFileSync("out/prueba.html", k.pageHtml({ title: "Robot hexápodo", theme: "light", body, width: 900 }));
  console.log("items", E.R.items.length);
  // Revisados a 6×: los cables se ven claramente delante del larguero; el interruptor está sobre él
  A.auditOrExit(E.R, P, { crowd: [["cable.pila-motor2", "marco.larguero0"], ["cable.interruptor-motor2", "marco.larguero0"], ["cable.interruptor-motor1", "marco.larguero1"]] });
}
