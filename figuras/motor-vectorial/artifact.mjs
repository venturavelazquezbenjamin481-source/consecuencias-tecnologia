// Convierte la página del build en el contenido de una página privada de claude.ai:
// sin <html>/<head>/<body> propios, con el tema tomado del visor o del sistema antes de arrancar.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(HERE, "motor-vectorial.html"), "utf8");
const css = page.match(/<style>([\s\S]*?)<\/style><\/head>/)[1].replace(/html\{color-scheme:dark\}|body\[data-theme="light"\]\{color-scheme:light\}/g, "").replace(/body\{margin:0;background:var\(--anatomy-page\);color:var\(--anatomy-text\);/, ".tv-root{");
const main = page.match(/<main class="iso-page">([\s\S]*?)<\/main>/)[1];
const script = page.match(/<script type="module">([\s\S]*)<\/script><\/body>/)[1];
const out = `<title>Motor con empuje vectorial</title>
<style>
:root{--pg:#f2f2ef;--tx:#57575a;color-scheme:light}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--pg:#0b0b0b;--tx:#a3a3a3;color-scheme:dark}}
:root[data-theme="dark"]{--pg:#0b0b0b;--tx:#a3a3a3;color-scheme:dark}
body{background:var(--pg);color:var(--tx)}
${css}
.tv-root .iso-page{margin:32px auto 64px}
</style>
<div class="iso tv-root" id="tv-root" data-theme="dark"><main class="iso-page">${main}</main></div>
<script>(() => {
  const set = document.documentElement.dataset.theme;
  const dark = set ? set === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.getElementById("tv-root").dataset.theme = dark ? "dark" : "light";
})();</script>
<script type="module">${script}</script>
`;
writeFileSync(join(HERE, "motor-vectorial-artefacto.html"), out);
console.log("wrote motor-vectorial-artefacto.html", (out.length / 1024).toFixed(0), "KB");
