"use client";

import { useRef, useState } from "react";
import { downloadSampleTemplate, parseFile, type ClientRecord } from "@/lib/records";

type Status = "idle" | "loaded" | "generating" | "done";

export default function Home() {
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const incomplete = records.filter((r) => r.missing.length > 0).length;
  const step = status === "idle" ? 1 : status === "done" ? 3 : 2;

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      const data = await parseFile(file);
      setRecords(data);
      setFileName(file.name);
      setStatus("loaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  function reset() {
    setRecords([]);
    setFileName("");
    setStatus("idle");
    setProgress(0);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function preview(rec: ClientRecord) {
    const { previewPdf } = await import("@/lib/pdf");
    previewPdf(rec);
  }

  async function generate() {
    setStatus("generating");
    setProgress(0);
    try {
      const { buildZip, saveBlob } = await import("@/lib/pdf");
      const blob = await buildZip(records, setProgress);
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      saveBlob(blob, `autorizaciones_${stamp}.zip`);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar los PDF.");
      setStatus("loaded");
    }
  }

  const pct = records.length ? Math.round((progress / records.length) * 100) : 0;

  return (
    <>
      <div className="bg-blobs" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      <main className="container">
        <header className="hero">
          <h1>Generador de Autorizaciones</h1>
          <p>Carga tu listado de clientes y descarga un ZIP con un PDF de autorización por registro.</p>
          <div className="steps">
            {["Cargar archivo", "Revisar registros", "Descargar ZIP"].map((label, i) => (
              <div key={label} className={`step ${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}>
                <b>{step > i + 1 ? "✓" : i + 1}</b>
                {label}
              </div>
            ))}
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}

        {status === "idle" ? (
          <section className="card">
            <div
              className={`dropzone ${drag ? "drag" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                handleFile(e.dataTransfer.files[0]);
              }}
            >
              <span className="icon">📄</span>
              <h3>Arrastra tu archivo aquí o haz clic para seleccionarlo</h3>
              <p>Formatos: .xlsx, .xls, .csv — Columnas: Nombre, Dpi, CodigoSms, FechaOTP, FechaValidacion</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button className="btn link" onClick={downloadSampleTemplate}>
                Descargar plantilla de ejemplo (.xlsx)
              </button>
            </div>
          </section>
        ) : (
          <section className="card">
            <div className="toolbar">
              <div>
                <h2>{fileName}</h2>
                <div className="meta">
                  {records.length} registro{records.length === 1 ? "" : "s"}
                  {incomplete > 0 && ` · ${incomplete} con datos incompletos`}
                </div>
              </div>
              <div className="actions">
                <button className="btn" onClick={reset} disabled={status === "generating"}>
                  Cargar otro archivo
                </button>
                <button className="btn primary" onClick={generate} disabled={status === "generating" || !records.length}>
                  {status === "generating" ? "Generando…" : `Generar ZIP (${records.length} PDF)`}
                </button>
              </div>
            </div>

            {incomplete > 0 && (
              <div className="alert warn">
                Hay registros con campos vacíos. Se generarán igualmente, dejando el campo en blanco en el PDF.
              </div>
            )}

            {status === "generating" && (
              <div className="progress" style={{ marginBottom: 16 }}>
                <div className="bar">
                  <div className="fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="label">
                  <span>Generando PDFs…</span>
                  <span>
                    {progress} / {records.length} ({pct}%)
                  </span>
                </div>
              </div>
            )}

            {status === "done" && (
              <div className="success" style={{ marginBottom: 16 }}>
                <div className="check">✓</div>
                <strong>¡Listo! Se descargó el ZIP con {records.length} PDF.</strong>
                <div>
                  <button className="btn link" onClick={generate}>
                    Descargar de nuevo
                  </button>
                </div>
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Nombre del titular</th>
                    <th>DPI</th>
                    <th>Código OTP/NIP</th>
                    <th>Fecha creación OTP</th>
                    <th>Fecha validación</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.row} style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}>
                      <td>{r.row}</td>
                      <td>{r.nombre || <span className="empty">—</span>}</td>
                      <Cell value={r.dpi} />
                      <Cell value={r.codigo} />
                      <Cell value={r.fechaOtp} />
                      <Cell value={r.fechaValidacion} />
                      <td>
                        {r.missing.length ? (
                          <span className="badge warn" title={`Faltan: ${r.missing.join(", ")}`}>
                            Incompleto
                          </span>
                        ) : (
                          <span className="badge ok">OK</span>
                        )}
                      </td>
                      <td>
                        <button className="btn small" onClick={() => preview(r)}>
                          Ver PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <footer>Los archivos se procesan localmente en tu navegador; no se envían a ningún servidor.</footer>
      </main>
    </>
  );
}

function Cell({ value }: { value: string }) {
  return value ? <td>{value}</td> : <td className="empty">vacío</td>;
}
