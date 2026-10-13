# Revisión de seguridad y preparación de entrega

Fecha: 12 de octubre de 2026. Aplicación: Ticketera Clínica Aconcagua, Incremento IV.

Se revisó el código y se ejecutaron pruebas autorizadas sobre `127.0.0.1`, con bases MySQL temporales, cuentas de prueba y correo capturado por un transporte de pruebas. La revisión no atacó infraestructura ajena ni utilizó tickets de la clínica para los ensayos. No es una certificación, una garantía de ausencia de fallos ni una aceptación de producción institucional.

## Problemas reproducidos y correcciones

| Hallazgo | Efecto y corrección |
| --- | --- |
| Consultas con estructuras inesperadas | Una consulta de búsqueda malformada provocaba una excepción asíncrona que detenía Node. Se verificó la caída en una copia aislada. Ahora se validan tipos, estructura y longitud, se captura el rechazo asíncrono y se responde de forma controlada; la salud del servicio sigue disponible. |
| Cierre de sesión incompleto | Un cuerpo sin ciertos campos podía recibir éxito sin invalidar el token. Ahora se revoca la sesión autenticada por el servidor, sin confiar en una identidad enviada en el formulario. El token revocado recibe 401 al reutilizarse. |
| Cargas rechazadas | Una carga hacia un ticket inexistente o sin autorización podía dejar un archivo sin referencia. Se retiran esas cargas rechazadas; se conserva un archivo si ya tiene una referencia persistida. |
| Límites y formatos de archivo | Se acotan archivos, campos y partes multipart; se valida la firma básica de PDF e imágenes. Un falso PDF se rechaza. Los otros tipos de evidencia se fuerzan a descarga binaria con cabeceras restrictivas. |
| Expansión de Excel | Se valida el contenedor ZIP antes de procesar XLSX: cantidad de entradas, tamaño expandido, estructura y descompresión acotada. No se acepta cifrado, Zip64 o expansión excesiva. |
| Destinos externos | Guardar o probar una URL requiere host y puerto aprobados en el servidor. Se rechazan protocolos, puertos sensibles y credenciales en URL; hay espera limitada y no se siguen redirecciones. Los hosts internos aprobados por TI sí pueden usarse. |
| Superficie de registro | El autorregistro queda cerrado por defecto en producción. En desarrollo continúa disponible. El servidor no concede privilegios de administrador desde datos del registro. |
| Recursos de servidor | Se limita la concurrencia HTTP, la frecuencia por IP, las conexiones y los tiempos de espera; la cola MySQL queda acotada. WebSocket limita clientes y conexiones pendientes y exige autenticación administrativa. |
| Contenido en correo y CSV | Se escapan los textos de notificaciones HTML. Las cadenas de CSV con prefijos de fórmula se neutralizan; los números no se convierten en texto. |
| Correo sin configuración | Una instalación local sin credenciales no intenta conexiones inútiles a SMTP. Los tickets permanecen guardados y las notificaciones quedan pendientes hasta configurar el servicio. |
| Recursos de soporte | El técnico puede consultar existencias y mapa operativo según sus accesos. Los cambios administrativos de stock y seguridad siguen restringidos. |

## Validación ejecutada

`npm run verify:delivery` completó las siete suites secuenciales: sintaxis, instalación, seguridad, regresión, Incremento IV, interfaz y pruebas adversariales. Los resultados finales están en [RESULTADOS-VERIFICACION-20261012.json](RESULTADOS-VERIFICACION-20261012.json) y [RESULTADOS-SEGURIDAD-20261012.json](RESULTADOS-SEGURIDAD-20261012.json).

- Instalación desde base vacía, cuenta MySQL dedicada, migración autorizada, alta única del administrador, cambio de clave obligatorio y respaldo/restauración de SQL y archivos.
- Autorización por rol, alcance de tickets, falsificación de parámetros, contraseñas protegidas, sesión única, recuperación y caducidad.
- Entradas malformadas, inyección SQL, claves de prototipo, recorrido de carpetas, adjuntos sin autorización, tipos activos, multipart y expansión de Excel.
- XSS almacenado comprobado en Chromium: el contenido no ejecuta el marcador de prueba al abrir el ticket.
- Notificaciones HTML comprobadas con transporte capturado; no se certifica recepción institucional.
- Bloqueo por cinco intentos, persistencia, caducidad, simultaneidad, desbloqueo auditado y fallo de correo que conserva el bloqueo.
- Retención: sin política o sin registros antiguos no borra; respaldo verificado previo a eliminación; fallo de respaldo conserva las trazas.
- Estados, reasignación, escalamiento, repuestos, pausa de SLA, importación CSV/XLSX y validación de RUT; conectores IMER, correo y directorio con servicios de prueba.
- Interfaz a 1440 y 390 px, navegación, reintento y apariencia; cero errores inesperados de navegador en los recorridos automatizados.
- Descargas abiertas y comprobadas: ticket PDF, ticket largo de 24 páginas, etiqueta PDF, reporte PDF, Excel y CSV. Manual PDF cargado y consultado en carpeta temporal.
- Comparación SHA-256 de las filas de `user`, `user_role`, `ticket` y `attachment` de la base original antes y después del ensayo adversarial: sin cambios. Las pruebas se ejecutaron en esquemas temporales propios.
- `npm audit` del 12 de octubre: cero vulnerabilidades conocidas reportadas para el árbol instalado. Esto no examina todos los fallos posibles del código ni garantiza vulnerabilidades futuras.

La suite adversarial completó **25 casos**, además de la medición y la comprobación de conservación de datos. Se añadieron y aprobaron comprobaciones específicas de JavaScript como descarga binaria y neutralización de fórmulas CSV después del recorrido completo.

La ráfaga de disponibilidad fue **80 consultas HTTP con 8 clientes simultáneos**, únicamente en loopback: p95 de 31 ms y máximo de 33 ms en la última ejecución. Son una medición de ese PC, no una capacidad garantizada para la clínica. Se comprobaron conexiones WebSocket sin autenticar y su rechazo/caducidad sin bloquear la salud del servidor.

También se instaló el paquete exportado con `npm ci`, una base y cuenta MySQL nuevas, migración autorizada y el servidor normal. Se comprobó cambio de contraseña, 31 herramientas y cero errores de página; consultar [resultados del paquete](RESULTADOS-PAQUETE-20261012.json).

## Configuración que cambia

| Variable | Valor inicial / uso |
| --- | --- |
| `CLINICA_BIND_ADDRESS` | `127.0.0.1`; el proxy autorizado se conecta al backend local. |
| `CLINICA_PUBLIC_REGISTRATION` | `false` en la plantilla; producción lo mantiene cerrado salvo habilitación explícita de TI. Desarrollo permite registrar cuentas de prueba. |
| `CLINICA_MAX_ACTIVE_REQUESTS` | `64`; máximo de solicitudes HTTP en curso. |
| `CLINICA_REQUESTS_PER_MINUTE` | `1200`; frecuencia por IP, que exige un proxy correctamente configurado para distinguir clientes. |
| `CLINICA_EXTERNAL_ALLOWED_HOSTS` | Vacío. Lista de hosts y puertos concretos autorizados, separados por coma. Sin comodines. |

La política de cabeceras incluye CSP, bloqueo de enmarcado, `nosniff` y restricciones de permisos del navegador. La CSP conserva `unsafe-eval` para Alpine y estilos inline; no se declara una CSP estricta sin excepciones. Producción exige HTTPS salvo salud, rechaza orígenes de petición discordantes y sirve HSTS en conexiones reconocidas como seguras. El archivo de configuración no instala certificados ni un proxy.

## Pendientes de TI antes del piloto

1. Instalar y verificar una instancia central con HTTPS, cuenta de servicio, arranque automático, firewall y acceso desde otro PC autorizado. Mantener una sola instancia Node.
2. Aprobar cuentas, roles, categorías, prioridades, horario y contactos; guardar credenciales fuera del repositorio público.
3. Configurar SMTP real y comprobar recepción, resolución y recuperación; configurar únicamente los conectores contratados.
4. Probar carga y volumen representativos, límites y reinicio en el servidor elegido. No se ensayó carga distribuida ni resistencia DDoS.
5. Programar respaldos integrales privados y verificar restauración en otra base y carpeta. No basta el respaldo SQL de la interfaz.
6. Definir análisis antimalware y política de adjuntos. Las firmas básicas no garantizan que un PDF o imagen sea inocuo ni validan todo su contenido.
7. Evaluar infraestructura DNS/red y el control de salida para destinos autorizados. La lista de hosts no constituye protección completa contra cambios maliciosos de DNS.
8. Definir monitoreo, respuesta a incidentes y canal privado de feedback. No publicar datos de pacientes, tokens, registros privados ni respaldos en Issues.

No se verificó cifrado de toda la base en reposo, no se incorporó MFA obligatorio para todos los inicios y no se realizó una auditoría independiente. Las pruebas no otorgan certificación ISO/IEC 25010.

## Reproducir y mantener

Usar un entorno separado con Chromium de Playwright, Python/PyMuPDF, mysqldump, puerto 3200 libre y cuenta MySQL de pruebas autorizada para crear y eliminar esquemas temporales. Las suites no deben ejecutarse con la cuenta limitada de producción. El comando adversarial solo apunta a loopback.

```powershell
npm ci
npx playwright install chromium
python -m pip install pymupdf
npm run verify:delivery
npm audit
```

Consultar el [manual de presentación e instalación](MANUAL-PRESENTACION-CLINICA.md), [puesta en servicio](DESPLIEGUE-CLINICA.md) y [mapa de código](ARQUITECTURA-Y-MANTENIMIENTO.md).

Referencias utilizadas para orientar la revisión: [Express: Security best practices](https://expressjs.com/en/advanced/best-practice-security/), [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) y [OWASP Web Security Testing Guide](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/).
