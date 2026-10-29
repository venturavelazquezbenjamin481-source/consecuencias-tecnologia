# Fuente de las ilustraciones del robot hexápodo

No hace falta nada de esto para usar el proyecto: `robot-hexapodo.html` y las
imágenes de `imagenes/` ya están listas y funcionan sin Node.

Estos archivos solo sirven para volver a generar los dibujos si cambia el robot.
Usan el kit de dibujo isométrico de la skill "anatomy" de Claude, que debe estar
enlazado como carpeta `skill` dentro de esta carpeta.

- `modelo.mjs`: medidas del robot y cálculo de la posición de patas y bielas según el ángulo de la polea.
- `piezas.mjs`: dibujo de las piezas que se mueven (patas, bielas, polea, clips).
- `escena.mjs`: dibujo de las piezas fijas (tapete, marco, motores, pila, interruptor, cables, eje en L).
- `circuito.mjs`: dibujo del circuito eléctrico.
- `exportar.mjs`: páginas para las imágenes PNG del documento de Word.
- `interactivo.mjs`, `vivo.js`, `estilo.css`: la versión interactiva.

Comandos: `node build.mjs 270 --audit` (revisa la geometría), `node exportar.mjs`, `node interactivo.mjs`.
