// Páginas para exportar a PNG (fondo blanco, sin controles) para el documento de Word.
import { writeFileSync, mkdirSync } from "node:fs";
import * as k from "./skill/kit/iso-kit.mjs";
import { P } from "./escena.mjs";
import { pose, POSICIONES } from "./modelo.mjs";
import { figura, CSS_ROBOT } from "./build.mjs";
import { circuitoSvg } from "./circuito.mjs";

mkdirSync("out", { recursive: true });

// Tonos un poco más marcados para impresión y papel blanco
export const CSS_IMPRESION = `
body.iso[data-theme="light"],.iso[data-theme="light"]{
  --anatomy-page:#ffffff;--anatomy-card:#ffffff;--anatomy-paper:#ffffff;--anatomy-face:#ffffff;--anatomy-top:#ffffff;
  --anatomy-shade-0:#d3d3d0;--anatomy-shade-1:#dededb;--anatomy-shade-2:#e9e9e6;--anatomy-shade-3:#f2f2f0;
  --anatomy-lit-shade:#ececea;
  --anatomy-hi:#1d1d20;--anatomy-mid:#77777c;--anatomy-lo:#a6a6ab;--anatomy-faint:#cdcdd0;
  --anatomy-text:#3a3a3e;--anatomy-muted:#6a6a70;--anatomy-halo-opacity:.26;
}
body{background:#fff}
.iso-page{margin:0 auto !important;padding:28px 0}
.exportar{background:#fff;padding:26px 30px 30px;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d1d20}
.exportar header{display:flex;justify-content:space-between;align-items:baseline;gap:24px;margin-bottom:4px}
.exportar h1{font-size:22px;line-height:1.2;margin:0;font-weight:650;letter-spacing:-.01em}
.exportar .dato{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:13px;color:#55555a;white-space:nowrap}
.exportar .bajada{margin:6px 0 0;font-size:15px;line-height:1.5;color:#3a3a3e;max-width:62em}
.exportar .iso-svg{margin-top:6px}
.leyenda{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 22px;margin:8px 0 0;padding:14px 0 0;border-top:1px solid #d9d9dc;list-style:none;font-size:14.5px;line-height:1.35}
.leyenda li{display:flex;gap:9px;align-items:flex-start}
.leyenda b{display:block;font-weight:600}
.leyenda span{color:#55555a;font-size:13px}
.ficha{flex:none;width:21px;height:21px;border-radius:50%;background:#151517;color:#fff;display:grid;place-items:center;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;margin-top:1px}
.pin circle.fondo{fill:#151517;stroke:#fff;stroke-width:1.6px;vector-effect:non-scaling-stroke}
.pin text{fill:#fff;font:600 8.4px ui-sans-serif,system-ui,sans-serif;text-anchor:middle;dominant-baseline:central}
`;

export const PIEZAS = [
  { n: 1, nombre: "Pata trasera", funcion: "Gira sobre un alfiler clavado en el segmento de 12 cm del marco.", ancla: (p) => [p.atras.O[0], 67.5, -30] },
  { n: 2, nombre: "Biela trasera", funcion: "Une la parte de arriba de la pata 1 con el orificio excéntrico.", ancla: (p) => [(p.atras.T[0] + p.C[0]) / 2, 70, (p.atras.T[1] + p.C[1]) / 2] },
  { n: 3, nombre: "Pata central", funcion: "Va unida al orificio excéntrico de la polea.", ancla: (p) => [p.central.pie[0] * 0.3, 67.5, -36] },
  { n: 4, nombre: "Biela delantera", funcion: "Une la parte de arriba de la pata 5 con el orificio excéntrico.", ancla: (p) => [(p.adelante.T[0] + p.C[0]) / 2, 72.5, (p.adelante.T[1] + p.C[1]) / 2] },
  { n: 5, nombre: "Pata delantera", funcion: "Gira sobre un alfiler clavado en el segmento de 12 cm del marco.", ancla: (p) => [p.adelante.O[0], 67.5, -30] },
  { n: 6, nombre: "Base del eje en L", funcion: "Fija al marco con 3 alfileres en triángulo: la única unión fija.", ancla: () => [41, -55, 10] },
  { n: 7, nombre: "Brazo del eje en L", funcion: "En su punta gira la parte de arriba de la pata central.", ancla: () => [0, -58, 38] },
  { n: 8, nombre: "Polea", funcion: "5 cm de diámetro; orificio central y excéntrico a 1 cm.", ancla: () => [-17, 65, 31] },
  { n: 9, nombre: "Marco de balsa", funcion: "20 × 12 cm con barra central de 9.5 cm, unido con tornillos.", ancla: () => [100, 22, -4] },
];

const pinesSvg = (angulo) => {
  const p = pose(angulo);
  return `<g class="pines">${PIEZAS.map(({ n, ancla }) => {
    const [x, y] = k.iso(ancla(p), P);
    return `<g class="pin"><circle class="fondo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.6"/><text x="${x.toFixed(1)}" y="${(y + 0.3).toFixed(1)}">${n}</text></g>`;
  }).join("")}</g>`;
};

function pagina(nombre, contenido) {
  const body = `<style>${CSS_ROBOT}${CSS_IMPRESION}</style><section class="exportar">${contenido}</section>`;
  writeFileSync(`out/${nombre}.html`, k.pageHtml({ title: nombre, theme: "light", body, width: 1000 }));
}

// Vista general con piezas 1 a 9
pagina(
  "robot-general",
  `<header><h1>Robot hexápodo: vista general</h1><span class="dato">polea en 270° · posición inicial</span></header>` +
    figura(270, { extra: pinesSvg(270) }) +
    `<ol class="leyenda">${PIEZAS.map((p) => `<li><i class="ficha">${p.n}</i><div><b>${p.nombre}</b><span>${p.funcion}</span></div></li>`).join("")}</ol>`,
);

// Posiciones del ciclo
for (const pos of POSICIONES) {
  const rango = pos.n === 1 ? "Polea entre 50° y 60°" : pos.n === 2 ? "Polea entre 120° y 130°" : "Polea en 270°";
  pagina(
    `robot-posicion-${pos.n}`,
    `<header><h1>Posición ${pos.n}: ${rango.toLowerCase()}</h1><span class="dato">dibujo con la polea en ${pos.angulo}°</span></header><p class="bajada">${pos.texto}</p>` + figura(pos.angulo),
  );
}

// Circuito eléctrico
pagina(
  "circuito",
  `<header><h1>Circuito eléctrico</h1><span class="dato">pila de 9 V · interruptor · 2 motorreductores</span></header><p class="bajada">El cable rojo (positivo) pasa por el interruptor y el negro (negativo) va directo. En el motor B los cables están al revés que en el motor A: por eso giran en sentidos opuestos y, como están montados en espejo, los dos lados empujan al robot hacia el mismo lado.</p>` +
    circuitoSvg(),
);
console.log("listo");
