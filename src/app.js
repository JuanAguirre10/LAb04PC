const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const puppeteer = require('puppeteer');

const app = express();
const upload = multer({ dest: 'uploads/' });
let resultadosCache = [];

async function consultarONPE(dni) {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ]
  });
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://consultaelectoral.onpe.gob.pe/inicio', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));

    const input = await page.$('input[type="text"], input[placeholder], input:not([type="hidden"])');
    if (!input) throw new Error('No input');
    await input.click();
    await input.type(dni, { delay: 100 });
    await new Promise(r => setTimeout(r, 500));
    const btn = await page.$('button[type="submit"], button.btn, button');
    if (btn) await btn.click();
    else await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 5000));

    const datos = await page.evaluate(() => {
      const body = document.body.innerText.toUpperCase();
      let esMiembro = 'NO';
      if (body.includes('MIEMBRO TITULAR')) esMiembro = 'MIEMBRO TITULAR';
      else if (body.includes('MIEMBRO ACCESITARIO')) esMiembro = 'MIEMBRO ACCESITARIO';
      else if (body.includes('PRESIDENTE DE MESA')) esMiembro = 'PRESIDENTE DE MESA';
      else if (body.includes('ES MIEMBRO DE MESA') && !body.includes('NO ERES MIEMBRO')) esMiembro = 'MIEMBRO DE MESA';

      const allText = document.body.innerText;
      const ubicMatch = allText.match(/[A-ZÁÉÍÓÚ]+\s*\/\s*[A-ZÁÉÍÓÚ]+\s*\/\s*[A-ZÁÉÍÓÚ ]+/i);
      const ubicacion = ubicMatch ? ubicMatch[0].trim() : '';

      const dirEl = document.querySelector('.direccion_local');
      const direccion = dirEl ? dirEl.innerText.replace(/\n/g, ' ').trim() : '';
      return { esMiembro, ubicacion, direccion };
    });

    return datos;
  } catch(e) {
    console.error('Error DNI', dni, e.message);
    return { esMiembro: 'ERROR', ubicacion: '', direccion: '' };
  } finally {
    await page.close();
    await browser.close();
  }
}

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Consulta ONPE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #f0f4f8; }
    header { background: #028090; color: white; padding: 20px 40px; }
    header h1 { font-size: 24px; }
    header p { font-size: 13px; opacity: 0.85; margin-top: 5px; }
    .container { padding: 30px 40px; }
    .upload-box { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 30px; }
    .upload-box h2 { color: #028090; margin-bottom: 15px; }
    input[type=file] { margin-right: 10px; }
    button { background: #028090; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; }
    button:hover { background: #026070; }
    #loading { display: none; color: #028090; font-weight: bold; margin-top: 15px; }
    #tabla-wrap { margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    th { background: #028090; color: white; padding: 12px 16px; text-align: left; font-size: 13px; }
    td { padding: 12px 16px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f0f9fa; }
    .NO { background: #f8d7da; color: #721c24; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
    .SI { background: #d4edda; color: #155724; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
    .ERROR { background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 12px; font-weight: bold; }
    .btn-descarga { display: inline-block; margin-top: 15px; background: #28a745; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <h1>🗳️ Consulta Electoral ONPE 2026</h1>
    <p>Sube un Excel con DNIs para verificar si son miembros de mesa</p>
  </header>
  <div class="container">
    <div class="upload-box">
      <h2>📂 Subir Excel con DNIs</h2>
      <p style="margin-bottom:15px;color:#666;">El Excel debe tener una columna llamada <strong>DNI</strong></p>
      <input type="file" id="archivo" accept=".xlsx,.xls">
      <button onclick="consultar()">Consultar ONPE</button>
      <div id="loading">⏳ Consultando DNIs en ONPE...</div>
    </div>
    <div id="tabla-wrap"></div>
  </div>
  <script>
    let filas = [];

    function renderTabla() {
      let html = '<table><thead><tr><th>DNI</th><th>Ubicación (Región/Provincia/Distrito)</th><th>Dirección del Local de Votación</th><th>¿Es Miembro de Mesa?</th></tr></thead><tbody>';
      filas.forEach(c => {
        const clase = c.esMiembro === 'NO' ? 'NO' : c.esMiembro === 'ERROR' ? 'ERROR' : 'SI';
        html += '<tr><td>' + c.dni + '</td><td>' + c.ubicacion + '</td><td>' + c.direccion + '</td><td><span class="' + clase + '">' + c.esMiembro + '</span></td></tr>';
      });
      html += '</tbody></table>';
      html += '<a class="btn-descarga" href="/descargar">⬇️ Descargar Excel con resultados</a>';
      document.getElementById('tabla-wrap').innerHTML = html;
    }

    async function consultar() {
      const archivo = document.getElementById('archivo').files[0];
      if (!archivo) { alert('Selecciona un archivo Excel'); return; }
      const formData = new FormData();
      formData.append('excel', archivo);
      document.getElementById('loading').style.display = 'block';
      document.getElementById('tabla-wrap').innerHTML = '';
      filas = [];

      const res = await fetch('/consultar-stream', { method: 'POST', body: formData });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              filas.push(data);
              renderTabla();
            } catch(e) {}
          }
        }
      }
      document.getElementById('loading').style.display = 'none';
    }
  </script>
</body>
</html>`);
});

app.post('/consultar-stream', upload.single('excel'), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const workbook = XLSX.readFile(req.file.path);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(sheet);

  resultadosCache = [];
  for (const fila of filas) {
    const dni = String(fila.DNI || fila.dni || Object.values(fila)[0]).trim();
    const datos = await consultarONPE(dni);
    const resultado = { dni, ...datos };
    resultadosCache.push(resultado);
    res.write('data: ' + JSON.stringify(resultado) + '\n\n');
  }
  res.end();
});

app.get('/descargar', (req, res) => {
  const data = resultadosCache.map(c => ({
    'DNI': c.dni,
    'Ubicación (Región/Provincia/Distrito)': c.ubicacion,
    'Dirección del Local de Votación': c.direccion,
    '¿Es Miembro de Mesa?': c.esMiembro
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Resultados');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=resultados_onpe.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

app.listen(3000, () => console.log('Servidor en puerto 3000'));