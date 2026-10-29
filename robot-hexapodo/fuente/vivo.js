
// ---------- Robot hexápodo: parte interactiva ----------
const DATOS = __DATOS__;
const k = { iso, solidSvg, lineSvg, dotsSvg, pathOf, coil, haloOf, translateAlong };
const piezas = crearPiezas(k, G, DATOS.P, MODELO, pose, { pasosPunta: 9 });

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const escenario = $(".escenario");
const svgRobot = $(".figura-robot");
const sombras = svgRobot.querySelector("[data-sombras]");
const capas = Object.fromEntries([-1, 1].map((s) => [s, [...svgRobot.querySelectorAll(`[data-lado="${s}"] > [data-capa]`)]]));
const palancaRobot = svgRobot.querySelector(".palanca");
const palancaCircuito = $(".figura-circuito .palanca");
const marcasCircuito = $("[data-marcas-circuito]");
const lecturaAngulo = $("[data-angulo]");
const lecturaPosicion = $("[data-posicion]");
const lecturaEsquina = $("[data-readout]");
const botonEncender = $("[data-encender]");
const textoEncender = $("[data-encender-texto]");
const deslizador = $("[data-rpm]");
const textoRpm = $("[data-rpm-texto]");
const estado = $("[data-estado]");
const quieto = matchMedia("(prefers-reduced-motion: reduce)");

// Estado del motor
let angulo = DATOS.ANGULO_INICIAL; // grados, crece con el giro
let rpm = Number(deslizador.value); // velocidad elegida
let rpmReal = 0; // velocidad que lleva el motor (arranca y frena suave)
let encendido = false;
let destino = null; // { desde, hasta, t } cuando se va a una posición con el motor apagado
let cuadro = 0;
let ultimo = 0;
let dibujado = null;
let fase = 0; // avance de las marcas de corriente

const norm = (a) => ((a % 360) + 360) % 360;
const SUAVE = (t) => t * t * (3 - 2 * t);

// Redibuja solo las capas que cambian con el ángulo
function dibujarRobot(a) {
  const redondo = Math.round(a * 4) / 4;
  if (redondo === dibujado) return;
  dibujado = redondo;
  for (const s of [-1, 1]) {
    piezas.capasDe(s, redondo, { lit: s > 0 }).forEach((c, i) => {
      if (!c.fija) capas[s][i].innerHTML = c.svg;
    });
  }
  sombras.innerHTML = piezas.sombras(redondo);
}

// Marca que gira en la cara de cada polea del circuito (A al revés que B)
function dibujarCircuito(a) {
  const P = DATOS.PC;
  const rad = (a * Math.PI) / 180;
  marcasCircuito.innerHTML = DATOS.POLEAS_C.map(({ c, giro }) => {
    const t = Math.PI / 2 + giro * rad;
    const punto = (r) => iso([c[0] + r * Math.cos(t), c[1] + 0.05, c[2] + r * Math.sin(t)], P);
    return lineSvg(pathOf([punto(3), punto(23)]), { tone: "lit" });
  }).join("");
}

function leer(a) {
  const n = posicionDelCiclo(a);
  const grados = Math.round(norm(a)) % 360;
  lecturaAngulo.textContent = `${grados}°`;
  lecturaPosicion.textContent = String(n);
  lecturaEsquina.textContent = `polea ${grados}° · posición ${n}`;
  $$(".chip-posicion").forEach((b) => b.toggleAttribute("data-activa", Number(b.dataset.ir) === n));
}

function dibujar() {
  if (escenario.dataset.vista === "robot") dibujarRobot(angulo);
  else dibujarCircuito(angulo);
  escenario.style.setProperty("--flujo", `${fase.toFixed(2)}px`);
  leer(angulo);
}

function paso(ahora) {
  const dt = ultimo ? Math.min((ahora - ultimo) / 1000, 1 / 20) : 1 / 60;
  ultimo = ahora;
  // El motor sigue a la velocidad elegida con un pequeño retraso (inercia)
  const meta = encendido ? rpm : 0;
  rpmReal = quieto.matches ? meta : rpmReal + (meta - rpmReal) * (1 - Math.exp(-dt / 0.35));
  if (Math.abs(meta - rpmReal) < 0.05) rpmReal = meta;
  if (destino) {
    destino.t = Math.min(1, destino.t + dt / destino.dura);
    angulo = destino.desde + (destino.hasta - destino.desde) * SUAVE(destino.t);
    if (destino.t >= 1) destino = null;
  } else {
    angulo += rpmReal * 6 * dt; // 1 rpm = 6° por segundo
  }
  if (encendido) fase += dt * 14;
  dibujar();
  const sigue = encendido || rpmReal > 0 || destino;
  cuadro = sigue && !document.hidden ? requestAnimationFrame(paso) : 0;
  if (!sigue) ultimo = 0;
}
const arrancar = () => {
  if (!cuadro) {
    ultimo = 0;
    cuadro = requestAnimationFrame(paso);
  }
};

function mensaje() {
  if (encendido && rpm === 0) estado.textContent = "Encendido, pero a 0 rpm la polea no gira.";
  else if (encendido) estado.textContent = `Encendido a ${rpm} rpm: la polea da una vuelta cada ${(60 / rpm).toFixed(1)} s.`;
  else estado.textContent = "Motor apagado. Toca una posición para ver el mecanismo ahí.";
}

function encender(valor) {
  encendido = valor;
  destino = null;
  botonEncender.setAttribute("aria-pressed", String(valor));
  textoEncender.textContent = valor ? "Apagar" : "Encender";
  escenario.toggleAttribute("data-encendido", valor);
  const mover = (el, d) => el && el.setAttribute("transform", valor ? "" : translateAlong(el.closest(".figura-robot") ? DATOS.P : DATOS.PC, d));
  mover(palancaRobot, DATOS.palanca.robot);
  mover(palancaCircuito, DATOS.palanca.circuito);
  mensaje();
  arrancar();
}

botonEncender.addEventListener("click", () => encender(!encendido));
deslizador.addEventListener("input", () => {
  rpm = Number(deslizador.value);
  textoRpm.textContent = `${rpm} rpm`;
  mensaje();
  arrancar();
});

// Ir a una posición del ciclo: la polea avanza (siempre hacia adelante) hasta el ángulo
$$(".chip-posicion").forEach((b) =>
  b.addEventListener("click", () => {
    const pos = DATOS.POSICIONES.find((p) => p.n === Number(b.dataset.ir));
    if (encendido) encender(false);
    rpmReal = 0;
    let avance = norm(pos.angulo - angulo);
    if (avance < 1) avance += 360;
    destino = { desde: angulo, hasta: angulo + avance, t: 0, dura: quieto.matches ? 0.001 : 0.5 + avance / 360 };
    estado.textContent = `Posición ${pos.n}: ${pos.texto}`;
    arrancar();
  }),
);

// Pestañas: robot o circuito
$$("[data-vista]").forEach((tab) => {
  if (tab === escenario) return;
  tab.addEventListener("click", () => {
    const vista = tab.dataset.vista;
    escenario.dataset.vista = vista;
    escenario.setAttribute("aria-labelledby", tab.id);
    $$("[role=tab]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    $(".vista-robot").hidden = vista !== "robot";
    $(".vista-circuito").hidden = vista !== "circuito";
    $("[data-figura-nombre]").textContent = vista === "robot" ? "Fig 1" : "Fig 2";
    $("[data-figura-titulo]").textContent = vista === "robot" ? "Robot hexápodo" : "Circuito eléctrico";
    dibujado = null;
    dibujar();
  });
});

// Selección de piezas: tocar el dibujo o la lista
const CLAVES = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "motor", "pila", "interruptor"];
function claveDe(el) {
  const grupo = el.closest(".pieza, .cable");
  if (!grupo) return null;
  if (grupo.classList.contains("cable")) return "cable";
  return CLAVES.find((c) => grupo.classList.contains(c)) ?? null;
}
function seleccionar(clave) {
  // Las piezas 1 a 9 solo están en la vista del robot
  if (clave && clave.startsWith("p") && escenario.dataset.vista !== "robot") $("#tab-robot").click();
  if (!clave || escenario.dataset.sel === clave) {
    delete escenario.dataset.sel;
    $("[data-ficha-titulo]").textContent = "Toca una pieza";
    $("[data-ficha-texto]").textContent = "Toca el dibujo o elige una pieza de la lista para resaltarla y ver su nombre y su función.";
  } else {
    escenario.dataset.sel = clave;
    $("[data-ficha-titulo]").textContent = DATOS.INFO[clave].titulo;
    $("[data-ficha-texto]").textContent = DATOS.INFO[clave].texto;
  }
  $$(".boton-pieza").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pieza === escenario.dataset.sel)));
}
escenario.addEventListener("click", (e) => seleccionar(claveDe(e.target)));
$$(".boton-pieza").forEach((b) => b.addEventListener("click", () => seleccionar(b.dataset.pieza)));

// Si la pestaña vuelve a estar visible, retoma el movimiento
document.addEventListener("visibilitychange", () => !document.hidden && arrancar());

leer(angulo);
encender(false);
