import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { ClientRecord } from "./records";
import { PARAGRAPHS, SUBTITLE, TITLE } from "./template";

// Medidas en puntos sobre hoja carta (612 x 792), calcadas del PDF de referencia.
const PAGE = { width: 612, marginX: 86 };
const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;
const FONT_SIZE = 10.5;
const LINE_HEIGHT = 1.2;

export function buildPdf(rec: ClientRecord): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setProperties({ title: `Autorización - ${rec.nombre}`, author: "MACROPAY GUATEMALA" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_SIZE);
  doc.setTextColor(30, 30, 30);

  const centerX = PAGE.width / 2;
  doc.text(TITLE, centerX, 116, { align: "center" });
  doc.text(SUBTITLE, centerX, 145, { align: "center" });

  const lineStep = FONT_SIZE * LINE_HEIGHT * 1.15;
  let y = 190;
  for (const paragraph of PARAGRAPHS) {
    const lines = doc.splitTextToSize(paragraph, CONTENT_WIDTH) as string[];
    doc.text(paragraph, PAGE.marginX, y, {
      align: "justify",
      maxWidth: CONTENT_WIDTH,
      lineHeightFactor: LINE_HEIGHT * 1.15,
    });
    y += lines.length * lineStep + lineStep;
  }

  y += lineStep * 1.5;
  const fields = [
    `Nombre del Titular: ${rec.nombre}`,
    `DPI: ${rec.dpi}`,
    `Código OTP/NIP: ${rec.codigo}`,
    `Fecha de creación: (OTP): ${rec.fechaOtp}`,
    `Fecha de validación: (OTP y consentimiento): ${rec.fechaValidacion}`,
  ];
  for (const f of fields) {
    doc.text(f, PAGE.marginX, y);
    y += lineStep;
  }
  return doc;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();

/** Nombre del archivo: <DPI o NOMBRE>_<ddMMyy de validación>.pdf, único dentro del zip. */
export function fileNameFor(rec: ClientRecord, used: Set<string>): string {
  const base = rec.dpi ? slug(rec.dpi) : slug(rec.nombre) || `REGISTRO_${rec.row}`;
  const d = rec.fechaValidacion.match(/^(\d{2})\/(\d{2})\/\d{2}(\d{2})/);
  let name = d ? `${base}_${d[1]}${d[2]}${d[3]}` : base;
  if (used.has(name)) {
    let i = 2;
    while (used.has(`${name}_${i}`)) i++;
    name = `${name}_${i}`;
  }
  used.add(name);
  return `${name}.pdf`;
}

export function previewPdf(rec: ClientRecord) {
  const url = buildPdf(rec).output("bloburl");
  window.open(url.toString(), "_blank");
}

export async function buildZip(
  records: ClientRecord[],
  onProgress: (done: number) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (let i = 0; i < records.length; i++) {
    zip.file(fileNameFor(records[i], used), buildPdf(records[i]).output("arraybuffer"));
    onProgress(i + 1);
    // Ceder el hilo para que la barra de progreso se pinte
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
