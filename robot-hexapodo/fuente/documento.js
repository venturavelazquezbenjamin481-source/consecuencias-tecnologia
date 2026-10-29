// Documento de Word del proyecto: texto editable con las ilustraciones del robot
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, Footer, PageNumber, PageBreak, ExternalHyperlink,
} = require("docx");
const { imageSize } = (() => {
  // Tamaño de un PNG leyendo su cabecera
  return { imageSize: (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }) };
})();

const ANCHO_TEXTO = 9360; // carta con márgenes de 2.54 cm, en DXA
const ANCHO_IMG = 624; // px a 96 ppp = 6.5 in
const FUENTE = "Calibri";
const TINTA = "1D1D20";
const SUAVE = "55555A";
const ACENTO = "2F5FE0";
const ENLACE = "https://claude.ai/artifact/RbkppsqGifGw8Zdwvmf7sE";

const p = (texto, op = {}) => new Paragraph({ spacing: { after: 140, line: 300 }, ...op, children: (Array.isArray(texto) ? texto : [texto]).map((t) => (typeof t === "string" ? new TextRun(t) : t)) });
const b = (t) => new TextRun({ text: t, bold: true });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const vineta = (texto) => new Paragraph({ numbering: { reference: "vinetas", level: 0 }, spacing: { after: 60, line: 288 }, children: (Array.isArray(texto) ? texto : [texto]).map((t) => (typeof t === "string" ? new TextRun(t) : t)) });

function figura(archivo, pie) {
  const datos = fs.readFileSync(archivo);
  const { width, height } = imageSize(datos);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true, children: [new ImageRun({ type: "png", data: datos, transformation: { width: ANCHO_IMG, height: Math.round((ANCHO_IMG * height) / width) }, altText: { title: pie, description: pie, name: pie } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: pie, italics: true, size: 20, color: SUAVE })] }),
  ];
}

const borde = { style: BorderStyle.SINGLE, size: 4, color: "C9C9CE" };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };
function tabla(columnas, filas) {
  const total = columnas.reduce((s, c) => s + c.ancho, 0);
  const celda = (texto, ancho, encabezado) =>
    new TableCell({
      borders: bordes,
      width: { size: ancho, type: WidthType.DXA },
      shading: encabezado ? { fill: "E9EDF9", type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 70, bottom: 70, left: 110, right: 110 },
      children: [new Paragraph({ children: [new TextRun({ text: texto, bold: encabezado, size: 21 })] })],
    });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: columnas.map((c) => c.ancho),
    rows: [
      new TableRow({ tableHeader: true, children: columnas.map((c) => celda(c.titulo, c.ancho, true)) }),
      ...filas.map((f) => new TableRow({ cantSplit: true, children: f.map((t, i) => celda(t, columnas[i].ancho, false)) })),
    ],
  });
}

const PIEZAS = [
  ["1", "Pata trasera", "Palito de paleta", "Gira sobre un alfiler clavado en el segmento de 12 cm del marco."],
  ["2", "Biela trasera", "Palito de paleta", "Une la parte de arriba de la pata 1 con el orificio excéntrico de la polea."],
  ["3", "Pata central", "Palito de paleta", "Va unida al orificio excéntrico de la polea; arriba gira en la punta del eje en L."],
  ["4", "Biela delantera", "Palito de paleta", "Une la parte de arriba de la pata 5 con el orificio excéntrico de la polea."],
  ["5", "Pata delantera", "Palito de paleta", "Gira sobre un alfiler clavado en el segmento de 12 cm del marco."],
  ["6", "Base del eje en L", "Medio palito de paleta", "Fija al marco con 3 alfileres en triángulo. Es la única unión fija del robot."],
  ["7", "Brazo del eje en L", "Medio palito de paleta", "En su punta gira la parte de arriba de la pata central."],
  ["8", "Polea", "Disco de 5 cm", "Orificio central para la flecha del motor y orificio excéntrico a 1 cm del centro."],
  ["9", "Marco", "Madera de balsa", "20 × 12 cm con barra central de 9.5 cm; los segmentos de 20 cm van sobre los de 12 cm, unidos con tornillos."],
];

const campo = (etiqueta) =>
  new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: `${etiqueta}: `, bold: true, color: TINTA }), new TextRun({ text: "escribe aquí", color: "9A9AA0" })],
  });

const doc = new Document({
  creator: "Equipo del proyecto",
  title: "Robot hexápodo",
  styles: {
    default: { document: { run: { font: FUENTE, size: 23, color: TINTA } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, font: FUENTE, color: TINTA }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: FUENTE, color: ACENTO }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: [{ reference: "vinetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] }] },
  sections: [
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Robot hexápodo · página ", size: 18, color: SUAVE }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: SUAVE })] })] }) },
      children: [
        // ---------- Portada ----------
        new Paragraph({ spacing: { before: 600, after: 80 }, children: [new TextRun({ text: "PROYECTO DE INFORMÁTICA", size: 20, color: SUAVE, characterSpacing: 40 })] }),
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Robot hexápodo", size: 64, bold: true })] }),
        new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: "Robot insecto de seis patas con motorreductores", size: 30, color: SUAVE })] }),
        ...figura("word/posicion-3-recorte.png", "Robot hexápodo terminado, en su posición inicial."),
        campo("Integrantes"),
        campo("Grupo"),
        campo("Profesor(a)"),
        campo("Fecha de entrega"),
        new Paragraph({ children: [new PageBreak()] }),

        // ---------- 1. Introducción ----------
        h1("1. Introducción"),
        p("Un robot hexápodo es un robot que camina con seis patas, como un insecto. En este proyecto construimos uno con materiales sencillos: madera de balsa, palitos de paleta, dos motorreductores y una pila de 9 V."),
        p("El robot no necesita programación: el movimiento de las patas lo produce un mecanismo. Cada motor hace girar una polea, y un orificio excéntrico en la polea mueve las patas y las bielas para que el robot dé pasos. Así podemos ver cómo un giro se convierte en un movimiento de caminar."),

        // ---------- 2. Materiales ----------
        h1("2. Materiales"),
        vineta("Madera de balsa para el marco de 20 × 12 cm y la barra central de 9.5 cm."),
        vineta("Palitos de paleta para las patas, las bielas y el eje en L."),
        vineta("2 motorreductores de 100 rpm."),
        vineta("1 pila de 9 V con su broche."),
        vineta("1 interruptor."),
        vineta("Cables (rojo y negro)."),
        vineta("2 poleas de 5 cm de diámetro."),
        vineta("Clips para las uniones móviles y alfileres para los pivotes."),
        vineta("Tornillos para el marco y cinta para sujetar los motores."),

        // ---------- 3. Estructura ----------
        new Paragraph({ children: [new PageBreak()] }),
        h1("3. Estructura del robot"),
        p("La figura 1 muestra el robot completo con sus piezas numeradas. El robot es simétrico: el otro lado es igual, como en un espejo."),
        ...figura("word/general-recorte.png", "Figura 1. Vista general del robot con las piezas 1 a 9."),
        tabla(
          [
            { titulo: "No.", ancho: 700 },
            { titulo: "Pieza", ancho: 2100 },
            { titulo: "Material", ancho: 2000 },
            { titulo: "Función", ancho: 4560 },
          ],
          PIEZAS,
        ),
        h2("Marco (pieza 9)"),
        p("Es de madera de balsa de 20 × 12 cm, con una barra central de 9.5 cm. Los segmentos de 20 cm van encima de los de 12 cm y se unen con tornillos."),
        h2("Motores y alimentación"),
        p("Hay dos motorreductores de 100 rpm, uno en cada extremo de la barra central, sujetos con cinta. La flecha de cada motor sale del marco y entra en el orificio central de la polea. Los alimenta una pila de 9 V con un interruptor."),
        h2("Polea (pieza 8)"),
        p("Hay una polea en cada lado. Mide 5 cm de diámetro y tiene dos orificios: uno central, para la flecha del motor, y otro excéntrico, a 1 cm del centro. El orificio excéntrico es el que mueve las patas."),
        h2("Patas y bielas (piezas 1 a 5)"),
        p("Cada lado tiene tres patas de palito de paleta. Las dos patas exteriores (1 y 5) giran sobre alfileres clavados en los segmentos de 12 cm del marco. La pata central (3) está unida al orificio excéntrico de la polea."),
        p("Las bielas (2 y 4) son palitos que unen la parte de arriba de las patas exteriores con el punto excéntrico. Junto con las patas forman una letra “M”."),
        h2("Eje de rotación (piezas 6 y 7)"),
        p("Es una pieza en forma de L hecha con dos mitades de palito. Une la parte de arriba de la pata central con el marco. Su base está fija con 3 alfileres en triángulo y es la única unión fija del robot."),
        h2("Uniones"),
        p("Todas las uniones que se mueven son trozos de clip doblados en espiral, que dejan girar las piezas sin que se salgan."),

        // ---------- 4. Circuito ----------
        new Paragraph({ children: [new PageBreak()] }),
        h1("4. Circuito eléctrico"),
        ...figura("word/circuito-recorte.png", "Figura 2. Pila de 9 V, interruptor y los dos motores con la polaridad invertida."),
        p([b("Cómo está conectado. "), "El cable rojo (positivo) sale de la pila, pasa por el interruptor y llega a los dos motores. El cable negro (negativo) va directo de la pila a los motores. Al cerrar el interruptor, la corriente llega a los dos motores al mismo tiempo."]),
        p([b("Polaridad invertida. "), "En el motor A el cable rojo va a la terminal + y en el motor B va a la terminal −. Por eso los dos motores giran en sentidos opuestos, como muestran las flechas de la figura 2."]),
        p([b("¿Por qué así? "), "Los motores están montados en espejo, uno mirando hacia cada lado del robot. Si giraran igual, un lado caminaría hacia adelante y el otro hacia atrás. Con la polaridad invertida, los dos lados empujan al robot hacia el mismo lado."]),

        // ---------- 5. Ciclo de movimiento ----------
        new Paragraph({ children: [new PageBreak()] }),
        h1("5. Ciclo de movimiento"),
        p("Al girar, la polea lleva el orificio excéntrico en círculo. Ese punto mueve a la vez la pata central y las dos bielas, y las bielas mueven las patas exteriores. El ciclo tiene tres posiciones:"),
        tabla(
          [
            { titulo: "Posición", ancho: 1200 },
            { titulo: "Polea", ancho: 1700 },
            { titulo: "Qué pasa", ancho: 6460 },
          ],
          [
            ["1", "50° a 60°", "La pata central sube y va a la izquierda; las bielas van a la izquierda y las patas exteriores a la derecha. El robot da un paso."],
            ["2", "120° a 130°", "Todo hace el movimiento contrario y el robot da el siguiente paso."],
            ["3", "270°", "El mecanismo vuelve a la posición inicial y el ciclo se repite."],
          ],
        ),
        h2("Posición 1: polea entre 50° y 60°"),
        ...figura("word/posicion-1-recorte.png", "Figura 3. Posición 1, dibujada con la polea en 55°."),
        p("La pata central sube y va a la izquierda, las bielas se mueven a la izquierda y las patas exteriores van a la derecha. El robot da un paso."),
        h2("Posición 2: polea entre 120° y 130°"),
        ...figura("word/posicion-2-recorte.png", "Figura 4. Posición 2, dibujada con la polea en 125°."),
        p("Todo hace el movimiento contrario: la pata central va a la derecha, las bielas a la derecha y las patas exteriores a la izquierda. El robot da el siguiente paso."),
        h2("Posición 3: polea en 270°"),
        ...figura("word/posicion-3-recorte.png", "Figura 5. Posición 3, con la polea en 270°: la posición inicial."),
        p("El mecanismo vuelve a la posición inicial, con las seis patas apoyadas, y el ciclo se repite mientras el motor siga girando."),

        // ---------- 6. Versión interactiva ----------
        h1("6. Versión interactiva"),
        p("También hicimos una versión interactiva del robot en una página web. Ahí se puede encender el motor, cambiar la velocidad de 0 a 100 rpm, ver el ángulo de la polea y la posición del ciclo en vivo, tocar cada pieza para ver su función y revisar el circuito eléctrico."),
        new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: "Enlace: ", bold: true }), new ExternalHyperlink({ link: ENLACE, children: [new TextRun({ text: ENLACE, style: "Hyperlink", color: ACENTO, underline: {} })] })] }),

        // ---------- 7. Conclusión ----------
        h1("7. Conclusión"),
        p("Con este proyecto aprendimos cómo un mecanismo puede convertir el giro de un motor en pasos, sin necesidad de programación. La polea con su orificio excéntrico, las bielas y los pivotes trabajan juntos para mover las seis patas. También vimos que la forma de conectar los motores (la polaridad) decide hacia dónde giran, y que por eso hay que invertirla cuando los motores están montados en espejo."),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("word/robot-hexapodo.docx", buf);
  console.log("robot-hexapodo.docx", Math.round(buf.length / 1024), "KB");
});
