// Gestión de la sesión en el navegador.
// El JWT de acceso se guarda en sessionStorage (ámbito de pestaña: se borra al cerrarla). Nunca se
// guarda el token de recuperación de contraseña: ese token solo vive en memoria del formulario.
const CLAVE_SESION = 'asistia.sesion';
const CLAVE_ID_SESION = 'asistia.id_sesion';
const TIPOS = ['usuario', 'administrador'];

let respaldoMemoria = null; // se usa solo si sessionStorage no está disponible

function almacen() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function guardarSesion({ token, cuenta }) {
  const datos = { token, cuenta };
  const a = almacen();
  if (a) {
    try {
      a.setItem(CLAVE_SESION, JSON.stringify(datos));
      respaldoMemoria = null;
      return;
    } catch { /* se usa el respaldo en memoria */ }
  }
  respaldoMemoria = datos;
}

export function leerSesion() {
  const a = almacen();
  let datos = respaldoMemoria;
  if (a) {
    try {
      const crudo = a.getItem(CLAVE_SESION);
      if (crudo) datos = JSON.parse(crudo);
    } catch {
      datos = respaldoMemoria;
    }
  }
  if (!datos || typeof datos.token !== 'string' || !datos.token) return null;
  if (!datos.cuenta || !TIPOS.includes(datos.cuenta.tipo)) return null;
  return datos;
}

export function obtenerToken() {
  const s = leerSesion();
  return s ? s.token : null;
}

export function limpiarSesion() {
  respaldoMemoria = null;
  const a = almacen();
  if (a) {
    try {
      a.removeItem(CLAVE_SESION);
      a.removeItem(CLAVE_ID_SESION);
    } catch { /* sin acción */ }
  }
}

function generarIdSesion() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const aleatorio = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  return `s-${aleatorio}`;
}

// id_sesion identifica la sesión de chat ante la API (16 a 64 caracteres: letras, números, "-" y "_").
// No sustituye la autorización: el backend asocia cada conversación a la cuenta autenticada.
export function obtenerIdSesion() {
  const a = almacen();
  if (a) {
    try {
      const existente = a.getItem(CLAVE_ID_SESION);
      if (existente) return existente;
      const nuevo = generarIdSesion();
      a.setItem(CLAVE_ID_SESION, nuevo);
      return nuevo;
    } catch { /* continúa con un valor efímero */ }
  }
  return generarIdSesion();
}

export function reiniciarIdSesion() {
  const a = almacen();
  if (a) {
    try { a.removeItem(CLAVE_ID_SESION); } catch { /* sin acción */ }
  }
  return obtenerIdSesion();
}
