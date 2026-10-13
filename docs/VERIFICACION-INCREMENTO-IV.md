# Verificación del Incremento IV

Fecha de revisión: 11 de octubre de 2026. Windows, Node.js 24 y MySQL 8.4. Pruebas reproducibles en bases y directorios separados de la instalación original.

La revisión posterior del 12 de octubre y el paquete actualizado están documentados en [REVISION-SEGURIDAD-20261012.md](REVISION-SEGURIDAD-20261012.md). Este documento conserva el resultado histórico del día 11.

## Alcance

Se revisaron CU-67, CU-68 y CU-70 del documento recibido, además de las suites existentes de instalación, seguridad, regresión e interfaz. Las capturas provienen de pantallas funcionando contra una base temporal con cuentas y registros de prueba. No contienen códigos CU, nombres de figura superpuestos, JSON ni stacks técnicos.

Las pruebas de seguridad incluyen permisos, acceso a tickets y archivos de otros usuarios, cookies y autorización de mutaciones, XSS, caducidad, recuperación de contraseña, importación con hash, intentos de inyección SQL y falsificación de IP, bloqueo concurrente, persistencia tras reiniciar y fallo del transporte de alertas. Esto es una revisión técnica local; no una certificación ni una garantía de ausencia total de vulnerabilidades.

La retención se comprueba con tres trazas antiguas, registros recientes y un ticket que debe conservarse. Se verifica la huella del respaldo, su descompresión y descarga. Se comprueban las condiciones sin política, sin filas antiguas y fallo de creación de respaldo, conservando los registros en la base ante ese fallo.

Se recorre la interfaz con solicitante, técnico y administrador, a 1440 y 390 px. Se valida el modo oscuro, su persistencia, los accesos nuevos, los mensajes de carga y error, el rechazo de almacenamiento local y la ausencia de errores JavaScript inesperados.

## Correcciones incluidas

- Serialización del contador de accesos y reintentos limitados ante conflictos transaccionales concurrentes.
- Verificación de respaldo compatible con permisos de archivo de Windows.
- Respuestas controladas 400/413 ante JSON inválido y solicitudes demasiado grandes, sin mostrar stacks.
- Superficies de modo oscuro, legibilidad y colores de aviso coherentes.
- Retiro de handlers antiguos de login/perfil sustituidos por rutas protegidas; formato uniforme en los módulos.
- Índices de fecha para trazas, lectura y compresión por bloques y límites de listados administrativos.
- Actualización de `proxy-addr` a 2.0.8 frente a [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). La auditoría npm posterior reportó cero vulnerabilidades conocidas.

## Resultado de la entrega del 11 de octubre

Las seis suites terminaron con código de salida 0: sintaxis (97 archivos), instalación, seguridad, regresión, Incremento IV e interfaz. Los recorridos del navegador no registraron errores JavaScript inesperados. Se comprobaron creación y consulta de tickets, filtros, historial, comentarios, adjuntos, manuales, exportación PDF/CSV/Excel, repuestos, SLA, integración de eventos de prueba y administración según roles.

Además se exportó el paquete limpio, se instalaron sus dependencias con `npm ci` y se ejecutaron inicialización, migraciones, creación de administrador y servidor normal, usando una base y cuenta MySQL dedicadas. Se comprobó el cambio obligatorio de contraseña, el acceso a las 31 herramientas administrativas y las pantallas nuevas. La instalación original se conservó sin reemplazar sus datos.

Los resultados públicos se conservan en `docs/verificacion/RESULTADOS.json`, `docs/verificacion/INSTALACION-PAQUETE.json` y `docs/verificacion/CASOS-INCREMENTO-IV.json`. Documentan pruebas locales aisladas; no representan actividad de producción. Las capturas se compartieron por separado con el equipo y no están incluidas en este repositorio ni en el ZIP de instalación.

## Repetir la verificación

Seguir las condiciones de `ARQUITECTURA-Y-MANTENIMIENTO.md`: base de pruebas, usuario autorizado y puerto 3200 libre. Ejecutar `npm run verify:delivery`; los logs y códigos de salida se guardan bajo `artifacts/verificacion-final-incremento-IV`. Las suites se ejecutan una a la vez. `npm audit` debe repetirse en cada entrega, porque los avisos de seguridad cambian.

## Pendientes del servidor de la clínica

Las pruebas de correo, LDAP e IMER utilizan transportes o entradas de prueba. Su recepción institucional real no está verificada. TI debe configurar SMTP, directorio y servicios autorizados; probar alertas y recuperación de contraseña con correos institucionales; definir proxy, HTTPS y acceso desde un segundo computador; verificar reinicio automático y restauración desde su destino de respaldos.

No se ha medido carga con la concurrencia y el volumen históricos reales de la clínica. Antes de habilitar la retención, TI debe aprobar la política de dos años y comprobar el espacio, permisos y conservación externa del respaldo. Tampoco existe evidencia de una semana de uso real ni se certifica ISO/IEC 25010 con estas capturas.

Las pruebas del Incremento IV no borran ni sustituyen la base original.
