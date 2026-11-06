# Q6 — Cambios aplicados al front-end de AsistIA

Entrega: **Panel de reportes** e **historial administrativo de conversaciones**. Requiere el back-end de Q6 (`asistia-backend`, con `db/migracion-q6.sql` o `db:init`).

## Cambios
- Nueva ruta `/admin/reportes` y componente `components/reportes/PanelReportes.js`; cada fila de su tabla enlaza ("Ver") con la conversación.
- Nuevas rutas `/admin/historial` y `/admin/historial/[id]` (`components/historial/HistorialAdmin.js`, `ConversacionAdmin.js`): activan la tarjeta "Historial de conversaciones" del panel (RF-13). Solo lectura; el detalle atribuye los mensajes a "Usuario", no a "Tú".
- Componentes compartidos extraídos de Reportes: `FiltrosAdmin.js`, `Paginacion.js` y `reportes/Estado.js`. `Burbuja` admite `nombreUsuario`.
- `lib/api.js`: `reporteResumen` y `reporteInteracciones`. `lib/reportes.js`: formato de cifras, validación de periodo y CSV (neutraliza fórmulas).
- `components/ui.js`: nuevo `Selector`. `Encabezado.js`: enlace `exacto` para que "Panel" no quede activo en subrutas. `PanelAdmin.js`: tarjeta de reportes activa.
- Al cambiar filtros se conservan los datos previos (atenuados) en vez de borrar el panel.
- Prueba existente corregida: el mock de `useRouter` en `chat-historial-guardia.test.jsx` ahora es estable (antes devolvía un objeto nuevo por render y la prueba "fallo de red" fallaba).

## Ajustes posteriores a la revisión
- «Consultas resueltas» mantiene su nombre y aclara su criterio: «sin escalamiento a una persona».
- La gráfica por día avisa cuando se muestran solo los 90 días más recientes; la tabla de interacciones indica en pantallas pequeñas que se desplaza horizontalmente.
- El CSV también neutraliza fórmulas precedidas de espacios (incluido el espacio duro).
- El detalle del historial avisa al administrador de dependencia que solo ve los mensajes de su dependencia (el back-end aplica ese alcance).

## Verificación
Unitarias 81/81, integración 33/33 (backend con `LOGIN_LIMITE=100` y `npm run db:cargar-info-general`), `next build` correcto y 45 comprobaciones e2e en Chromium (16 de reportes, 22 de historial y 7 de información general: escritorio, administrador de dependencia, alcance, móvil 390 px, redirección de usuario y preguntas del estudiante sobre sedes y carreras). Capturas en `capturas/`.
