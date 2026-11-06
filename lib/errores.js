// Traduce errores de la API a mensajes comprensibles para la persona usuaria.
export function mensajeError(err) {
  if (!err || err.name !== 'ApiError') return 'Ocurrió un error inesperado. Intenta nuevamente.';
  switch (err.codigo) {
    case 'sin_conexion':
      return 'No fue posible conectar con el servicio. Revisa tu conexión e intenta nuevamente.';
    case 'tiempo_agotado':
      return 'El servicio tardó demasiado en responder. Intenta nuevamente.';
    case 'servicio_ia_no_disponible':
      // El backend no registra nada cuando el servicio de IA falla (decisión D-20 de la guía).
      return 'El asistente no está disponible en este momento. Tu mensaje no fue registrado; intenta nuevamente más tarde.';
    case 'rol_insuficiente':
      return 'Tu cuenta no tiene permiso para realizar esta acción.';
    case 'permiso_denegado':
      return 'Esta acción solo la puede realizar el administrador global.';
    default:
      // Los demás códigos del backend (credenciales, límites de intentos, validaciones) traen un
      // mensaje en español redactado para mostrarse a la persona usuaria.
      return err.message || 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}
