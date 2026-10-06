# front-terms-report

Generador masivo de autorizaciones de consulta y reporte (MACROPAY GUATEMALA) en PDF.

## Uso

```bash
npm install
npm run dev
```

Abre http://localhost:3000, carga un `.xlsx`, `.xls` o `.csv` con las columnas
`Nombre, Dpi, CodigoSms, FechaOTP, FechaValidacion`, revisa los registros y descarga el ZIP
con un PDF por cliente. Todo se procesa en el navegador.

- Texto de la plantilla: `lib/template.ts`
- Maquetación del PDF y nombre de archivos: `lib/pdf.ts`
- Lectura del Excel/CSV y alias de columnas: `lib/records.ts`
