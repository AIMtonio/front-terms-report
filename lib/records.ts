import * as XLSX from "xlsx";

export type ClientRecord = {
  row: number;
  nombre: string;
  dpi: string;
  codigo: string;
  fechaOtp: string;
  fechaValidacion: string;
  missing: string[];
};

// Columnas aceptadas (encabezados normalizados: minúsculas, sin acentos ni espacios).
const COLUMN_ALIASES: Record<keyof Omit<ClientRecord, "row" | "missing">, string[]> = {
  nombre: ["nombre", "nombredeltitular", "titular", "cliente"],
  dpi: ["dpi"],
  codigo: ["codigosms", "codigootp", "codigootpnip", "otp", "nip", "codigo"],
  fechaOtp: ["fechaotp", "fechacreacion", "fechadecreacion"],
  fechaValidacion: ["fechavalidacion", "fechadevalidacion"],
};

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre",
  dpi: "DPI",
  codigo: "Código",
  fechaOtp: "Fecha OTP",
  fechaValidacion: "Fecha validación",
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pad = (n: number) => String(n).padStart(2, "0");

const formatDate = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function toDateText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return isNaN(value.getTime()) ? "" : formatDate(value);
  if (typeof value === "number") {
    // Serial de fecha de Excel
    const p = XLSX.SSF.parse_date_code(value);
    if (!p) return String(value);
    return `${pad(p.d)}/${pad(p.m)}/${p.y} ${pad(p.H)}:${pad(p.M)}:${pad(Math.floor(p.S))}`;
  }
  const text = String(value).trim();
  // yyyy-mm-dd hh:mm[:ss[.ms]]
  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${pad(+m[3])}/${pad(+m[2])}/${m[1]} ${pad(+(m[4] ?? 0))}:${m[5] ?? "00"}:${m[6] ?? "00"}`;
  // dd/mm/yyyy hh:mm[:ss]
  m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${pad(+m[1])}/${pad(+m[2])}/${m[3]} ${pad(+(m[4] ?? 0))}:${m[5] ?? "00"}:${m[6] ?? "00"}`;
  return text;
}

function toPlainText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? value.toFixed(0) : String(value);
  return String(value).trim();
}

export async function parseFile(file: File): Promise<ClientRecord[]> {
  const buffer = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name);
  const wb = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(buffer), { type: "string", raw: true })
    : XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("El archivo no contiene hojas.");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: "" });
  if (rows.length === 0) throw new Error("El archivo no contiene registros.");

  // Resolver qué encabezado del archivo corresponde a cada campo
  const headers = Object.keys(rows[0]);
  const columnFor = {} as Record<keyof typeof COLUMN_ALIASES, string | undefined>;
  for (const field of Object.keys(COLUMN_ALIASES) as (keyof typeof COLUMN_ALIASES)[]) {
    columnFor[field] = headers.find((h) => COLUMN_ALIASES[field].includes(normalize(h)));
  }
  if (!columnFor.nombre) {
    throw new Error(`No se encontró la columna "Nombre". Encabezados detectados: ${headers.join(", ")}`);
  }

  return rows
    .map((r, i) => {
      const get = (f: keyof typeof COLUMN_ALIASES) => (columnFor[f] ? r[columnFor[f]!] : "");
      const rec: ClientRecord = {
        row: i + 2,
        nombre: toPlainText(get("nombre")).toUpperCase(),
        dpi: toPlainText(get("dpi")),
        codigo: toPlainText(get("codigo")),
        fechaOtp: toDateText(get("fechaOtp")),
        fechaValidacion: toDateText(get("fechaValidacion")),
        missing: [],
      };
      rec.missing = (Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[])
        .filter((k) => !rec[k as keyof ClientRecord])
        .map((k) => FIELD_LABELS[k]);
      return rec;
    })
    .filter((r) => r.nombre || r.dpi || r.codigo);
}

export function downloadSampleTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["Nombre", "Dpi", "CodigoSms", "FechaOTP", "FechaValidacion"],
    ["Karla Lisseth Esquivel Pineda", "2441657770101", "8961", "2026-10-06 14:35:50", "2026-10-06 15:25:20"],
  ]);
  ws["!cols"] = [{ wch: 34 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, "plantilla_clientes.xlsx");
}
