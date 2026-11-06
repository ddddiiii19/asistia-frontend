// Pantalla de inicio según el tipo de cuenta que informa el backend.
export function rutaInicio(tipo) {
  return tipo === 'administrador' ? '/admin' : '/chat';
}
