// Cliente de la API REST de AsistIA (back-end de Q4).
// El rol y los permisos los decide siempre el backend; este cliente solo envía el JWT de acceso
// como Bearer y traduce las respuestas de error a un objeto uniforme (ApiError).
import { obtenerToken } from './sesion';

export class ApiError extends Error {
  constructor(estado, codigo, mensaje) {
    super(mensaje);
    this.name = 'ApiError';
    this.estado = estado;
    this.codigo = codigo;
  }
}

// Códigos con los que el backend indica que el JWT de acceso ya no sirve.
const CODIGOS_SESION_INVALIDA = new Set(['no_autenticado', 'token_invalido', 'sesion_revocada']);

// Arma la cadena de consulta omitiendo los filtros vacíos (los nombres coinciden con los del backend).
function cadenaConsulta(filtros = {}) {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') q.set(clave, String(valor));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}

export function crearCliente({
  baseUrl,
  obtenerToken: leerToken = () => null,
  alSesionInvalida = () => {},
  fetchImpl,
  // El backend puede tardar hasta dos llamadas al servicio de IA (clasificar y generar).
  tiempoMaximoMs = 70000,
} = {}) {
  const base = String(baseUrl || '').replace(/\/$/, '');

  async function solicitar(ruta, { metodo = 'GET', cuerpo, autenticado = true } = {}) {
    const cabeceras = { Accept: 'application/json' };
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    if (autenticado) {
      const token = leerToken();
      if (token) cabeceras.Authorization = `Bearer ${token}`;
    }

    let respuesta;
    try {
      respuesta = await (fetchImpl || fetch)(`${base}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
        cache: 'no-store',
        signal: AbortSignal.timeout(tiempoMaximoMs),
      });
    } catch (e) {
      if (e && e.name === 'TimeoutError') {
        throw new ApiError(0, 'tiempo_agotado', 'El servicio tardó demasiado en responder.');
      }
      throw new ApiError(0, 'sin_conexion', 'No fue posible conectar con el servicio.');
    }

    let datos = null;
    if (respuesta.status !== 204) {
      try { datos = await respuesta.json(); } catch { datos = null; }
    }
    if (!respuesta.ok) {
      const codigo = (datos && datos.error) || 'error_desconocido';
      const mensaje = (datos && datos.mensaje) || 'Ocurrió un error inesperado.';
      if (autenticado && respuesta.status === 401 && CODIGOS_SESION_INVALIDA.has(codigo)) alSesionInvalida();
      throw new ApiError(respuesta.status, codigo, mensaje);
    }
    return datos;
  }

  return {
    // Acceso (RF-18)
    login: (identificador, contrasena) =>
      solicitar('/api/auth/login', { metodo: 'POST', cuerpo: { identificador, contrasena }, autenticado: false }),
    me: () => solicitar('/api/auth/me'),
    // Recuperación (RF-20, RF-21)
    olvideContrasena: (correo) =>
      solicitar('/api/auth/forgot-password', { metodo: 'POST', cuerpo: { correo }, autenticado: false }),
    restablecerContrasena: (token, nuevaContrasena) =>
      solicitar('/api/auth/reset-password', {
        metodo: 'POST', cuerpo: { token, nueva_contrasena: nuevaContrasena }, autenticado: false,
      }),
    // Asistente (RF-01 a RF-10)
    chat: ({ idSesion, mensaje, idConversacion }) => {
      const cuerpo = { id_sesion: idSesion, mensaje };
      if (idConversacion) cuerpo.id_conversacion = idConversacion;
      return solicitar('/api/chat', { metodo: 'POST', cuerpo });
    },
    conversaciones: () => solicitar('/api/conversaciones'),
    conversacion: (id) => solicitar(`/api/conversaciones/${encodeURIComponent(id)}`),
    preguntasFrecuentes: () => solicitar('/api/faq'),
    consultarPregunta: (id) => solicitar(`/api/faq/${encodeURIComponent(id)}/consulta`, { metodo: 'POST' }),
    dependencias: () => solicitar('/api/dependencias', { autenticado: false }),
    // Reportes (Q6; administrador global o de dependencia, con el alcance que decide el backend).
    // Filtros: { dependencia, desde, hasta } en formato AAAA-MM-DD; la lista admite además { limite, desplazamiento }.
    reporteResumen: (filtros) => solicitar(`/api/admin/reportes/resumen${cadenaConsulta(filtros)}`),
    reporteInteracciones: (filtros) => solicitar(`/api/admin/reportes/interacciones${cadenaConsulta(filtros)}`),
    // Historial administrativo de conversaciones (RF-13; Q6 lo muestra en el panel). Mismos filtros que los reportes.
    adminConversaciones: (filtros) => solicitar(`/api/admin/conversaciones${cadenaConsulta(filtros)}`),
    adminConversacion: (id) => solicitar(`/api/admin/conversaciones/${encodeURIComponent(id)}`),
    // Contenido que usa el asistente (RF-12 información institucional, RF-14 preguntas frecuentes). Consultar, crear, editar
    // y eliminar: el administrador global en cualquier dependencia y el de dependencia solo en la suya (Q8; lo decide el backend).
    adminInformacion: (filtros) => solicitar(`/api/admin/informacion${cadenaConsulta(filtros)}`),
    crearInformacion: (datos) => solicitar('/api/admin/informacion', { metodo: 'POST', cuerpo: datos }),
    editarInformacion: (id, datos) => solicitar(`/api/admin/informacion/${encodeURIComponent(id)}`, { metodo: 'PUT', cuerpo: datos }),
    eliminarInformacion: (id) => solicitar(`/api/admin/informacion/${encodeURIComponent(id)}`, { metodo: 'DELETE' }),
    adminFaq: (filtros) => solicitar(`/api/admin/faq${cadenaConsulta(filtros)}`),
    crearFaq: (datos) => solicitar('/api/admin/faq', { metodo: 'POST', cuerpo: datos }),
    editarFaq: (id, datos) => solicitar(`/api/admin/faq/${encodeURIComponent(id)}`, { metodo: 'PUT', cuerpo: datos }),
    eliminarFaq: (id) => solicitar(`/api/admin/faq/${encodeURIComponent(id)}`, { metodo: 'DELETE' }),
    // Q8: dependencias del panel (con descripción, contacto y cuántos textos y preguntas tienen) y su edición
    // (descripción y contacto: correos y teléfono). El global ve todas; el de dependencia, la suya.
    adminDependencias: () => solicitar('/api/admin/dependencias'),
    editarDependencia: (id, datos) => solicitar(`/api/admin/dependencias/${encodeURIComponent(id)}`, { metodo: 'PUT', cuerpo: datos }),
    // Administración (solo administrador global en el backend)
    // Q8: cuenta de administrador de una dependencia NUEVA: se escribe su nombre y el backend crea la dependencia (con su
    // descripción y contacto) y la cuenta en una sola operación. Con `idDependencia` (forma de Q7) se usa una existente.
    crearAdministradorDependencia: ({ nombreUsuario, correo, contrasena, idDependencia, nombreDependencia, descripcion, correos, telefono }) => {
      const cuerpo = { nombre_usuario: nombreUsuario, correo, contrasena };
      if (idDependencia) cuerpo.id_dependencia = idDependencia;
      else Object.assign(cuerpo, { nombre_dependencia: nombreDependencia, descripcion, correos, telefono });
      return solicitar('/api/admin/cuentas/administradores-dependencia', { metodo: 'POST', cuerpo });
    },
    crearCuentaUsuario: ({ nombreUsuario, correo, contrasena }) =>
      solicitar('/api/admin/cuentas/usuarios', {
        metodo: 'POST', cuerpo: { nombre_usuario: nombreUsuario, correo, contrasena },
      }),
  };
}

// Instancia de la aplicación. El AuthProvider registra qué hacer cuando el backend invalida la sesión.
let manejadorSesionInvalida = null;
export function registrarAlSesionInvalida(fn) {
  manejadorSesionInvalida = fn;
  return () => { if (manejadorSesionInvalida === fn) manejadorSesionInvalida = null; };
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = crearCliente({
  baseUrl: API_URL,
  obtenerToken,
  alSesionInvalida: () => { if (manejadorSesionInvalida) manejadorSesionInvalida(); },
});
