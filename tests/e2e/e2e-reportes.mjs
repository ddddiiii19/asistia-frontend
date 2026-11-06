// Verificación en navegador real del módulo de reportes (Q6).
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const FRONT = 'http://localhost:3001';
const ok = (c, m) => { console.log(`${c ? 'OK ' : 'FALLA'} ${m}`); if (!c) process.exitCode = 1; };

const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox', '--no-zygote', '--disable-gpu', '--disable-dev-shm-usage'], executablePath: await chromium.executablePath(), headless: 'shell' });
async function sesion(usuario, clave, ancho = 1280) {
  // La sesión vive en sessionStorage (ámbito de pestaña): una pestaña nueva equivale a un navegador distinto.
  const page = await browser.newPage();
  await page.setViewport({ width: ancho, height: 900 });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[name="identificador"], #identificador, input[type="text"]', usuario);
  await page.type('input[type="password"]', clave);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')]);
  return { page, errores };
}
const texto = (page) => page.evaluate(() => document.body.innerText);

// 1) Administrador global
{
  const { page, errores } = await sesion('admin', process.env.ADMIN_SEED_PASSWORD);
  ok(page.url().endsWith('/admin'), `admin entra al panel (${page.url()})`);
  await page.waitForSelector('main a[href="/admin/reportes"]', { timeout: 15000 });
  await page.click('main a[href="/admin/reportes"]');
  await page.waitForSelector('dl', { timeout: 15000 });
  await page.waitForFunction(() => document.body.innerText.includes('Consultas realizadas') && document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 });
  let t = await texto(page);
  ok(/Consultas realizadas/.test(t) && /Tiempo promedio de respuesta/.test(t), 'muestra los indicadores principales');
  ok(/Registro y Control/.test(t) && /Preguntas más frecuentes/.test(t), 'muestra dependencias y preguntas frecuentes');
  ok(/\d,\d s/.test(t), 'el tiempo promedio está formateado en segundos');
  ok(!/NaN|undefined|\[object/.test(t), 'no hay valores rotos (NaN/undefined)');
  ok(await page.$$eval('tbody tr', (f) => f.length) === 15, 'la tabla muestra 15 filas por página');
  await page.screenshot({ path: 'capturas/q6-reportes-escritorio.png', fullPage: true });

  // filtro por dependencia
  const total0 = await page.$eval('dl dd', (e) => e.textContent);
  await page.select('select', await page.$$eval('select option', (o) => o.find((x) => x.textContent === 'Bienestar').value));
  await page.click('button[type="submit"]');
  await page.waitForFunction((v) => document.querySelector('dl dd').textContent !== v, { timeout: 15000 }, total0);
  const total1 = await page.$eval('dl dd', (e) => e.textContent);
  ok(Number(total1) < Number(total0) && Number(total1) > 0, `filtrar por Bienestar reduce el total (${total0} -> ${total1})`);
  t = await texto(page);
  ok(!/Registro y Control/.test(t.split('Detalle de interacciones')[0].split('Dependencias a las que')[1] || ''), 'con filtro solo aparece Bienestar en el ranking');

  // paginación
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0);
  await page.evaluate(() => [...document.querySelectorAll('form button')].find((b) => b.textContent === 'Limpiar').click());
  await page.waitForFunction((v) => document.querySelector('dl dd').textContent === v, { timeout: 15000 }, total0);
  const siguiente = await page.$$('nav[aria-label="Paginación de interacciones"] button');
  await siguiente[1].click();
  await page.waitForFunction(() => document.body.innerText.includes('Página 2'), { timeout: 15000 });
  ok(true, 'la paginación avanza a la página 2');

  // periodo inválido
  // El campo de fecha de Chromium espera mm/dd/aaaa: se fija el valor como lo haría el selector de fecha.
  await page.evaluate(() => {
    const poner = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const [desde, hasta] = document.querySelectorAll('input[type="date"]');
    poner(desde, '2026-10-20');
    poner(hasta, '2026-10-01');
  });
  await page.click('button[type="submit"]');
  await page.waitForSelector('form [role="alert"]');
  ok(/posterior/.test(await texto(page)), 'un periodo invertido se avisa sin llamar a la API');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
}

// 2) Administrador de dependencia
{
  const { page, errores } = await sesion('admin_registro', process.env.ADMIN_SEED_PASSWORD);
  await page.goto(`${FRONT}/admin/reportes`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('dl', { timeout: 15000 });
  const t = await texto(page);
  ok(!(await page.$('select')), 'el admin de dependencia no ve el filtro por dependencia');
  const ranking = t.split('Dependencias a las que se direccionan las consultas')[1].split('Consultas por día')[0];
  ok(/Registro y Control/.test(ranking) && !/Admisiones|Bienestar|Coordinación/.test(ranking), 'solo ve su dependencia en el ranking');
  await page.screenshot({ path: 'capturas/q6-reportes-dependencia.png', fullPage: true });
  ok(errores.length === 0, 'sin errores de consola (admin de dependencia)');
}

// 3) Móvil
{
  const { page } = await sesion('admin', process.env.ADMIN_SEED_PASSWORD, 390);
  await page.goto(`${FRONT}/admin/reportes`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('dl', { timeout: 15000 });
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!desborde, 'en móvil (390 px) la página no se desborda horizontalmente');
  await page.screenshot({ path: 'capturas/q6-reportes-movil.png', fullPage: true });
}

// 4) Un usuario no entra a reportes
{
  const { page } = await sesion('usuario_demo', process.env.USER_SEED_PASSWORD);
  await page.goto(`${FRONT}/admin/reportes`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  ok(page.url().endsWith('/chat'), `un usuario es devuelto al chat (${page.url()})`);
}
await browser.close();
