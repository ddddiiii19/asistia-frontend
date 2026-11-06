// Verificación en navegador real: el estudiante pregunta por sedes y carreras de TEINCO en el chat.
// Requiere el backend en :3000 con `npm run db:cargar-info-general` (AI_PROVIDER=simulador) y el front compilado en :3001.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const FRONT = 'http://localhost:3001';
const ok = (c, m) => { console.log(`${c ? 'OK ' : 'FALLA'} ${m}`); if (!c) process.exitCode = 1; };
const browser = await puppeteer.launch({
  args: [...chromium.args, '--no-sandbox', '--no-zygote', '--disable-gpu', '--disable-dev-shm-usage'],
  executablePath: await chromium.executablePath(),
  headless: 'shell',
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1000 });
const errores = [];
page.on('pageerror', (e) => errores.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });

await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle0' });
await page.type('input[name="identificador"]', 'usuario_demo');
await page.type('input[type="password"]', process.env.USER_SEED_PASSWORD);
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')]);
await page.waitForSelector('#mensaje', { timeout: 15000 });

const burbujas = () => page.$$eval('ol[aria-label="Conversación"] > li', (l) => l.map((x) => x.innerText));
async function preguntar(texto, esperar) {
  const antes = (await burbujas()).length;
  await page.type('#mensaje', texto);
  await page.click('form button[type="submit"]');
  await page.waitForFunction((n, re) => {
    const l = [...document.querySelectorAll('ol[aria-label="Conversación"] > li')];
    return l.length >= n + 2 && new RegExp(re).test(l[l.length - 1].innerText);
  }, { timeout: 20000 }, antes, esperar);
  const l = await burbujas();
  return l[l.length - 1];
}

// 1) Preguntas escritas por el estudiante
let r = await preguntar('¿Dónde están las sedes de TEINCO?', 'Avenida Caracas');
ok(/Avenida Calle 63 Nº 22-39/.test(r) && /Mosquera/.test(r), 'responde las sedes con sus direcciones (Bogotá y Mosquera)');
await page.screenshot({ path: 'capturas/q6-chat-sedes.png', fullPage: false });
r = await preguntar('¿Qué carreras ofrece TEINCO?', 'Mecatrónica');
ok(/Contaduría Pública/.test(r) && /Administración de Empresas/.test(r), 'responde las carreras de pregrado');
r = await preguntar('¿Cuál es el teléfono de TEINCO?', '601 743 32 00');
ok(/301 333 79 56/.test(r), 'responde el teléfono y el WhatsApp institucionales');
r = await preguntar('¿Tienen sede en Medellín?', '601 743 32 00');
ok(/comunicarte/.test(r) && !/Medellín/.test(r.split('\n').slice(1).join(' ')), 'lo que no sabe lo escala con el contacto, sin inventar una sede');
await page.screenshot({ path: 'capturas/q6-chat-escalamiento.png', fullPage: false });

// 2) Preguntas frecuentes del catálogo
const faq = await page.$$eval('aside li button', (b) => b.map((x) => x.innerText));
ok(faq.some((t) => /¿Dónde están las sedes de TEINCO\?/.test(t) && /Información general/.test(t)), 'las preguntas frecuentes incluyen las generales, con su dependencia');
const antes = (await burbujas()).length;
await page.evaluate(() => [...document.querySelectorAll('aside li button')].find((b) => /¿Cómo puedo comunicarme con TEINCO\?/.test(b.innerText)).click());
await page.waitForFunction((n) => document.querySelectorAll('ol[aria-label="Conversación"] > li').length >= n + 2, { timeout: 15000 }, antes);
const ultima = (await burbujas()).pop();
ok(/601 743 32 00/.test(ultima) && /campusvirtual\.teinco\.edu\.co/.test(ultima), 'una pregunta frecuente general muestra su respuesta');
ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
await browser.close();
