# AsistIA — Front-end (Q5 + Q6)

Interfaz web del asistente conversacional con IA generativa para las divisiones de TEINCO. Corresponde a la entrega **Q5 (Front-end del asistente)**: interfaz responsiva conectada al back-end de Q4.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4. Consume la API REST Express de Q4 (`asistia-backend`).

> Los contenidos institucionales que se ven en la interfaz proceden del back-end y, en esta versión, son datos de prueba (`[DATO DE PRUEBA]`).

## Puesta en marcha

Requisitos: Node.js ≥ 20.9 y el back-end de Q4 en ejecución (`npm run db:init` y `npm start` en `asistia-backend`).

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm run dev                    # http://localhost:3001
```

El back-end usa el puerto 3000 y el front-end el 3001 (`next dev -p 3001`). En el `.env` del back-end deben coincidir `CORS_ORIGIN` y `FRONTEND_URL` con `http://localhost:3001` (es el valor por defecto de su `.env.example`). Para producción: `npm run build && npm start`.

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL base de la API (por defecto `http://localhost:3000`). El navegador la consulta directamente. |

## Pantallas

| Ruta | Quién | Descripción |
|---|---|---|
| `/login` | Público | Inicio de sesión compartido (usuario o correo + contraseña). El destino lo determina el tipo de cuenta que devuelve la API. |
| `/olvide-contrasena` | Público | Solicitud de enlace de recuperación; la respuesta es siempre genérica. |
| `/restablecer-contrasena?token=…` | Público | Nueva contraseña con el enlace recibido por correo. |
| `/chat` | Usuario | Chat con el asistente, dependencia sugerida, escalamiento y preguntas frecuentes. |
| `/historial`, `/historial/[id]` | Usuario | Historial propio; permite continuar una conversación. |
| `/admin` | Administrador | Inicio del panel: identidad y alcance; alta de cuentas de usuario (solo administrador global). Los módulos de gestión de información institucional y de preguntas frecuentes se integran después. |
| `/admin/reportes` | Administrador | **Q6:** indicadores (consultas, resueltas, escaladas, tiempo promedio), dependencias más consultadas, preguntas y temas frecuentes, consultas por día, tabla paginada y exportación a CSV. Filtros por dependencia (solo administrador global) y periodo. Cada fila enlaza con su conversación. |
| `/admin/historial`, `/admin/historial/[id]` | Administrador | **Q6:** historial administrativo (RF-13): lista paginada de las conversaciones de los usuarios con dependencia, estado y número de mensajes, con los mismos filtros que Reportes; el detalle muestra la ficha de la consulta (dependencia, tema, tiempo de respuesta, estado y motivo de escalamiento) y los mensajes. Es de solo lectura; el administrador de dependencia solo ve las conversaciones de su dependencia. No confundir con `/historial`, el historial propio del usuario. |

## Sesión y seguridad

- El JWT de acceso se guarda en `sessionStorage` (ámbito de pestaña) y se envía como `Authorization: Bearer`. Cada área protegida confirma el rol con `GET /api/auth/me`; el backend vuelve a verificar firma, vigencia y rol en cada petición.
- El **token de recuperación** solo vive en memoria del formulario: se retira de la URL al cargar y nunca se guarda en `localStorage`, `sessionStorage` ni cookies. La página se sirve con `Cache-Control: no-store` y `Referrer-Policy: no-referrer`.
- Si el backend invalida la sesión (expirada, alterada o revocada tras cambiar la contraseña), se cierra la sesión local y se avisa en el login.
- Cabeceras: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y una CSP limitada a `frame-ancestors`, `base-uri`, `form-action` y `object-src`.

## Pruebas

```bash
npm test                  # 81 pruebas unitarias y de componentes (Vitest + Testing Library)

# Integración con el back-end real (PostgreSQL, AI_PROVIDER=simulador). Reinicie el backend antes y arránquelo con
# LOGIN_LIMITE=100 (sus límites están en memoria y la suite inicia varias sesiones). Para ver datos en los reportes y las respuestas sobre TEINCO: npm run db:seed-reportes y npm run db:cargar-info-general en el backend.
set -a; . ../asistia-backend/.env; set +a
API_URL=http://localhost:3000 FRONTEND_ORIGIN=http://localhost:3001 npm run test:integracion   # 33 pruebas
```

`tests/e2e/e2e-reportes.mjs` (16 verificaciones), `tests/e2e/e2e-historial.mjs` (22) y `tests/e2e/e2e-info-general.mjs` (7: el estudiante pregunta por sedes, carreras y contacto en el chat) comprueban en el navegador los módulos de reportes e historial administrativo y las respuestas sobre TEINCO de Q6 (mismas dependencias; el segundo guarda capturas en `capturas/`). `tests/e2e/e2e.mjs` recorre los flujos en un navegador real (Chromium headless) y genera capturas; sus dependencias se indican en el encabezado del archivo.

## Limitaciones conocidas

- La prueba con la API real de OpenAI no se ha ejecutado (depende de la clave y del modelo del estudiante); las pruebas usan el simulador.
- Cerrar sesión elimina el token del navegador, pero el back-end no tiene endpoint de cierre: un JWT ya emitido sigue siendo válido hasta que vence (8 h por defecto) o se cambia la contraseña.
- `sessionStorage` es legible por JavaScript de la propia página; no se añadió una CSP de scripts completa.
- Las fechas del historial provienen de columnas `TIMESTAMP` sin zona horaria; pueden mostrarse desplazadas según la zona horaria del servidor.
- Las preguntas frecuentes no se guardan en el historial (el back-end solo incrementa su contador).

- Los reportes se consultan con el JWT del administrador; el filtro por dependencia solo se ofrece al administrador global y el backend decide siempre el alcance.
- La exportación a CSV pide hasta 500 registros (límite del backend) y usa `;` como separador, con BOM UTF-8, para abrirse bien en Excel en español.
