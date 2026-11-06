// Prueba de extremo a extremo en navegador real (Chromium headless). No forma parte de las dependencias del proyecto:
// npm install --no-save puppeteer-core @sparticuz/chromium pg jsonwebtoken
// Requiere: base reiniciada (npm run db:init en el backend), API en :3000 con AI_PROVIDER=simulador y el front compilado en :3001.
// Uso: mkdir -p capturas && node tests/e2e/e2e.mjs
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';

const env = Object.fromEntries(fs.readFileSync(process.env.BACKEND_ENV || '../asistia-backend/.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const FRONT = 'http://localhost:3001';
const CAP = process.env.CAPTURAS || './capturas';
let ok = 0; let fallos = 0;
const reporte = (cond, nombre, extra = '') => { if (cond) { ok++; console.log(`  ✓ ${nombre}`); } else { fallos++; console.log(`  ✗ ${nombre} ${extra}`); } };

const navegador = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
const page = await navegador.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
page.on('requestfailed', (r) => errores.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
await page.setViewport({ width: 1280, height: 800 });

const ruta = () => new URL(page.url()).pathname + new URL(page.url()).search;
const esperarRuta = (p) => page.waitForFunction((x) => location.pathname === x, { timeout: 15000 }, p);
const clickTexto = async (texto, selector = 'button, a') => {
  const h = await page.evaluateHandle((t, s) => [...document.querySelectorAll(s)].find((e) => e.textContent.trim().includes(t)), texto, selector);
  const el = h.asElement(); if (!el) throw new Error(`No se encontró «${texto}»`); await el.click();
};
const textoVisible = (t, ms = 15000) => page.waitForFunction((x) => document.body.innerText.toLowerCase().includes(x.toLowerCase()), { timeout: ms }, t);
const sinDesbordeHorizontal = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const foto = (n) => page.screenshot({ path: `${CAP}/${n}.png` });
const entrar = async (u, c) => {
  await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[name="identificador"]', u);
  await page.type('input[name="contrasena"]', c);
  await clickTexto('Ingresar', 'button');
};
const cerrarSesion = async () => { await page.waitForSelector('header button'); await clickTexto('Cerrar sesión', 'button'); await esperarRuta('/login'); };

console.log('A. Rutas protegidas sin sesión');
for (const p of ['/', '/chat', '/historial', '/historial/1', '/admin']) {
  await page.goto(FRONT + p, { waitUntil: 'networkidle0' });
  await esperarRuta('/login');
  reporte(ruta().startsWith('/login'), `${p} sin sesión → /login`);
}
await foto('01-login-escritorio');

console.log('B. Credenciales incorrectas');
await entrar('usuario_demo', 'ClaveIncorrecta1');
await textoVisible('incorrectos');
reporte((await page.$('[role="alert"]')) !== null, 'se muestra el error y se permanece en /login');
reporte(ruta() === '/login', 'no hay redirección');

console.log('C. Usuario: chat, FAQ, historial');
await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle0' });
await entrar('usuario_demo', env.USER_SEED_PASSWORD);
await esperarRuta('/chat');
await textoVisible('Hola, soy AsistIA');
reporte(true, 'login de usuario lleva a /chat');
const almacen = await page.evaluate(() => ({ ses: sessionStorage.getItem('asistia.sesion'), loc: localStorage.length, cookie: document.cookie }));
reporte(!!almacen.ses && almacen.loc === 0 && almacen.cookie === '', 'JWT solo en sessionStorage (localStorage y cookies vacíos)');
await page.type('textarea#mensaje', 'Quiero información sobre inscripción y admisión');
await page.keyboard.press('Enter');
await textoVisible('Dependencia sugerida');
reporte(true, 'respuesta con dependencia sugerida');
await foto('02-chat-respuesta-escritorio');
await page.type('textarea#mensaje', 'zzzz qqqq xxxx');
await page.keyboard.press('Enter');
await textoVisible('Escalamiento · caso registrado');
reporte(true, 'consulta sin respaldo se muestra como escalamiento');
await foto('03-chat-escalamiento-escritorio');
await clickTexto('Qué', 'aside button').catch(async () => { await page.click('aside ul button'); });
await textoVisible('Pregunta frecuente');
reporte(true, 'una pregunta frecuente muestra su respuesta en el chat');
reporte(await sinDesbordeHorizontal(), 'escritorio 1280 px sin desborde horizontal (chat)');
await clickTexto('Mi historial', 'nav a');
await esperarRuta('/historial');
await textoVisible('Mi historial');
await page.waitForSelector('main ul li a');
reporte(true, 'historial propio lista las conversaciones');
await foto('04-historial-escritorio');
await page.click('main ul li a');
await page.waitForFunction(() => /^\/historial\/\d+$/.test(location.pathname));
await textoVisible('Continuar esta conversación');
await foto('05-detalle-historial-escritorio');
await clickTexto('Continuar esta conversación', 'a');
await esperarRuta('/chat');
await page.waitForFunction(() => document.querySelectorAll('[role="log"] li').length >= 2);
reporte(true, 'continuar una conversación desde el historial recupera sus mensajes');
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => location.pathname === '/chat');
await textoVisible('Escalamiento').catch(() => {});
reporte(ruta().startsWith('/chat'), 'la sesión sobrevive a recargar la pestaña');

console.log('E. Un usuario no accede al panel administrativo');
await page.goto(`${FRONT}/admin`, { waitUntil: 'networkidle0' });
await esperarRuta('/chat');
reporte(ruta().startsWith('/chat'), '/admin con cuenta de usuario → /chat');
reporte(!(await page.evaluate(() => document.body.innerText.includes('Panel administrativo'))), 'no se muestra contenido del panel');
await cerrarSesion();
await page.goto(`${FRONT}/chat`, { waitUntil: 'networkidle0' });
await esperarRuta('/login');
reporte(true, 'tras cerrar sesión, /chat vuelve a pedir inicio de sesión');

console.log('D. Administrador');
await entrar('admin', env.ADMIN_SEED_PASSWORD);
await esperarRuta('/admin');
await textoVisible('Panel administrativo');
reporte(true, 'login de administrador lleva a /admin');
await textoVisible('Global');
await page.goto(`${FRONT}/chat`, { waitUntil: 'networkidle0' });
await esperarRuta('/admin');
reporte(ruta() === '/admin', '/chat con cuenta de administrador → /admin');
await foto('06-panel-admin-escritorio');
await page.type('input[name="nombre_usuario"]', 'e2e_usuario');
await page.type('input[name="correo"]', 'e2e_usuario@ejemplo.invalid');
await page.type('input[name="contrasena"]', 'ClaveE2E2026x');
await clickTexto('Crear cuenta', 'button');
await textoVisible('creada');
reporte(true, 'el administrador global crea una cuenta de usuario');
reporte(!(await page.evaluate(() => document.body.innerText.includes('ClaveE2E2026x'))), 'la contraseña no se muestra');
await cerrarSesion();
await entrar('admin_registro', env.ADMIN_SEED_PASSWORD);
await esperarRuta('/admin');
await textoVisible('solo consulta');
reporte(!(await page.evaluate(() => document.body.innerText.includes('Crear cuenta de usuario'))), 'el administrador de dependencia no ve el formulario de alta');
await cerrarSesion();

console.log('G. Sesión inválida o manipulada');
await entrar('usuario_demo', env.USER_SEED_PASSWORD);
await esperarRuta('/chat');
await page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('asistia.sesion')); s.token = s.token.slice(0, -3) + 'abc'; sessionStorage.setItem('asistia.sesion', JSON.stringify(s)); });
await page.goto(`${FRONT}/chat`, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => location.pathname === '/login' && location.search.includes('expirada'));
await textoVisible('Tu sesión expiró');
reporte(true, 'token alterado → cierre de sesión y aviso de sesión expirada');

console.log('F. Recuperación de contraseña');
await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle0' });
await clickTexto('¿Olvidaste tu contraseña?', 'a');
await esperarRuta('/olvide-contrasena');
await page.type('input[name="correo"]', 'e2e_usuario@ejemplo.invalid');
await clickTexto('Enviar enlace', 'button');
await textoVisible('Si existe una cuenta asociada');
const msg1 = await page.evaluate(() => document.querySelector('[role="status"]').innerText);
await foto('07-olvide-contrasena-escritorio');
await page.reload({ waitUntil: 'networkidle0' });
await page.type('input[name="correo"]', 'no_existe@ejemplo.invalid');
await clickTexto('Enviar enlace', 'button');
await textoVisible('Si existe una cuenta asociada');
const msg2 = await page.evaluate(() => document.querySelector('[role="status"]').innerText);
reporte(msg1 === msg2, 'mensaje idéntico para correo existente e inexistente');
// Enlace de recuperación: se registra el jti como lo haría el backend al enviar el correo.
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const { rows } = await pool.query("SELECT id_usuario FROM cuenta_usuario WHERE nombre_usuario = 'e2e_usuario'");
const idCuenta = rows[0].id_usuario;
const jti = crypto.randomUUID();
await pool.query("INSERT INTO token_recuperacion_contrasena (tipo_cuenta, id_cuenta, jti_hash, expira_en) VALUES ('usuario', $1, $2, NOW() + interval '15 minutes')", [idCuenta, crypto.createHash('sha256').update(jti).digest('hex')]);
const token = jwt.sign({ tipo_cuenta: 'usuario', proposito: 'restablecer_contrasena', jti }, env.JWT_RESET_SECRET, { algorithm: 'HS256', subject: String(idCuenta), expiresIn: '15m' });
const enlace = `${FRONT}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
const respEnlace = await page.goto(enlace, { waitUntil: 'networkidle0' });
reporte((respEnlace.headers()['cache-control'] || '').includes('no-store'), 'la página de restablecimiento responde con Cache-Control: no-store');
reporte(respEnlace.headers()['referrer-policy'] === 'no-referrer', 'Referrer-Policy: no-referrer');
await textoVisible('Restablecer contraseña');
reporte(!page.url().includes('token='), 'el token se retira de la URL al cargar');
const guardado = await page.evaluate((t) => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie, token);
reporte(!guardado.includes(token.slice(0, 20)), 'el token no está en localStorage, sessionStorage ni cookies');
await page.type('input[name="nueva_contrasena"]', 'corta');
await page.type('input[name="confirmacion"]', 'corta');
await clickTexto('Guardar contraseña', 'button');
await textoVisible('no cumple todos los requisitos');
reporte(true, 'contraseña débil rechazada en el formulario');
for (const n of ['nueva_contrasena', 'confirmacion']) { await page.focus(`input[name="${n}"]`); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); }
await page.type('input[name="nueva_contrasena"]', 'RecuperadaE2E2026');
await page.type('input[name="confirmacion"]', 'RecuperadaE2E2026');
await foto('08-restablecer-escritorio');
await clickTexto('Guardar contraseña', 'button');
await page.waitForFunction(() => location.pathname === '/login' && location.search.includes('reset'));
await textoVisible('Contraseña actualizada');
reporte(true, 'contraseña restablecida y regreso al login con aviso');
await entrar('e2e_usuario', 'RecuperadaE2E2026');
await esperarRuta('/chat');
reporte(true, 'inicio de sesión con la contraseña nueva');
await cerrarSesion();
await page.goto(enlace, { waitUntil: 'networkidle0' });
await page.type('input[name="nueva_contrasena"]', 'OtraVezE2E2026x');
await page.type('input[name="confirmacion"]', 'OtraVezE2E2026x');
await clickTexto('Guardar contraseña', 'button');
await textoVisible('Enlace no válido');
reporte(true, 'reutilizar el enlace muestra «Enlace no válido» y ofrece solicitar uno nuevo');
await foto('09-enlace-no-valido-escritorio');
await page.goto(`${FRONT}/restablecer-contrasena`, { waitUntil: 'networkidle0' });
await textoVisible('Enlace no válido');
reporte(true, 'sin token en la URL también se informa enlace no válido');
await pool.end();

console.log('H. Diseño adaptable (375, 768 y 1280 px) sin desborde horizontal');
await entrar('usuario_demo', env.USER_SEED_PASSWORD);
await esperarRuta('/chat');
for (const [ancho, alto, etiqueta] of [[375, 812, 'movil'], [768, 1024, 'tableta'], [1280, 800, 'escritorio']]) {
  await page.setViewport({ width: ancho, height: alto, deviceScaleFactor: 1, isMobile: ancho < 500, hasTouch: ancho < 500 });
  for (const p of ['/chat', '/historial']) {
    await page.goto(FRONT + p, { waitUntil: 'networkidle0' });
    await page.waitForFunction((x) => location.pathname === x, {}, p);
    await new Promise((r) => setTimeout(r, 400));
    reporte(await sinDesbordeHorizontal(), `${etiqueta} ${ancho} px · ${p} sin desborde horizontal`);
    if (etiqueta === 'movil') await foto(p === '/chat' ? '10-chat-movil' : '11-historial-movil');
  }
}
await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
await page.goto(`${FRONT}/chat`, { waitUntil: 'networkidle0' });
await page.type('textarea#mensaje', 'Quiero información sobre inscripción y admisión');
await page.keyboard.press('Enter');
await textoVisible('Dependencia sugerida');
await new Promise((r) => setTimeout(r, 300));
await foto('12-chat-respuesta-movil');
reporte(await sinDesbordeHorizontal(), 'móvil con conversación sin desborde horizontal');
await cerrarSesion();
for (const [ancho, alto, etiqueta] of [[375, 812, 'movil'], [1280, 800, 'escritorio']]) {
  await page.setViewport({ width: ancho, height: alto, isMobile: ancho < 500 });
  for (const p of ['/login', '/olvide-contrasena']) {
    await page.goto(FRONT + p, { waitUntil: 'networkidle0' });
    reporte(await sinDesbordeHorizontal(), `${etiqueta} ${ancho} px · ${p} sin desborde horizontal`);
  }
}
await page.setViewport({ width: 375, height: 812, isMobile: true });
await page.goto(`${FRONT}/login`, { waitUntil: 'networkidle0' });
await foto('13-login-movil');
await entrar('admin', env.ADMIN_SEED_PASSWORD);
await esperarRuta('/admin');
await textoVisible('Panel administrativo');
reporte(await sinDesbordeHorizontal(), 'móvil 375 px · /admin sin desborde horizontal');
await foto('14-panel-admin-movil');

console.log('\nErrores de consola/red durante la sesión:', errores.length);
errores.slice(0, 10).forEach((e) => console.log('  -', e));
console.log(`\nRESULTADO: ${ok} verificaciones correctas, ${fallos} fallidas`);
await navegador.close();
process.exit(fallos ? 1 : 0);
