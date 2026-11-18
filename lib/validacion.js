// Reglas de contraseña idénticas a las del backend (validarNuevaContrasena en src/validar.js).
export function requisitosContrasena(valor) {
  const texto = typeof valor === 'string' ? valor : '';
  const bytes = new TextEncoder().encode(texto).length;
  return [
    { id: 'longitud', texto: 'Al menos 10 caracteres', cumple: texto.length >= 10 },
    { id: 'minuscula', texto: 'Una letra minúscula', cumple: /[a-z]/.test(texto) },
    { id: 'mayuscula', texto: 'Una letra mayúscula', cumple: /[A-Z]/.test(texto) },
    { id: 'numero', texto: 'Un número', cumple: /[0-9]/.test(texto) },
    { id: 'bytes', texto: 'No superar 72 bytes', cumple: bytes <= 72 },
  ];
}

export function contrasenaValida(valor) {
  return requisitosContrasena(valor).every((r) => r.cumple);
}

export function correoValido(valor) {
  const correo = typeof valor === 'string' ? valor.trim() : '';
  return correo.length > 0 && correo.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// Q8: contacto de una dependencia (mismas reglas que el backend, validarContactoDependencia).
// Los correos se escriben separados por coma, punto y coma o salto de línea.
export function dividirCorreos(valor) {
  const lista = String(valor || '').split(/[,;\n]+|\s+o\s+/i).map((c) => c.trim()).filter(Boolean);
  return lista.filter((c, i) => lista.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i);
}

// Devuelve el texto de error de los correos de contacto, o '' si son válidos (al menos uno y máximo cinco).
export function errorCorreosContacto(valor) {
  const correos = dividirCorreos(valor);
  if (correos.length === 0) return 'Ingresa al menos un correo de contacto.';
  if (correos.length > 5) return 'Ingresa máximo 5 correos de contacto.';
  if (!correos.every(correoValido)) return 'Revisa los correos: separa cada uno con una coma y verifica que sean válidos.';
  return '';
}

// El teléfono es opcional; si se escribe, debe traer al menos 7 dígitos (puede incluir varios números).
export function telefonoValido(valor) {
  const texto = String(valor || '').trim();
  if (texto === '') return true;
  return texto.length <= 100 && texto.replace(/\D/g, '').length >= 7 && /^[\p{L}\d\s+().,:·/-]+$/u.test(texto);
}
