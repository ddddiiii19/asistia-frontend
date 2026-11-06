// Verificación en navegador real del historial administrativo (Q6).
// Requiere: backend en :3000 con datos (npm run db:seed-reportes), front compilado en :3001 y
// `npm install --no-save puppeteer-core @sparticuz/chromium`. Variables: ADMIN_SEED_PASSWORD, USER_SEED_PASSWORD.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const FRONT = 'http://localhost:3001';
const ok = (c, m) => { console.log(`${c ? 'OK ' : 'FALLA'} ${m}`); if (!c) process.exitCode = 1; };

const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--no-zygote', '--disable-gpu', '--disable-dev-shm-usage'],
  executablePath: await chromium.executablePath(),
  headless: 'shell',
});

async function sesion(usuario, clave, ancho = 1280) {
  // La sesión vive en sessionStorage (ámbito de pestaña): una pestaña nueva equivale a un navegador distinto.
  const page = await browser.newPage();
  await page.setViewport({ width: ancho, height: 900 });
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[name="identificador"]', usuario);
  await page.type('input[type="password"]', clave);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')]);
  return { page, errores };
}
const texto = (page) => page.evaluate(() => document.body.innerText);
const tarjetas = (page) => page.$$eval('main ul > li a[href^="/admin/historial/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), texto: a.innerText })));
async function esperarLista(page) {
  await page.waitForFunction(() => document.querySelectorAll('main ul > li a[href^="/admin/historial/"]').length > 0, { timeout: 15000 });
}

let hrefAjena = null;

// 1) Administrador global: panel -> lista -> filtro -> detalle -> volver
{
  const { page, errores } = await sesion('admin', process.env.ADMIN_SEED_PASSWORD);
  await page.waitForSelector('main a[href="/admin/historial"]', { timeout: 15000 });
  ok(/Historial de conversaciones/.test(await texto(page)), 'el panel muestra la tarjeta "Historial de conversaciones" activa');
  await page.click('main a[href="/admin/historial"]');
  await esperarLista(page);
  let lista = await tarjetas(page);
  ok(lista.length === 15, `la lista muestra 15 conversaciones por página (${lista.length})`);
  ok(lista.every((t) => /Resuelta|Escalada/.test(t.texto) && /mensaje/.test(t.texto)), 'cada tarjeta indica estado y cantidad de mensajes');
  const t = await texto(page);
  ok(!/NaN|undefined|\[object/.test(t), 'no hay valores rotos en la lista');
  ok(await page.$eval('header nav a[href="/admin/historial"]', (a) => a.getAttribute('aria-current') === 'page'), 'la barra de navegación marca "Historial" como activo');
  await page.screenshot({ path: 'capturas/q6-historial-lista.png', fullPage: true });

  // guardar una conversación de otra dependencia para la prueba de alcance
  const ajena = (await page.$$eval('main ul > li a', (as) => as.map((a) => ({ href: a.getAttribute('href'), texto: a.innerText })))).find((x) => /Admisiones/.test(x.texto));
  hrefAjena = ajena ? ajena.href : null;

  // filtro por dependencia
  const valorBienestar = await page.$$eval('select option', (o) => o.find((x) => x.textContent === 'Bienestar').value);
  await page.select('select', valorBienestar);
  await page.evaluate(() => [...document.querySelectorAll('form button')].find((b) => b.textContent === 'Aplicar').click());
  await page.waitForFunction(() => { const a = [...document.querySelectorAll('main ul > li a[href^="/admin/historial/"]')]; return a.length > 0 && a.every((x) => /Bienestar/.test(x.innerText)); }, { timeout: 15000 });
  ok(true, 'filtrar por Bienestar deja solo conversaciones de Bienestar');

  // detalle
  const primera = (await tarjetas(page))[0];
  await page.click(`main ul > li a[href="${primera.href}"]`);
  await page.waitForSelector('ol[aria-label="Mensajes de la conversación"]', { timeout: 15000 });
  const d = await texto(page);
  ok(/Consulta registrada|Consultas registradas/.test(d) && /Tiempo de respuesta/.test(d) && /Bienestar/.test(d), 'el detalle muestra la ficha de la consulta (dependencia, tema, tiempo, estado)');
  ok(await page.$$eval('ol[aria-label="Mensajes de la conversación"] > li', (l) => l.length) >= 2, 'el detalle muestra los mensajes de la conversación');
  ok(!/Continuar esta conversación/.test(d), 'el detalle es de solo lectura (sin "Continuar esta conversación")');
  ok(await page.$$eval('ol[aria-label="Mensajes de la conversación"] .sr-only', (s) => s.some((x) => x.textContent.startsWith('Usuario')) && !s.some((x) => x.textContent.startsWith('Tú'))), 'los mensajes se atribuyen a "Usuario", no al administrador ("Tú")');
  ok(!/NaN|undefined|\[object/.test(d), 'no hay valores rotos en el detalle');
  await page.screenshot({ path: 'capturas/q6-historial-detalle.png', fullPage: true });

  // volver
  await page.click('a[href="/admin/historial"]:not(header a)');
  await esperarLista(page);
  ok(page.url().endsWith('/admin/historial'), 'el enlace "Volver al historial" regresa a la lista');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);

  // 2) Desde Reportes: "Ver" lleva a la conversación de esa consulta
  await page.goto(`${FRONT}/admin/reportes`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr a', { timeout: 15000 });
  const destino = await page.$eval('tbody tr a', (a) => a.getAttribute('href'));
  await page.click('tbody tr a');
  await page.waitForSelector('ol[aria-label="Mensajes de la conversación"]', { timeout: 15000 });
  ok(page.url().endsWith(destino), `desde la tabla de Reportes, "Ver" abre la conversación (${destino})`);
}

// 3) Administrador de dependencia: solo la suya
{
  const { page, errores } = await sesion('admin_registro', process.env.ADMIN_SEED_PASSWORD);
  await page.goto(`${FRONT}/admin/historial`, { waitUntil: 'networkidle0' });
  await esperarLista(page);
  ok(!(await page.$('select')), 'el admin de dependencia no ve el filtro por dependencia');
  const lista = await tarjetas(page);
  ok(lista.length > 0 && lista.every((x) => /Registro y Control/.test(x.texto)), 'solo ve conversaciones de Registro y Control');
  await page.screenshot({ path: 'capturas/q6-historial-dependencia.png', fullPage: true });
  // El detalle avisa que solo se muestran los mensajes de su dependencia
  await page.click(`main ul > li a[href="${lista[0].href}"]`);
  await page.waitForSelector('ol[aria-label="Mensajes de la conversación"]', { timeout: 15000 });
  ok(/Se muestran únicamente los mensajes de las consultas dirigidas a tu dependencia/.test(await texto(page)), 'el detalle avisa al admin de dependencia que solo ve los mensajes de su dependencia');
  await page.goto(`${FRONT}/admin/historial`, { waitUntil: 'networkidle0' });
  await esperarLista(page);
  if (hrefAjena) {
    await page.goto(`${FRONT}${hrefAjena}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('fuera de tu alcance'), { timeout: 15000 });
    ok(!(await page.$('ol[aria-label="Mensajes de la conversación"]')), `una conversación de otra dependencia (${hrefAjena}) no se muestra y se explica`);
  } else {
    ok(false, 'no se encontró una conversación de Admisiones para probar el alcance');
  }
  ok(errores.length === 0, 'sin errores de consola (admin de dependencia)');
}

// 4) Móvil
{
  const { page } = await sesion('admin', process.env.ADMIN_SEED_PASSWORD, 390);
  await page.goto(`${FRONT}/admin/historial`, { waitUntil: 'networkidle0' });
  await esperarLista(page);
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'en móvil (390 px) la lista no se desborda horizontalmente');
  await page.screenshot({ path: 'capturas/q6-historial-movil.png', fullPage: false });
  const href = (await tarjetas(page))[0].href;
  await page.goto(`${FRONT}${href}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('ol[aria-label="Mensajes de la conversación"]', { timeout: 15000 });
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'en móvil (390 px) el detalle no se desborda horizontalmente');
}

// 5) Un usuario no entra
{
  const { page } = await sesion('usuario_demo', process.env.USER_SEED_PASSWORD);
  await page.goto(`${FRONT}/admin/historial`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));
  ok(page.url().endsWith('/chat'), `un usuario es devuelto al chat (${page.url()})`);
}
await browser.close();
