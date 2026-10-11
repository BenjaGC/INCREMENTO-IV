# Arquitectura y mantenimiento de la ticketera

La aplicación es un monolito modular cliente–servidor de tres capas. Node/Express sirve la interfaz y atiende HTTP; MySQL almacena los datos. No necesita React, Docker ni GitHub Pages para funcionar. GitHub distribuye el código; la ejecución necesita un servidor, MySQL y archivos persistentes.

## Dónde cambiar cada función

| Ubicación | Responsabilidad |
| --- | --- |
| `server.js` | Carga configuración y arranca la aplicación. |
| `src/server.js` | Operaciones originales de tickets, inventario, reportes, manuales y tareas SLA. |
| `src/access-control.js` | Verificación de sesión y permisos de rutas. |
| `src/domain.js`, `src/sla.js`, `src/reports.js` | Modelos y reglas compartidas. |
| `src/increment3.js` | Rutas de perfil, categorías, archivo histórico, encuestas y coordinación del III. |
| `src/increment3-schema.js`, `src/identity-schema.js` | Migraciones aditivas, tipos de usuarios e integridad de archivos históricos. |
| `src/increment3-jobs.js` | Archivado, evidencias, correo entrante y sincronización de directorio. |
| `src/increment4/index.js` | Rutas administrativas de seguridad y retención. |
| `src/increment4/login-security.js` | Inicio de sesión, contadores, bloqueo, alerta y desbloqueo. |
| `src/increment4/trace-retention.js` | Respaldo, verificación, retención y programación semestral. |
| `src/increment4/schema.js` | Tablas e índices del IV; mantiene las filas existentes. |
| `src/passwords.js`, `src/password-recovery.js` | Hash y recuperación de contraseñas. |
| `src/config/` | Conexiones MySQL y SMTP obtenidas desde `.env`. |
| `public/index.html` | Pantallas y formularios Alpine. |
| `public/js/app.js` | Flujos originales de la interfaz. |
| `public/js/ui.js` | Presentación, filtros, navegación, foco y composición de módulos. |
| `public/js/increment3.js`, `public/js/increment4.js` | Flujos de la interfaz de cada ampliación. |
| `public/css/` | Estilos originales, identidad común, utilidades y modo oscuro. |
| `scripts/` | Instalación, migración, respaldo y pruebas reproducibles. |

Los archivos de aplicación fueron formateados de manera uniforme para facilitar su lectura. Se retiraron los controladores antiguos de login y edición de perfil que ya estaban sustituidos por las rutas protegidas. No se cambiaron los nombres de estados ni la estructura de tickets para hacer esta limpieza.

## Diagnóstico y reglas de cambio

Antes de editar, hacer un respaldo y reproducir el problema con una cuenta de prueba. Revisar `/health/live` y `/health/ready`; consultar Registro de errores desde Administración para incidencias técnicas. No copiar `.env`, respaldos, registros de usuarios ni adjuntos privados a un repositorio público.

No cambiar una ruta sin localizar su llamada en `public/js/`. No quitar las comprobaciones de autorización del servidor aunque el botón esté oculto. No escribir sobre un ticket archivado ni calcular SLA nuevamente en el navegador con reglas distintas al servidor.

Las pruebas usan nombres `clinica_ui_test_<fecha>` y eliminan únicamente esas bases al terminar. Necesitan una cuenta de pruebas con permisos de creación de bases y un puerto 3200 libre. Ejecutarlas **una a la vez**, porque comparten ese puerto:

```powershell
npm run check
npm run test:install
npm run test:security
npm run test:regression
npm run test:increment4
npm run test:ui
npm audit
```

La cuenta MySQL usada en producción debe ser dedicada y limitada al esquema de la aplicación. Las migraciones pueden requerir una cuenta temporal con permisos adicionales; no conservar esa cuenta en el `.env` de ejecución.

## Revisión de rendimiento

Los datos de trazas se consultan por índices de fecha, y la lectura del respaldo se realiza por bloques de 500 filas. El archivo se comprime por streaming y se verifica por streaming; no carga todo el archivo de respaldo en memoria. Los identificadores de filas a eliminar permanecen en memoria hasta confirmar el commit. TI debe probar volumen y duración representativos antes de activar la limpieza sobre una base grande, y programar un horario de baja actividad.

Las listas administrativas de accesos e historial se limitan a 100 y 30 elementos respectivamente. El control de intentos usa claves hash, consultas parametrizadas y estados persistentes en MySQL.

El mantenimiento conserva locks mientras verifica y retira registros antiguos. Esa garantía prioriza no perder auditoría; no se promete una duración máxima sin medir el volumen real. Las pruebas funcionales locales no sustituyen la prueba de carga con concurrencia de la clínica.
