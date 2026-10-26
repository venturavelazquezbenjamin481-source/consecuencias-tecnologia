# Motor con empuje vectorial — notas de trabajo

Figura isométrica interactiva hecha con la skill *anatomy* (kit en `anatomy/`, licencia MIT).
Tamaño: **Epic** (elegido por el usuario). Puede ocupar varias sesiones: este archivo es el
traspaso entre sesiones. Léelo entero antes de seguir.

## Cómo construir

```sh
cd figuras/motor-vectorial
node build.mjs            # escribe motor-vectorial.html (tema oscuro)
node build.mjs --light    # escribe motor-vectorial-light.html
node build.mjs --audit    # auditoría del kit (2D) + auditoría orbital (3D)
export CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome   # en el contenedor de Claude
node anatomy/scripts/capture.mjs motor-vectorial.html --out shots/desk.png
node anatomy/scripts/lines.mjs motor-vectorial.html --out shots/lines.png
```

Las referencias de la skill (`anatomy/references/*.md`) explican cada regla. Las más usadas aquí:
`craft.md`, `3d.md` (grupos con bisagra), `webgl.md` (pluma), `motion.md`, `verify.md`.

## La idea (el objeto es la explicación)

Un banco de pruebas de vectorización de empuje: un motor cohete de queroseno y oxígeno líquido
(ciclo de generador de gas) cuelga de un cardán bajo la placa de empuje de un pórtico. Dos
actuadores electromecánicos, a 90° entre sí, empujan el motor por debajo del cardán: al
alargarse o acortarse, el motor gira sobre el cardán y la tobera apunta el chorro hacia un lado.
Ese ángulo de empuje es lo que gobierna un cohete en vuelo.

**Qué se mueve y qué significa:** el puntero (o las flechas) manda un ángulo de cabeceo y uno
de guiñada; los actuadores cambian de longitud a su velocidad máxima, el motor se inclina, la
pluma (WebGL) se desvía y el banco lee la fuerza lateral en sus dos bielas de carga laterales.

## La verdad (modelo)

Todo número mostrado sale de `model` en `build.mjs` (y su copia serializada en la página).

- Unidades del mundo: 1 = 1 cm.
- Empuje a nivel del mar F = 400 kN (motor inventado, proporciones de un motor de generador de gas).
- Cardán de dos ejes (Cardan), límite ±6° por eje y cono de 6°.
- Actuadores: velocidad máxima 20°/s equivalentes, respuesta de segundo orden (ω = 14 rad/s, ζ = 0.8)
  detrás de un limitador de velocidad. La carrera de cada actuador se calcula de la geometría real
  (distancia entre su pivote superior y su rótula en el motor), no de una fórmula lineal.
- Fuerza lateral = F·sen δ (δ = ángulo total entre el eje del motor y la vertical); fuerza axial = F·cos δ.
- Par sobre el vehículo = fuerza lateral × L, con L = 15 m (centro de masa supuesto sobre el cardán;
  se dice en el pie de figura).

## Arquitectura técnica

- **Motor = grupo 3D** del modo "turning" (beta) del kit: bisagra `pitch` (eje del cardán 1) y bisagra
  hija `yaw` (eje 2). El motor entero y sus tuberías viven en `yaw`; la cruceta del cardán en `pitch`.
- **Actuadores y fuelles de alimentación**: no pueden ser piezas 3D (una barra que entra en un cilindro
  no es separable por planos), así que se dibujan **por fotograma** en capas SVG 2D con el kit
  (`G.lathe`, `G.rodOut` con recorte) a partir de la pose del motor. Capas:
  `back svg → fuelles (2D) → canvas pluma → capa viva (motor 3D) → actuadores (2D) → front svg`.
  Los actuadores están del lado del espectador (acimut −5° y 85°, cámara a 40°), así que siempre
  quedan delante del motor donde se solapan.
- Reglas de tubos vivos: tramos verticales u horizontales, codos dentro de bolas con planos (flats),
  nunca curvas en planos verticales (con ±6° de bisagra harían falta radios enormes).

## Lista de piezas (objetivo ≥ 150)

Base: losa de hormigón sobre patas, ranura perimetral, tornillos, foso de llamas con borde de ángulo
de acero y rejilla, aro de agua de enfriamiento con boquillas, placa de identificación grabada,
regla lateral, cajas de conexión, bandeja de cables.
Estructura: dos columnas en diagonal con empalmes atornillados, viga cruzada, placa de empuje
colgada de cuatro células de carga, dos bielas laterales con célula de carga (miden la fuerza
lateral), cono de empuje de 4 puntales tubulares con bridas, bloque de montaje del cardán,
soportes de los pivotes superiores de los actuadores, escalera, bandeja de cables.
Mecanismo: cardán (yugo fijo, cruceta con 4 muñones, yugo del motor), 2 actuadores (pivote
superior con rótula, cilindro con motor eléctrico paralelo y caja de engranes, vástago cromado,
rótula inferior en orejeta del motor), 2 líneas de alimentación con fuelles articulados.
Sujeto (motor): placa del cardán, cúpula de LOX con brida, placa del inyector con círculo de
pernos, cámara con camisas y anillos, garganta, campana regenerativa en bandas con anillos
rigidizadores y colector de combustible, labio de salida; turbobomba (entrada de LOX, bomba de
LOX con voluta, turbina, bomba de combustible), generador de gas, conducto de escape de turbina
con tobera propia, conductos de descarga con codos, sensores con bridas.

## Fases y estado

1. [x] Banco estático + motor 3D con cardán + actuadores por fotograma + interacción + lecturas.
2. [x] Plomería: turbobomba, generador de gas, conducto de LOX, escape de turbina, colector de
   combustible con T, entradas con codo de bola, fuelles por fotograma, sensores.
3. [x] Pluma WebGL (oscuro: aditiva con diamantes de choque; claro: tintas resueltas sobre papel),
   luz en la losa y el foso, respaldo SVG sin WebGL.
4. [~] Auditorías: kit `--audit` en verde; `lines.mjs` 0 en ambos temas; auditoría orbital completa:
   ver `shots/audit-full.txt` (no se versiona) o volver a correr `node build.mjs --audit`.
5. [ ] Pendiente / ideas: hoja PDF A4 (`anatomy/references/print.md`), bielas laterales con célula de
   carga que lean la fuerza lateral, humo del escape de la turbina en la pluma, más detalle en las
   columnas (bandeja de cables, caja del controlador), luz en las paredes del foso.

## Anatomía (segunda tanda)

- **Despiece** (`explode.mjs`): cuatro grupos deslizantes hijos del motor — tobera (baja 70), turbobomba
  (sale 70 hacia fuera), y de ella el escape (26 más) y el generador de gas (baja 60). Muelles críticos
  escalonados; la misma función analítica mueve la página y alimenta la auditoría (clips «despiece» y
  «montaje»). Las piezas se asignan a su grupo por prefijo de nombre (`GROUP_OF` en `build.mjs`).
- **Selección**: nueve conjuntos (`ASSEMBLIES` en `build.mjs`) con ficha. El resaltado es CSS generado
  que reasigna tokens (incluida la rampa `--tn-*` de las piezas 3D y los de material); las piezas
  estáticas van envueltas en `<g data-name>`. Teclas 1–9, D despieza, Esc monta.
- **Fig. 2** (`section.mjs`): corte de un cuarto de la cámara de empuje dibujado a mano con el kit:
  interior de los 270° que quedan, exterior de los cuartos delanteros, caras cortadas, colector como
  tubo de 270°, flujos animados y una sonda con Mach, presión y temperatura isentrópicas (γ = 1,2,
  pc = 7 MPa, Tc = 3600 K). El sombreado calcula en cada fila los ángulos exactos de cambio de tono.

## Decisiones que conviene recordar

- **Kit parcheado**: `anatomy/kit/turn-build.mjs` usa 96 puntos (no 32) por pieza al buscar planos
  entre grupos (`framedCloud`); con 32, piezas largas (escape, campana) daban planos falsos en el despiece.
- **Poses de prueba**: el motor 3D muestrea como mucho 24 estados para sus planos entre grupos; por eso
  `poses()` da solo extremos del cardán y estados «prefijo» del despiece (cubren todo fotograma real).
- **Continuidad**: la auditoría orbital marca 44 avisos de continuidad en piezas de la cámara con la
  guiñada entre −5,5° y −4°. Medido en píxeles (segunda diferencia en barridos de 0,1° y 0,02°) no hay
  ningún salto visible: son piezas tapadas por la placa del inyector y los anillos, y la prueba las mide
  aisladas. La guía de la skill lo trata como fallo del motor 3D (beta) en primitivas simples.


- Los tubos vivos solo pueden ir rectos (verticales u horizontales); los cambios de dirección van
  dentro de bolas con planos. Un tubo que acaba sobre un cilindro necesita radio pequeño (flecha de
  la llanta < 0.15) o una bola tangente al cuerpo como asiento (así están el escape y la entrada de
  combustible).
- Nada fijo puede intercalarse en altura con la capa viva: las líneas de alimentación terminan por
  encima de z = 388 y el fuelle cubre el resto.
- El texto accesible usa `data-say`: `data-live` es el atributo del motor 3D y lo borraba.
- `window.__tv.set(p, q, pc)` fija ángulos y potencia para las capturas (el navegador sin GPU es
  lento y las envolventes avanzan a cámara lenta).

## Registro

- 2026-10-26: diseño inicial, kit copiado en `anatomy/`.
- 2026-10-26: fases 1–3 hechas; auditoría del kit y de líneas en verde.
- 2026-10-26: despiece, selección por conjuntos, Fig. 2 (corte con sonda isentrópica).
