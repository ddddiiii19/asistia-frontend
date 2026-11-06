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
