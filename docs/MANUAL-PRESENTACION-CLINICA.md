# Manual de presentación e instalación
## Ticketera Clínica Aconcagua - Incremento IV

Grupo 11 | Entrega revisada el 14 de octubre de 2026

Esta guía sirve para presentar desde el computador de un compañero y para instalar en un equipo administrado por TI de la clínica. El repositorio entrega el código; GitHub no enciende el sistema ni hospeda su base de datos.

Repositorio: https://github.com/BenjaGC/INCREMENTO-IV

Versión que debe descargarse: incremento-iv-20261014, disponible en Releases. Utilizar el archivo Ticketera-Clinica-Aconcagua-Incremento-IV.zip y extraerlo antes de abrirlo en Visual Studio Code.

### Elegir el recorrido
| Situación | Qué hacer |
| --- | --- |
| Presentaré desde mi PC | Seguir las páginas 2 a 7. Usar una base nueva de presentación, separada de cualquier instalación anterior. |
| Instalaré en la clínica | Coordinar con TI y seguir también las páginas 8 a 10. Todos los funcionarios utilizan una misma instancia central. |
| Ya hay datos guardados | Respaldar y aplicar el procedimiento de actualización. No ejecutar db:init ni borrar tablas. |

### Antes de la reunión
1. Confirmar que MySQL está iniciado y que la aplicación responde en /health/ready.
2. Tener una cuenta administradora y una solicitante de prueba; comprobar sus contraseñas en privado.
3. Preparar un PDF y una imagen sin información de pacientes para probar manuales y adjuntos.
4. Abrir dos ventanas: administrador en la normal y solicitante en una privada.
5. Verificar la descarga de un PDF. Mantener visible la terminal del servidor para diagnosticar errores.
6. No afirmar recepción de correos si todavía no se ha configurado y comprobado SMTP.

### Las contraseñas son distintas
| Credencial | De dónde sale |
| --- | --- |
| Root de MySQL | Ya existe en ese servidor. Se solicita durante la migración; no se crea con Read-Host. |
| Usuario MySQL de la aplicación | Se elige al crear clinica_app y debe coincidir exactamente con DB_PASSWORD en .env. |
| Administrador de la página | Es una clave web nueva de al menos 12 caracteres. Se cambia al primer ingreso. |
| Correo institucional | La proporciona el proveedor o TI. No se sustituye por una contraseña de la página. |

El sistema es un monolito modular de tres capas: interfaz HTML/CSS/JavaScript con Alpine, servidor Node.js/Express y persistencia MySQL. Los adjuntos y manuales también requieren almacenamiento privado en disco.

<!-- page -->
# 2. Preparar el PC de presentación

### Paso 1. Instalar los requisitos
Instalar Node.js 24 y MySQL Server 8.4. Workbench es opcional: permite administrar MySQL, pero no reemplaza al servidor. En Windows, iniciar el servicio MySQL desde Servicios; su nombre depende de la instalación. Si MySQL no está instalado como servicio, pedir al responsable el método de arranque utilizado.

### Paso 2. Descargar y abrir la aplicación
En el repositorio, abrir Releases, seleccionar incremento-iv-20261014 y descargar el ZIP de instalación. Extraerlo en una carpeta propia; abrir la carpeta que contiene package.json en Visual Studio Code. Abrir Terminal > Nueva terminal y comprobar:

```powershell
node --version
npm --version
npm ci
Copy-Item .env.example .env
```

Copiar la plantilla una sola vez. No repetir Copy-Item después de completar .env, porque reemplazaría la configuración.

### Paso 3. Crear una base NUEVA
Abrir Workbench y conectar con una cuenta autorizada, por ejemplo root. Usar localhost, puerto 3306 y la contraseña EXISTENTE de esa cuenta. Ejecutar este SQL una sola vez, reemplazando el marcador por una clave propia que se guardará en privado:

```sql
CREATE DATABASE clinica_presentacion
CHARACTER SET utf8mb4;

CREATE USER 'clinica_app'@'localhost'
IDENTIFIED BY 'TU_CLAVE_MYSQL_NUEVA';

GRANT ALL PRIVILEGES ON clinica_presentacion.*
TO 'clinica_app'@'localhost';
```

Si clinica_app ya existe, TI debe revisar su uso y sus permisos; no borrarlo ni cambiar su clave sin comprobar qué aplicaciones lo utilizan. Se puede elegir otra cuenta dedicada y utilizar ese mismo nombre en DB_USER. Si la base ya existe con tablas, no continuar con db:init.

### Paso 4. Completar .env y guardar
Abrir .env, reemplazar las líneas existentes y guardar con Ctrl+S. No agregar copias de la misma variable al final del archivo.

```dotenv
NODE_ENV=development
PORT=3000
CLINICA_BIND_ADDRESS=127.0.0.1
DB_HOST=localhost
DB_PORT=3306
DB_USER=clinica_app
DB_PASSWORD=TU_CLAVE_MYSQL_NUEVA
DB_NAME=clinica_presentacion
```

Utilizar en DB_PASSWORD exactamente la clave elegida en el SQL. Los demás valores de la plantilla pueden conservarse para esta prueba local. Los conectores sin credenciales no envían correos ni sincronizan servicios reales.

<!-- page -->
# 3. Preparar la base y el administrador

### Paso 5. Instalar estructura y ampliaciones
En la terminal de Visual Studio Code, situada en la carpeta de package.json:

```powershell
npm run db:init
$env:CLINICA_MIGRATION_USER = "root"
$claveMigracion = Read-Host 'Clave EXISTENTE de root en MySQL' -AsSecureString
$credMigracion = [System.Net.NetworkCredential]::new('', $claveMigracion)
$env:CLINICA_MIGRATION_PASSWORD = $credMigracion.Password
npm run db:migrate
```

Escribir la clave cuando aparezca la pregunta de Read-Host y pulsar Enter. El texto de la pregunta no es una contraseña. Si aparece Access denied, revisar la cuenta y clave de MySQL; no reinstalar ni borrar la base. Continuar únicamente cuando la migración confirme que las ampliaciones y disparadores están preparados.

```powershell
Remove-Item Env:CLINICA_MIGRATION_USER
Remove-Item Env:CLINICA_MIGRATION_PASSWORD
Remove-Variable claveMigracion,credMigracion
npm start
```

Mantener abierta esta terminal. Visitar http://localhost:3000/health/ready: debe indicar ready. Abrir después http://localhost:3000. Si se cambió PORT, utilizar ese puerto en ambas direcciones.

### Paso 6. Crear el administrador web
Abrir una SEGUNDA terminal en la misma carpeta, sin detener npm start:

```powershell
$claveAdmin = Read-Host 'Nueva clave web: minimo 12 caracteres' -AsSecureString
$claveAdmin.Length
```

Si la longitud es menor que 12, repetir Read-Host con una clave más larga. No compartirla en el chat ni incluirla en el video. Ejecutar:

```powershell
$credAdmin = [System.Net.NetworkCredential]::new('', $claveAdmin)
$env:CLINICA_ADMIN_PASSWORD = $credAdmin.Password
npm run admin:create -- "11111111-1" "Admin de presentacion" "admin@example.test"
Remove-Item Env:CLINICA_ADMIN_PASSWORD
Remove-Variable claveAdmin,credAdmin
```

El RUT y correo de este comando son ejemplos para la base de presentación. En la clínica se usan los datos reales autorizados. El correo example.test no recibe mensajes. Ingresar con el RUT y la clave temporal elegida; completar el cambio obligatorio de contraseña. No hay una clave administrativa predeterminada.

### Paso 7. Preparar la cuenta solicitante
En una ventana privada, abrir la página y elegir Registrarse. Para esta base local se puede usar RUT 22222222-2, nombre Funcionario de prueba y un correo de ejemplo distinto. Elegir una contraseña propia. El registro concede el rol solicitante; no crea administradores. En producción el autorregistro está cerrado por defecto.

<!-- page -->
# 4. Recorrido de tickets y documentos

### Mostrar el proceso completo
1. En la ventana solicitante, pulsar Nuevo incidente. Elegir categoría, ubicación y equipo disponibles. Escribir: "La impresora de recepción no responde al enviar una impresión de prueba". Completar los campos requeridos y guardar.
2. Mostrar el identificador generado y el estado Pendiente. Explicar que el solicitante consulta sus solicitudes autorizadas y que la asignación depende de la configuración de categorías y técnicos.
3. Volver al administrador y abrir Bandeja de soporte. Buscar el código del incidente y abrirlo. Revisar responsable, prioridad, ubicación y detalle.
4. Si hay dos técnicos registrados, demostrar la reasignación eligiendo otro técnico y escribiendo el motivo. No prometer esta acción si solo existe una cuenta de soporte.
5. Tomar el incidente y cambiar a En curso. Publicar un comentario con una imagen o PDF válido. Mostrar el registro del actor y de la fecha.
6. Resolverlo con un detalle técnico, por ejemplo: "Se revisó la conexión y se completó una impresión de prueba". Mostrar el evento en el historial y, cuando corresponda, cerrar el ticket.
7. Consultar otra vez desde el solicitante para mostrar el resultado. Exportar a PDF y abrir el archivo descargado, no solo mostrar el botón.

### Funciones complementarias
| Dónde | Qué mostrar | Qué revisar |
| --- | --- | --- |
| Manuales | Subir un PDF autorizado y abrirlo o descargarlo. | Debe ser realmente PDF, hasta 50 MB. Eliminar un manual requiere permisos. |
| Detalle del ticket | Comentario y archivo adjunto. | Hasta 10 MB; no usar archivos con datos personales para la reunión. |
| Inicio y reportes | Indicadores y filtros. | Con pocos tickets los gráficos pueden mostrar pocos valores; no inventar estadísticas. |
| Administración > Reportes y KPIs | Exportar en los formatos disponibles. | Abrir el PDF, Excel o CSV descargado y comprobar los filtros utilizados. |
| Inventario y repuestos | Consultar stock, registrar o consumir según el rol. | Una salida no debe superar las existencias. No alterar stock operativo en una presentación. |
| Importar usuarios | Descargar plantilla y cargar un archivo válido. | Usar RUT válidos, correos distintos y cuentas de prueba; revisar cada rechazo. |

### Qué decir sobre los roles
El solicitante trabaja con sus tickets autorizados. El técnico dispone de información operativa de soporte y atiende los incidentes asignados. El administrador configura el sistema y accede a las herramientas administrativas. Las comprobaciones de permisos también se realizan en el servidor.

Los correos requieren SMTP configurado y recepción comprobada en el buzón. Si aparece una notificación pendiente, el ticket ya puede estar guardado; no volver a crearlo solo para intentar enviar el correo.

<!-- page -->
# 5. Mostrar las novedades del Incremento IV

### Apariencia y legibilidad
Abrir el menú de perfil y la opción de Apariencia. Cambiar entre claro y oscuro; recorrer la bandeja y un detalle para comprobar legibilidad. La preferencia se conserva por cuenta en ese navegador. No implica que un cambio se copie automáticamente a otro computador.

### Seguridad de acceso
Abrir Administración > Seguridad de acceso. Mostrar los accesos y los controles de bloqueo. Tras cinco intentos fallidos se bloquea la combinación de cuenta y origen durante 30 minutos; las cuentas administrativas requieren revisión manual para ese origen. Otras cuentas de la misma red siguen disponibles. Entre distintos orígenes se aplica una espera progresiva breve por cuenta.

Para mostrarlo sin perder el acceso administrativo:
1. Mantener abierta la ventana del administrador.
2. En la ventana privada, intentar entrar con la cuenta SOLICITANTE DE PRUEBA y una clave incorrecta cinco veces.
3. Mostrar el rechazo por bloqueo. Volver al administrador, actualizar la lista y localizar la cuenta o IP afectada.
4. Ejecutar el desbloqueo con un motivo de al menos 10 caracteres, por ejemplo "Identidad de prueba verificada".
5. Ingresar con la clave correcta y comprobar que recupera el acceso.

No ejecutar esta prueba con la cuenta administradora real de la clínica. El bloqueo afecta a la cuenta de prueba desde ese origen; no bloquea a todas las personas de la red. La sesión administrativa existente permite gestionar el desbloqueo.

Si un administrador autorizado quedó bloqueado y no hay otro acceso, TI puede usar la terminal de esa instalación:

```powershell
npm run account:unlock -- "22222222-2" "Identidad verificada por TI"
```

Utilizar el RUT afectado y un motivo verdadero. No usar el comando para cambiar permisos ni omitir una verificación de identidad.

### Mantenimiento de trazas
Abrir Administración > Mantenimiento de trazas. Explicar la conservación de dos años y la planificación semestral. La política automática viene deshabilitada para que TI apruebe su uso.

El mantenimiento exige un respaldo comprimido y verificado antes de retirar trazas antiguas; mantiene un historial de la ejecución. En una base nueva, no tener registros con más de dos años es un resultado normal. No crear fechas falsas en la base de la clínica para forzar una eliminación.

El respaldo de trazas es distinto del respaldo integral de la instalación. Para recuperar tickets, adjuntos y manuales se necesita también el procedimiento de respaldo de la página 9.

<!-- page -->
# 6. Mapa de herramientas: operación

Desde Administración, las herramientas están agrupadas para organizar el soporte. La disponibilidad de acciones depende del rol y de la configuración. Antes de cambiar reglas que afecten tickets reales, confirmar la decisión con el responsable funcional.

| Herramienta | Para qué sirve / cómo presentarla |
| --- | --- |
| Competencias técnicas | Relacionar técnicos y especialidades con las categorías. Utilizar usuarios y categorías existentes. |
| Disponibilidad del equipo | Consultar la disponibilidad del soporte. Revisar quién está habilitado antes de cambiar una asignación. |
| Estadísticas | Observar el estado agregado de los incidentes. Explicar el período y los filtros utilizados. |
| Reportes y KPIs | Filtrar resultados y exportar el informe. Abrir el archivo para comprobar su contenido. |
| Inventario Consolidado | Consultar equipos y recursos registrados. El inventario requiere información cargada por la clínica. |
| Mapa de Calor | Identificar ubicaciones con más incidencias. No confundir pocas pruebas locales con tendencias reales. |
| Monitoreo de SLA | Revisar vencimientos y alertas. Los tiempos dependen de prioridad, horario y pausas configurados. |
| Reportes Automáticos | Configurar reportes programados y destinatarios autorizados. Comprobar el envío con SMTP real. |
| Desempeño por Técnico | Revisar la atención por responsable. Validar el período antes de interpretar las cifras. |
| Archivo histórico | Consultar incidentes archivados. Se preserva su trazabilidad; no se editan como tickets activos. |
| Encuestas de satisfacción | Consultar respuestas vinculadas a la atención. No generar respuestas falsas para completar indicadores. |
| Prioridades y SLA | Definir prioridades y tiempos. Un cambio debe corresponder a un acuerdo de servicio aprobado. |
| Matriz de Asignación | Ajustar la derivación por categoría y técnico. Comprobar el resultado con un incidente de prueba. |
| Ventana Operativa | Definir el horario utilizado en el cálculo de atención. Confirmarlo con la clínica. |
| Calendario de Feriados | Mantener las fechas excluidas del horario operativo según la política acordada. |
| Stock de Repuestos | Revisar existencias y registrar movimientos autorizados. No registrar salidas sin stock suficiente. |

### Ejemplo para explicar el SLA
"Una prioridad tiene un tiempo de atención definido. El sistema considera la configuración operativa y las pausas autorizadas; el monitoreo permite identificar incidentes próximos a vencer. Los valores deben acordarse con la clínica antes del uso real."

<!-- page -->
# 7. Mapa de herramientas: administración

| Herramienta | Para qué sirve / cómo presentarla |
| --- | --- |
| Integraciones Externas | Guardar y comprobar servicios aprobados. TI autoriza host y puerto en CLINICA_EXTERNAL_ALLOWED_HOSTS. |
| Categorías de incidentes | Mantener clasificaciones y su uso en el enrutamiento. No retirar una categoría sin revisar sus relaciones. |
| Parámetros del sistema | Revisar ajustes operativos. Registrar el motivo y conservar valores anteriores al cambiar. |
| Mensajes institucionales | Publicar información interna con vigencia y alcance. Usar contenido aprobado. |
| Correo y directorio | Consultar actividad de correo y sincronización. IMAP y LDAP/AD requieren infraestructura y credenciales reales. |
| QR de Activos | Identificar equipos y facilitar su consulta. En un teléfono, localhost se refiere al propio teléfono: hace falta la dirección accesible del servidor. |
| Gestionar Equipos | Mantener los activos que se vinculan a incidentes. Verificar ubicación e identificador. |
| Papelera de evidencias | Revisar evidencias retiradas y las acciones permitidas. Preservar el historial y respetar la retención. |
| Seguridad de acceso | Revisar intentos, bloqueos y desbloqueos con motivo. Reservado a administradores. |
| Mantenimiento de trazas | Revisar política, respaldo e historial. Habilitar la programación solo con aprobación de TI. |
| Registro de errores | Diagnosticar fallas desde una cuenta administradora. Los detalles técnicos no deben publicarse como evidencia ni compartirse con datos privados. |
| Mantenimiento | Revisar las operaciones de mantenimiento disponibles. Coordinar cualquier interrupción con los usuarios. |
| Importar usuarios desde Excel | Descargar la plantilla .xlsx; cargar hasta 5 MB y 1000 filas. Revisar aceptados y rechazados. |
| Importar usuarios desde CSV | Utilizar la plantilla y las columnas solicitadas. Los RUT inválidos o duplicados deben rechazarse de forma controlada. |
| Respaldar base de datos | Obtener el respaldo SQL desde la interfaz. Es privado y no incluye los archivos adjuntos ni los manuales. |

### Integraciones que no deben presentarse como activas sin comprobarlas
La existencia de un botón no significa que SMTP, IMAP, LDAP/AD, WhatsApp o IMER estén conectados a la clínica. TI debe confirmar el servicio, la autenticación, los permisos y el resultado real. Para IMER se configura un token privado; un evento autorizado debe verificarse desde su origen y vincularse al incidente esperado.

### Alta de usuarios en producción
El autorregistro se deshabilita por defecto. Los administradores pueden utilizar las importaciones para incorporar funcionarios. El primer administrador se crea por el comando local documentado; no existe una opción pública para registrarse como administrador.

Las cuentas importadas deben completar el cambio de contraseña que indique el sistema. No reutilizar la contraseña de la base de datos para los funcionarios.

<!-- page -->
# 8. Instalar en un PC o servidor de la clínica

Esta sección corresponde al informático de la clínica. El presentador puede explicar el proceso y entregar el código; el acceso a la infraestructura y las credenciales deben ser autorizados por TI.

### Antes de instalar
1. Confirmar equipo de destino, responsable del servicio, dirección HTTPS, alcance de red y cantidad estimada de usuarios.
2. Confirmar Node.js, MySQL Server, certificados, proxy y una cuenta MySQL exclusiva para la aplicación.
3. Definir carpetas privadas persistentes para datos y respaldos, fuera del código y de public.
4. Confirmar una cuenta de correo institucional y los parámetros SMTP. No inventar credenciales para superar las comprobaciones de producción.
5. Si existe una instalación previa, respaldarla y verificar la actualización en una copia independiente.

### Orden de instalación
Descargar la versión revisada, ejecutar npm ci, completar .env, preparar una base NUEVA con db:init y aplicar db:migrate con una cuenta autorizada. Es el mismo orden de las páginas 2 y 3, con los nombres, rutas y credenciales reales del servidor. Crear el administrador con RUT, nombre y correo institucionales después de preparar la base.

### Configuración de producción
Las siguientes líneas son referencias de formato. TI debe reemplazar el dominio y completar además las variables DB y SMTP de .env.example:

```dotenv
NODE_ENV=production
PORT=3000
CLINICA_BIND_ADDRESS=127.0.0.1
CLINICA_PUBLIC_REGISTRATION=false
CLINICA_TRUSTED_PROXIES=127.0.0.1,::1
PUBLIC_ORIGIN=https://ticketera.DOMINIO-DE-LA-CLINICA
CLINICA_DATA_DIR=C:/ClinicaAconcagua/datos
CLINICA_BACKUP_DIR=C:/ClinicaAconcagua/respaldos
```

Configurar SMTP_HOST, SMTP_PORT, SMTP_SECURE, MAIL_USER, MAIL_PASSWORD y MAIL_FROM según el proveedor. El arranque de producción exige correo configurado, origen HTTPS, carpeta de respaldos y cuenta MySQL diferente de root. La presencia de estos valores no prueba por sí sola que el correo llegue.

### Una instalación central para los funcionarios
El proxy sirve HTTPS y se conecta a 127.0.0.1:3000. Debe conservar el host público y establecer X-Forwarded-Proto. TI define sus direcciones en CLINICA_TRUSTED_PROXIES; ya no se acepta TRUST_PROXY_HOPS. Configurar además CLINICA_RECOVERY_SECRET con al menos 32 caracteres aleatorios privados y conservarlo. Producción exige estas variables y el directorio privado de datos.

Los funcionarios abren la dirección HTTPS en sus navegadores. No deben instalar cada uno una base independiente ni utilizar localhost del computador del presentador. PUBLIC_ORIGIN no instala un certificado. GitHub Pages no ejecuta esta aplicación.

<!-- page -->
# 9. Arranque, respaldo y recuperación

### Operación diaria
TI registra un servicio o tarea administrada que ejecute node server.js desde la carpeta de la aplicación, con acceso a la configuración y a los directorios privados. MySQL debe iniciar antes que Node. Mantener una sola instancia; algunos límites HTTP y la programación siguen siendo locales al proceso. Los códigos, vencimientos e intentos de recuperación persisten protegidos en MySQL.

Comprobar /health/live para el proceso y /health/ready para su preparación. Confirmar persistencia después de reiniciar. Los registros de servicio se guardan en un destino privado, no en el repositorio.

### Detener una instalación local
En la terminal que ejecuta npm start, pulsar Ctrl+C. Esto detiene ese proceso Node; el servicio MySQL puede seguir activo. Si la página sigue funcionando, comprobar qué instancia y puerto se están utilizando antes de detener otros procesos. No eliminar carpetas de datos para apagar la página.

### Respaldo integral
Definir CLINICA_BACKUP_DIR con una ruta privada y MYSQLDUMP_PATH si mysqldump no está en su ubicación habitual. Coordinar una ventana sin escrituras y ejecutar desde la carpeta del proyecto:

```powershell
npm run backup
```

Comprobar que el ZIP contiene database.sql, uploads, manuales y el manifiesto. El respaldo contiene datos privados. Mantener una copia fuera del equipo principal, permisos restringidos y una retención aprobada por TI. El botón de respaldo de la interfaz produce SQL; no equivale a este respaldo integral.

### Restaurar y verificar
1. Preparar una base NUEVA y una carpeta de datos aparte.
2. Importar database.sql con una cuenta autorizada. Preservar o adaptar por TI los definidores de disparadores.
3. Recuperar uploads y manuales en el directorio de datos de esa instalación.
4. Conectar una copia del código a esos destinos y comprobar usuarios, tickets, historial y descargas.
5. Habilitarla como instalación principal solo después de validar la restauración. Conservar la anterior hasta completar la comprobación.

### Actualizar el código
Guardar la versión en uso y un respaldo integral. Detener escrituras y el servicio. Preparar el código nuevo aparte con npm ci, conservar la configuración privada y las rutas persistentes, ejecutar la migración autorizada y arrancar una sola instancia. Comprobar salud, acceso, ticket y descargas antes de reabrir a usuarios.

Si falla, conservar los registros y recuperar código, base y archivos compatibles. Cambiar solamente el código no garantiza volver atrás si la estructura de MySQL cambió. Nunca usar db:init sobre la base operativa.

<!-- page -->
# 10. Errores frecuentes y solución

| Mensaje o síntoma | Qué hacer |
| --- | --- |
| Access denied de MySQL | Revisar usuario, host y contraseña. DB_PASSWORD debe coincidir con el usuario dedicado. La migración utiliza la clave EXISTENTE de la cuenta autorizada, por ejemplo root. |
| La base o cuenta ya existe | Comprobar su contenido y propietario. No ejecutar DROP para repetir una presentación. Usar un destino nuevo autorizado. |
| db:init encuentra tablas | Es un bloqueo de protección. No reinstalar encima; revisar si corresponde actualizar o completar una migración. |
| CLINICA_ADMIN_PASSWORD no se reconoce | En PowerShell se escribe $env:CLINICA_ADMIN_PASSWORD. No omitir $env:. |
| admin:create muestra instrucciones de uso | Verificar los tres argumentos, RUT válido y contraseña de al menos 12 caracteres; máximo 72 bytes. Revisar la longitud antes de ejecutar. |
| Administrador ya existente | El comando no reemplaza sus permisos ni contraseña. Utilizar recuperación autorizada o una cuenta nueva para otra base. |
| Cambio de clave obligatorio / 428 | Completar el cambio de contraseña antes de utilizar el resto del sistema. |
| Bloqueo / 423 | Esperar el período indicado o pedir al administrador un desbloqueo con verificación de identidad. |
| Sin permisos / 403 | Utilizar la cuenta y rol que corresponden. Ocultar o mostrar botones no modifica los permisos del servidor. |
| Muchas solicitudes / 429 | Esperar el tiempo indicado. Revisar clientes repetitivos y el proxy antes de ajustar los límites. |
| Servicio ocupado / 503 | Reintentar en unos segundos y comprobar estado, recursos y registros del servicio. |
| Puerto ocupado | Revisar qué proceso lo usa; detener la instancia correcta o cambiar PORT y utilizar la nueva dirección. |
| Otro PC no abre localhost | Localhost apunta a ese PC. Usar el dominio HTTPS del servidor central autorizado. |
| PDF rechazado | Comprobar formato real, tamaño y extensión. Cambiar el nombre de un archivo a .pdf no lo convierte en PDF. |
| Correo pendiente o no recibido | Revisar SMTP, credenciales, TLS y buzón. No crear el ticket otra vez sin revisar primero el existente. |
| Destino externo no autorizado | TI debe aprobar host y puerto en CLINICA_EXTERNAL_ALLOWED_HOSTS. No introducir claves o tokens en la URL. |
| Corte de luz | Iniciar MySQL y el servicio, comprobar salud y datos. No borrar la base; verificar recuperación y respaldos. |

Al comunicar un error, incluir versión, hora, rol, pasos, resultado esperado y resultado observado. Omitir contraseñas, tokens, datos de pacientes y archivos privados. No publicar estos datos en Issues públicos.

<!-- page -->
# 11. Guion breve para el presentador

Duración orientativa: 6 minutos, sin contar instalación. Si un envío externo requiere configuración, explicar su estado y continuar; no fingir recepción.

### 0:00 a 0:40 - Inicio y propósito
Abrir la aplicación e ingresar como administrador.

"Buenos días. Presento la Ticketera Clínica Aconcagua del Grupo 11. Permite registrar incidentes, asignar soporte, seguir su atención y consultar reportes. Hoy recorreré el proceso de un ticket y las mejoras del Incremento IV. La instalación institucional se completa con el informático de la clínica y sus servicios reales."

### 0:40 a 2:00 - Incidente y seguimiento
Mostrar el ticket de prueba desde solicitante; pasar al administrador, abrirlo, tomarlo y publicar un comentario.

"El funcionario registra el problema y recibe un identificador. Desde soporte revisamos la ubicación, prioridad y responsable. Cada cambio y comentario deja un registro del actor y de la fecha. Los permisos se comprueban también en el servidor. Aquí podemos seguir el avance y documentar la solución."

### 2:00 a 2:40 - Resolución y documentos
Resolver, mostrar el historial y exportar a PDF. Abrir el PDF descargado.

"Al resolver, dejamos el detalle de la atención y el usuario puede consultar el resultado. La exportación permite conservar el registro del incidente fuera de la aplicación. Los manuales y adjuntos autorizados se consultan desde sus módulos."

### 2:40 a 3:25 - Apariencia
Abrir el perfil, cambiar a oscuro y regresar a claro.

"Este incremento incorpora las opciones clara y oscura para mejorar la lectura. La preferencia se conserva para la cuenta dentro de este navegador. Las pantallas se adaptan para recorrer la bandeja y el detalle desde distintos tamaños de pantalla."

### 3:25 a 4:20 - Seguridad de acceso
Abrir Seguridad de acceso. Mostrar una prueba preparada o revisar la lista sin bloquear cuentas reales.

"Tras cinco intentos fallidos se bloquea la combinación de cuenta y origen. El administrador puede revisar la actividad y desbloquear con una justificación registrada. Otras cuentas de esa red mantienen su acceso. La cuenta administradora se crea desde una herramienta local autorizada; el registro público no permite conceder esos permisos."

### 4:20 a 5:10 - Trazas y respaldo
Abrir Mantenimiento de trazas y mostrar política e historial.

"La política conserva trazas por dos años y permite un mantenimiento semestral aprobado por TI. Antes de retirar registros antiguos exige un respaldo comprimido y verificado. En una base reciente puede no haber trazas antiguas. Además, la instalación necesita respaldos integrales de la base y sus archivos."

### 5:10 a 6:00 - Entrega y piloto
Mostrar Administración y terminar con la guía de instalación.

"La entrega incluye código, instalación, creación del administrador, operación y pruebas. Se revisaron permisos, entradas malformadas, archivos y comportamiento bajo una ráfaga local acotada. Antes del piloto, TI debe verificar HTTPS, correo, respaldo y acceso desde otro computador. La experiencia de sus usuarios nos permitirá registrar incidencias y mejorar el sistema."

<!-- page -->
# 12. Seguridad: resultados y límites

La revisión del 14 de octubre se realizó en localhost, bases temporales y cuentas de prueba. Se corrigieron problemas reproducidos; no se intentó acceder a infraestructura ajena ni se atacó la base operativa. El informe y los resultados se publican en docs del repositorio.

### Cambios principales
| Área | Resultado de la revisión |
| --- | --- |
| Disponibilidad | Una consulta malformada podía detener Node; ahora se rechaza de forma controlada. Hay límites de solicitudes, conexiones y espera. |
| Sesiones y permisos | Cerrar sesión revoca el token autenticado aunque falten campos en el formulario. Las rutas administrativas rechazan otros roles. |
| Archivos | Límites de carga y campos multipart, limpieza de cargas rechazadas, firmas básicas de PDF/imágenes y descarga segura de otros tipos. |
| Excel | La expansión del ZIP se limita antes del procesamiento de la hoja. No se aceptan archivos cuyo tamaño declarado supere los límites. |
| Contenido | Se comprobó que el XSS almacenado no se ejecuta en el ticket; los campos de correo se escapan y las fórmulas de texto CSV se neutralizan. |
| Servicios externos | La comprobación de URLs requiere una lista de hosts y puertos aprobados por TI y no sigue redirecciones. |
| Producción | Autorregistro cerrado por defecto; escucha local por defecto y validación de HTTPS detrás del proxy configurado. |

### Qué no prueba esta revisión
Una prueba local no garantiza ausencia total de vulnerabilidades, capacidad de carga de la clínica ni resistencia a ataques distribuidos. Las expresiones del HTML se compilan antes de distribuir y no se autoriza unsafe-eval en ejecución. La validación de firmas no es un antivirus ni una inspección completa del contenido de PDF. TI debe completar protección perimetral, análisis antimalware y gestión de credenciales.

Las contraseñas web se almacenan con hash bcrypt; eso no significa que toda la base esté cifrada. El correo y códigos de recuperación no constituyen autenticación multifactor obligatoria de todos los inicios de sesión. No se otorga certificación ISO/IEC 25010 con estas pruebas.

### Recursos para el informático
Ejecutar las pruebas únicamente en un entorno separado, con permisos para crear y eliminar bases temporales y puerto 3200 libre. Se requieren dependencias de desarrollo, Chromium de Playwright, Python con PyMuPDF y mysqldump. No usar la cuenta limitada de producción para ejecutar estas suites.

```powershell
npx playwright install chromium
python -m pip install pymupdf
npm run verify:delivery
npm audit
```

Consultar docs/REVISION-SEGURIDAD-20261014.md y docs/ARQUITECTURA-Y-MANTENIMIENTO.md. Referencias: Express, Security Best Practices; OWASP, REST Security Cheat Sheet y Web Security Testing Guide. Son guías de revisión, no certificaciones del proyecto.

<!-- page -->
# 13. Aceptación y feedback de la clínica

TI y el responsable funcional deben revisar esta lista en el servidor de destino. Registrar fecha, persona y resultado. No marcar un punto como aprobado únicamente por haber pasado una prueba local.

| Comprobación | Resultado esperado / registro |
| --- | --- |
| Arranque y reinicio | MySQL y ticketera inician correctamente; /health/ready responde ready y los datos persisten. |
| Red y HTTPS | Otro computador autorizado accede al dominio; el backend no queda expuesto directamente. |
| Administrador | Cambio obligatorio completado, correo real y responsable identificado. |
| Roles | Solicitante, soporte y administrador tienen los accesos correspondientes. |
| Tickets | Creación, búsqueda, asignación, estados, comentario e historial funcionan con un incidente autorizado. |
| Documentos | Manual y adjunto válidos abren; PDF, Excel y CSV exportados se descargan y se pueden leer. |
| Correo real | Se verifica recepción al crear y resolver; recuperación de contraseña funciona con el proveedor real. |
| Integraciones | Cada servicio utilizado se configura y verifica con su origen real; lo no contratado se marca no utilizado. |
| Bloqueos y trazas | Se comprueban con cuentas de prueba; retención y responsables aprobados por TI. |
| Respaldo y restauración | Se recuperan base y archivos en otra instalación y se comprueba el resultado. |
| Acceso de usuarios | Funcionarios autorizados prueban desde sus propios computadores y registran incidencias. |

### Preguntas frecuentes
"¿Está funcionando al 100 %?" Se verificaron los casos de prueba locales publicados. El funcionamiento institucional se confirma mediante esta aceptación y el piloto; ningún ensayo garantiza cero errores futuros.

"¿Cómo creamos otro administrador?" Una persona autorizada ejecuta admin:create en el servidor con RUT válido, correo y clave temporal privada; se registra un nuevo administrador. No se concede ese rol desde el autorregistro.

"¿GitHub contiene nuestros datos?" La entrega contiene código y catálogos iniciales. La configuración, base operativa, respaldos, adjuntos y credenciales se mantienen fuera del repositorio.

### Registro de la semana de uso
Anotar versión instalada, fecha y responsable. Para cada observación, registrar módulo, rol, pasos, resultado esperado, resultado real, frecuencia e impacto. Compartir capturas solo por el canal privado acordado y sin datos sensibles. Separar mejoras de presentación de errores que impiden trabajar.

El equipo y TI deben acordar el canal de soporte y la prioridad de incidentes. Un problema que expone datos, impide acceder o compromete la integridad se comunica inmediatamente al responsable; no se deja para el cierre de la semana.
