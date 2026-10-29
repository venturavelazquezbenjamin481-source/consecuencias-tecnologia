// Imágenes solo con el dibujo (sin títulos) para el documento de Word, donde el texto es editable
import { writeFileSync } from "node:fs";
import * as k from "./skill/kit/iso-kit.mjs";
import { POSICIONES } from "./modelo.mjs";
import { figura, CSS_ROBOT } from "./build.mjs";
import { CSS_IMPRESION, pinesSvg } from "./exportar.mjs";
import { circuitoSvg } from "./circuito.mjs";

const pagina = (nombre, svg) => writeFileSync(`out/word-${nombre}.html`, k.pageHtml({ title: nombre, theme: "light", body: `<style>${CSS_ROBOT}${CSS_IMPRESION}</style><section class="exportar">${svg}</section>`, width: 1000 }));
pagina("general", figura(270, { extra: pinesSvg(270) }));
for (const p of POSICIONES) pagina(`posicion-${p.n}`, figura(p.angulo));
pagina("circuito", circuitoSvg());
console.log("listo word");
