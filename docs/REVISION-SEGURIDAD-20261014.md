# Revisión del informe del compañero y correcciones

Fecha: 14 de octubre de 2026. La revisión recibida era estática y señalaba tanto problemas confirmados como riesgos por verificar. Se revisaron los handlers y se ejecutaron pruebas en bases, cuentas y archivos temporales. No se atacó la instalación operativa de la clínica.

## Respuesta a las observaciones

| Punto recibido | Cambio o comprobación |
| --- | --- |
| 1. Desarrollo como valor inicial | `.env.example` utiliza producción. Sin NODE_ENV el arranque también elige producción. Se rechazan modos desconocidos, configuraciones incompletas y escucha fuera de loopback. Practicar localmente requiere elegir development de forma explícita. |
| 2. Proxy y bloqueo compartido | Se reemplaza la confianza por cantidad de saltos por `CLINICA_TRUSTED_PROXIES`, direcciones o redes específicas verificadas al arrancar. Se rechazan confianza global y TRUST_PROXY_HOPS. Cinco errores bloquean la combinación de cuenta y origen; otra cuenta de la misma red mantiene acceso. Hay una espera progresiva breve por cuenta entre distintos orígenes, hasta 15 segundos. |
| 3. Tokens en claro | La base solo guarda SHA-256 del token en session_token_hash. La columna anterior se vacía y se revocan sesiones antiguas. En el navegador se usa cookie HttpOnly, SameSite=Strict y Secure en producción. El login del navegador no devuelve el token en JSON y localStorage solo conserva datos de presentación sin token. |
| 4. Permisos /api/v3 y /api/v4 | Se comprobó la verificación de rol de los handlers, incluidos módulos registrados por otros archivos. Se añadió una política central: operaciones no incluidas expresamente como propias/de soporte exigen administrador. /api/v4 exige administrador; los helpers conservan sus controles de ticket y estado. |
| 5. Identificador de ticket | Las cuatro rutas GET actuales reciben el código por URL, no por query. Se corrigió además la precedencia que permitía sustituir en middleware ese código mediante un cuerpo GET. Ahora se autoriza solo el código de la ruta y se rechazan rutas sin identificador. |
| 6. Contraseñas heredadas | El autenticador solo acepta bcrypt. La migración convierte contraseñas antiguas antes de habilitar el servicio, sin exponerlas. Las vacías, demasiado cortas o superiores a 72 bytes requieren recuperación autorizada. No hay comparación de contraseña contra texto plano en el login. |
| 7. Recuperación | Código protegido por HMAC, vencimiento, intentos y límites de reemisión persisten en MySQL con transacciones. Reemitir no reinicia los cinco intentos; máximo tres envíos cada 15 minutos por cuenta y un minuto entre envíos. La respuesta pública no distingue si existe el usuario. |
| 8. unsafe-eval | Se eliminó de script-src. Las expresiones del HTML del repositorio se precompilan en un archivo JavaScript local mediante build:csp y se instalan evaluadores de funciones conocidas. Una expresión desconocida no se compila ni evalúa en ejecución. Se conservó la biblioteca Alpine y las funciones de la página. |
| 9. Enlaces de comentarios | La lectura utiliza una política común de sanitización y agrega rel="noopener noreferrer". Se verificó el contenido devuelto por la aplicación. No implica que un enlace HTTP externo sea confiable; no se declara un filtro universal de phishing. |
| 10. Datos dentro de public | Producción exige CLINICA_DATA_DIR absoluto fuera de public, además de un destino privado de respaldos. También se valida el destino explícito de trazas. Los archivos siguen exigiendo sesión y alcance autorizado. TI no debe publicar el directorio de datos con un servidor estático. |
| 11. PDF | Se confirmó que la ruta ya ejecutaba fileSafety.validate antes de aceptar el PDF. Se agregaron nombres aleatorios, se conserva el nombre visible y las descargas de manuales llevan sandbox y nosniff. La firma básica no descarta PDFs políglotas ni malware; esa inspección requiere controles adicionales de TI. |
| 12. Enumeración y WebSocket | El error de registro duplicado es genérico si TI habilita el registro en producción. El registro está cerrado por defecto. WebSocket calcula el cliente con la misma confianza explícita de proxy, admite cookie solo con Origin válido y revalida sesión administrativa. Los clientes no navegadores pueden usar token; ausencia de Origin no omite autenticación. |

## Sesión del navegador y clientes API

Las escrituras por cookie requieren `X-Clinica-Request: 1` y un origen permitido. Se rechazan peticiones cross-site/same-site discordantes. La cabecera propia no puede enviarse desde un formulario externo y el servidor no habilita CORS para terceros. Cookie sola no concede una mutación.

Clientes API autorizados pueden usar bearer emitido por login; la base compara su hash y exige la misma sesión, caducidad y permisos. Origin puede estar ausente en esos clientes. Sigue existiendo una sesión por usuario, con vencimiento fijo de ocho horas. HttpOnly reduce el robo del token; no elimina todas las acciones posibles de un XSS sobre una sesión abierta.

## Actualización de una instalación existente

1. Respaldar SQL y archivos y comprobar una copia antes de actualizar.
2. Ejecutar npm ci y las migraciones con una cuenta autorizada.
3. Eliminar TRUST_PROXY_HOPS de .env; definir las direcciones de CLINICA_TRUSTED_PROXIES y comprobar que el proxy sobrescribe los encabezados.
4. En producción, completar CLINICA_DATA_DIR, destinos privados, HTTPS y CLINICA_RECOVERY_SECRET aleatorio de al menos 32 caracteres. Conservar ese secreto entre reinicios y no subirlo a GitHub.
   Si la versión anterior guardaba archivos en public/uploads y public/manuales, recuperar o copiar ambas carpetas al directorio privado y comprobar adjuntos antiguos. No publicar sus carpetas anteriores mediante un proxy estático ni eliminarlas antes de verificar el respaldo y la copia.
5. Iniciar una sola instancia y comprobar /health/ready, login, un ticket y descargas.
6. Los usuarios vuelven a ingresar porque se revocan los tokens antiguos. Los bloqueos anteriores se convierten al origen documentado en su último evento; se conservan los eventos de auditoría.

La migración es aditiva. No elimina tickets, comentarios, inventario ni usuarios. No debe ejecutarse db:init sobre una base existente.

## Verificación

Las siete suites terminaron correctamente, con 32 casos adversariales más la medición de carga y la comparación de datos. La instalación del paquete exportado con cuenta MySQL dedicada y servidor normal también pasó. npm audit del 14 de octubre no informó vulnerabilidades conocidas. Se comprobó que el token no aparece en localStorage, que la cookie es HttpOnly y que la cabecera CSP no autoriza unsafe-eval.

Los resultados actuales están en [RESULTADOS-VERIFICACION-20261014.json](RESULTADOS-VERIFICACION-20261014.json), [RESULTADOS-SEGURIDAD-20261014.json](RESULTADOS-SEGURIDAD-20261014.json) y [RESULTADOS-PAQUETE-20261014.json](RESULTADOS-PAQUETE-20261014.json).

Se comprueban migración heredada, token filtrado desde una base que no concede sesión, cookie y CSRF, restricciones de producción y proxy, recuperación entre instancias y reemisión, permisos de rutas versionadas y GET con identificadores mezclados. Se repiten los recorridos de interfaz a 1440 y 390 px, PDF/Excel/CSV, estados, comentarios, inventario, importaciones y los incrementos III/IV. Las cuatro tablas de datos originales observadas por el ensayo adversarial se comparan antes y después mediante SHA-256; solo se eliminan los esquemas temporales propios.

La recuperación ya no depende de memoria, pero algunos límites HTTP y el programador siguen siendo locales al proceso: no se declara verificado el sistema completo con múltiples instancias. Mantener una sola hasta que TI ensaye la topología elegida. Las pruebas son locales, con correo/LDAP/IMER controlados; no certifican recepción institucional, resistencia DDoS, ausencia total de vulnerabilidades ni ISO/IEC 25010.

## Mantenimiento de la interfaz

Después de editar directivas Alpine de public/index.html:

```powershell
npm run build:csp
npm run check
npm run test:ui
```

Distribuir juntos el HTML y public/js/csp-expressions.js generado. No volver a habilitar unsafe-eval para ocultar una expresión faltante. Esta adaptación usa las APIs de la versión Alpine local; al actualizar la biblioteca, repetir el recorrido completo.

Referencias de contraste: [documentación CSP de Alpine](https://alpinejs.dev/advanced/csp), [extensión de Alpine](https://alpinejs.dev/advanced/extending), [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html). No sustituyen la prueba del servidor ni la aceptación de TI.
