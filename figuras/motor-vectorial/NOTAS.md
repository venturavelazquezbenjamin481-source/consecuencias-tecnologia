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

1. [ ] Banco estático + motor 3D con cardán + actuadores por fotograma + interacción + lecturas.
2. [ ] Plomería del motor: turbobomba, generador de gas, conductos, colector, fuelles.
3. [ ] Pluma WebGL (oscuro y claro) + respaldo sin WebGL.
4. [ ] Auditorías: kit `--audit`, orbital 3D, `lines.mjs`, primeros planos 4× en ambos temas.
5. [ ] Pulido, móvil, hoja PDF A4 (opcional).

## Registro

- 2026-10-26: diseño inicial, kit copiado en `anatomy/`.
