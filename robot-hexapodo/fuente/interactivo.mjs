// Genera la versión interactiva: un solo archivo HTML sin dependencias externas.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as k from "./skill/kit/iso-kit.mjs";
import * as G from "./skill/kit/lathe.mjs";
import { kitScript } from "./skill/scripts/inline-kit.mjs";
import { MODELO, pose, POSICIONES } from "./modelo.mjs";
import { crearPiezas } from "./piezas.mjs";
import { P, ANCHO, ALTO } from "./escena.mjs";
import { E, CSS_ROBOT } from "./build.mjs";
import { circuitoSvg, CSS_CIRCUITO, PC, POLEAS_C, ANCHO_C, ALTO_C } from "./circuito.mjs";
import { PIEZAS } from "./exportar.mjs";

const ANGULO_INICIAL = 270;
const piezas = crearPiezas(k, G, P, MODELO, pose, { pasosPunta: 9 });

// Cada lado se arma con subgrupos fijos para que el navegador solo redibuje lo que se mueve
const ladoSvg = (signo) =>
  `<g data-lado="${signo}">${piezas
    .capasDe(signo, ANGULO_INICIAL, { lit: signo > 0 })
    .map((c, i) => `<g data-capa="${i}"${c.fija ? " data-fija" : ""}>${c.svg}</g>`)
    .join("")}</g>`;

const robotSvg = k.figureSvg({
  width: ANCHO,
  height: ALTO,
  className: "figura-robot",
  label: "Robot hexápodo de palitos de paleta. Toca una pieza para ver su nombre y su función.",
  body: [E.fondo, `<g data-sombras>${piezas.sombras(ANGULO_INICIAL)}</g>`, ladoSvg(-1), `<g data-fijo>${E.cuerpo}</g>`, ladoSvg(1)],
}).replace(`viewBox="0 0 ${ANCHO} ${ALTO}"`, 'viewBox="40 38 560 374"'); // recorte al contenido

const circuito = circuitoSvg({ extra: `<g data-marcas-circuito></g>` })
  .replace('class="iso-svg"', 'class="iso-svg figura-circuito"')
  .replace(`viewBox="0 0 ${ANCHO_C} ${ALTO_C}"`, 'viewBox="14 62 612 280"');

// Fichas de información de cada pieza
const INFO = {
  ...Object.fromEntries(PIEZAS.map((p) => [`p${p.n}`, { titulo: `${p.n} · ${p.nombre}`, texto: p.funcion }])),
  motor: { titulo: "Motorreductor de 100 rpm", texto: "Hay uno en cada extremo de la barra central, sujeto con cinta. Su flecha sale del marco y hace girar la polea. Los dos tienen la polaridad invertida para que giren en sentidos opuestos." },
  pila: { titulo: "Pila de 9 V", texto: "Da la energía a los dos motores. El broche tiene un cable rojo (positivo) y uno negro (negativo)." },
  interruptor: { titulo: "Interruptor", texto: "Abre o cierra el cable positivo. Encendido, la corriente llega a los dos motores." },
  cable: { titulo: "Cables", texto: "El rojo (positivo) va de la pila al interruptor y de ahí a los motores; el negro (negativo) va directo. En un motor van al revés que en el otro: polaridad invertida." },
};
INFO.p8.texto = "5 cm de diámetro. Su orificio central entra en la flecha del motor; el orificio excéntrico, a 1 cm del centro, mueve la pata central y las dos bielas.";
INFO.p3.texto = "Va unida al orificio excéntrico de la polea y, arriba, gira y se desliza en la punta del eje en L. Sube y baja con la polea.";
INFO.p9.texto = "Madera de balsa de 20 × 12 cm con una barra central de 9.5 cm. Los segmentos de 20 cm van encima de los de 12 cm, unidos con tornillos.";

const LISTA = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "motor", "pila", "interruptor", "cable"];
const corto = { p1: "1 Pata trasera", p2: "2 Biela trasera", p3: "3 Pata central", p4: "4 Biela delantera", p5: "5 Pata delantera", p6: "6 Base de la L", p7: "7 Brazo de la L", p8: "8 Polea", p9: "9 Marco", motor: "Motores", pila: "Pila 9 V", interruptor: "Interruptor", cable: "Cables" };

// Resaltado de la pieza elegida (se genera para cada clave)
const resalte = LISTA.map((c) => {
  const sel = c === "cable" ? ".cable" : `.${c}`;
  return `.escenario[data-sel="${c}"] ${sel} .iso-edge,.escenario[data-sel="${c}"] ${sel} .tb-edge{stroke:var(--resalte)!important;stroke-width:1.7px}
.escenario[data-sel="${c}"] ${sel} :is(.iso-fill,.iso-top){fill:var(--resalte-claro)!important}
.escenario[data-sel="${c}"] ${sel} .iso-shade{fill:var(--resalte-medio)!important;stroke:var(--resalte-medio)!important}`;
}).join("\n");

const DATOS = {
  P,
  PC,
  MODELO,
  POSICIONES,
  INFO,
  ANGULO_INICIAL,
  POLEAS_C,
  palanca: { robot: [-3.5, 0, 0], circuito: [-8, 0, 0] },
};

const latheFuente = readFileSync("./skill/kit/lathe.mjs", "utf8").replace(/^import .*$/m, "").replace(/^export /gm, "");
const latheScript = `const G = (() => {${latheFuente}\nreturn { frameOf, frameAlong, prismOf, circleOf, disc, sphereOf, arcOf, pointOf };})();\n`;
const envolver = (archivo, nombres) => `const { ${nombres} } = (() => {${readFileSync(archivo, "utf8").replace(/^export /gm, "")}\nreturn { ${nombres} };})();\n`;
const modeloScript = envolver("./modelo.mjs", "MODELO, pose, posicionDelCiclo");
const piezasScript = envolver("./piezas.mjs", "crearPiezas");
const VIVO = readFileSync("./vivo.js", "utf8").replace("__DATOS__", JSON.stringify(DATOS));
const CSS = readFileSync("./estilo.css", "utf8");

const chips = POSICIONES.map((p) => `<button class="chip-posicion" type="button" data-ir="${p.n}"><b>${p.n}</b><span>${p.n === 1 ? "50°–60°" : p.n === 2 ? "120°–130°" : "270°"}</span></button>`).join("");
const botonesPiezas = LISTA.map((c) => `<button type="button" class="boton-pieza" data-pieza="${c}">${corto[c]}</button>`).join("");

const cuerpo = `
<style>${CSS_ROBOT}${CSS_CIRCUITO}${CSS}${resalte}</style>
<header class="encabezado">
  <p class="antetitulo">Proyecto de informática · secundaria</p>
  <h1>Robot hexápodo</h1>
  <p class="intro">Un robot insecto de seis patas hecho con palitos de paleta, balsa, dos motorreductores y una pila de 9 V. Enciéndelo, cambia la velocidad y toca cualquier pieza para saber qué hace.</p>
</header>
<div class="pestanas" role="tablist" aria-label="Vista">
  <button type="button" role="tab" id="tab-robot" aria-selected="true" aria-controls="vista" data-vista="robot">Robot</button>
  <button type="button" role="tab" id="tab-circuito" aria-selected="false" aria-controls="vista" data-vista="circuito">Circuito eléctrico</button>
</div>
<div class="diseno">
  <figure class="iso-figure tarjeta-figura">
    <div class="iso-plate">
      <div class="iso-plate-corners" aria-hidden="true">
        <span class="iso-plate-corner" data-corner="fig" data-figura-nombre>Fig 1</span>
        <span class="iso-plate-corner" data-corner="title" data-figura-titulo>Robot hexápodo</span>
        <span class="iso-plate-corner" data-corner="hint">Toca una pieza</span>
        <span class="iso-plate-corner" data-corner="readout" data-readout>polea 270° · posición 3</span>
      </div>
      <div class="escenario" id="vista" role="tabpanel" aria-labelledby="tab-robot" data-vista="robot">
        <div class="vista vista-robot">${robotSvg}</div>
        <div class="vista vista-circuito" hidden>${circuito}</div>
      </div>
    </div>
  </figure>
  <aside class="panel">
    <section class="tablero" aria-label="Controles">
      <button type="button" class="boton-encendido" aria-pressed="false" data-encender>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M6.3 6.6a8 8 0 1 0 11.4 0"/></svg>
        <span data-encender-texto>Encender</span>
      </button>
      <label class="control-rpm">
        <span class="control-fila"><span>Velocidad del motor</span><output data-rpm-texto>40 rpm</output></span>
        <input type="range" min="0" max="100" step="1" value="40" data-rpm aria-label="Velocidad en rpm, de 0 a 100">
        <span class="control-fila escala" aria-hidden="true"><span>0</span><span>50</span><span>100 rpm</span></span>
      </label>
      <div class="lecturas">
        <div class="lectura"><span>Ángulo de la polea</span><strong data-angulo>270°</strong></div>
        <div class="lectura"><span>Posición del ciclo</span><strong data-posicion>3</strong></div>
      </div>
      <div class="posiciones" role="group" aria-label="Ir a una posición del ciclo">${chips}</div>
      <p class="estado" data-estado aria-live="polite">Motor apagado. Toca una posición para ver el mecanismo ahí.</p>
    </section>
    <section class="ficha" aria-live="polite">
      <p class="ficha-etiqueta">Pieza seleccionada</p>
      <h2 data-ficha-titulo>Toca una pieza</h2>
      <p data-ficha-texto>Toca el dibujo o elige una pieza de la lista para resaltarla y ver su nombre y su función.</p>
    </section>
  </aside>
</div>
<section class="lista-piezas" aria-label="Piezas">${botonesPiezas}</section>
`;

mkdirSync("out", { recursive: true });
const html = k
  .pageHtml({ title: "Robot hexápodo", theme: "light", body: cuerpo, script: kitScript() + latheScript + modeloScript + piezasScript + VIVO, width: 1180 })
  .replace('<html lang="en">', '<html lang="es-MX">');
writeFileSync("out/robot-hexapodo.html", html);
console.log("robot-hexapodo.html", (html.length / 1024).toFixed(0), "KB");
