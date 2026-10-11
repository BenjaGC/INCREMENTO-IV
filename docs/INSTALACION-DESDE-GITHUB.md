# Instalar el Incremento IV desde GitHub

Esta guía indica cómo obtener la entrega y en qué orden instalarla. Para los comandos y la configuración detallada, seguir [INSTALACION.md](INSTALACION.md). GitHub distribuye el código; la aplicación se ejecuta en un PC o servidor con Node.js y MySQL.

## 1. Obtener la aplicación

Abrir [la entrega del Incremento IV](https://github.com/BenjaGC/INCREMENTO-IV/releases/tag/incremento-iv-20261011). En **Assets**, descargar `Ticketera-Clinica-Aconcagua-Incremento-IV.zip`. Extraer TODO el contenido en una carpeta propia y abrir esa carpeta en Visual Studio Code. La carpeta correcta contiene `package.json`, `server.js`, `.env.example`, `src/`, `public/`, `database/`, `scripts/` y `docs/`.

También puede descargarse el código mediante **Code → Download ZIP**. Para trabajar en el código con Git:

```powershell
git clone https://github.com/BenjaGC/INCREMENTO-IV.git
cd INCREMENTO-IV
```

Las capturas del equipo no están dentro de estas descargas.

## 2. Comprobar los requisitos

Instalar Node.js 24 y MySQL Server 8.4; estas son las versiones utilizadas en la verificación local. MySQL Workbench es un cliente opcional: instalar Workbench por sí solo no instala ni arranca el servidor MySQL.

En la terminal del proyecto:

```powershell
node --version
npm --version
npm ci
Copy-Item .env.example .env
```

Copiar la plantilla una sola vez, antes de completar la configuración. Si PowerShell impide ejecutar `npm.ps1`, utilizar `npm.cmd` en lugar de `npm`.

## 3. Preparar MySQL y guardar la configuración

Encender MySQL en ese PC. Con una cuenta autorizada, crear una base VACÍA y una cuenta dedicada para la aplicación siguiendo el apartado 2 de [INSTALACION.md](INSTALACION.md). Elegir una contraseña propia para esa cuenta y guardar exactamente la misma en `DB_PASSWORD` del archivo `.env`. Completar también `DB_HOST`, `DB_PORT`, `DB_USER` y `DB_NAME`.

No borrar una base existente para repetir el video o los pasos. No importar manualmente SQL sobre una instalación con datos. No compartir `.env` ni subirlo a GitHub.

## 4. Instalar estructura y ampliaciones

Ejecutar `npm run db:init` únicamente sobre la base nueva vacía. Luego ejecutar `npm run db:migrate` con las credenciales TEMPORALES de una cuenta autorizada para instalar los disparadores, como explica la guía completa. La contraseña de `root` ya existe en el MySQL de ese PC; no se inventa una nueva en este paso.

Si aparece `Access denied`, revisar la cuenta y contraseña de MySQL. No repetir `db:init` ni borrar la base. Retirar las variables temporales de migración después de una migración correcta.

Para actualizar una instalación existente: respaldar primero, ejecutar `npm ci` y las migraciones; no utilizar `db:init`. Seguir [la guía del Incremento IV](INCREMENTO-IV.md).

## 5. Arrancar y crear el administrador

```powershell
npm start
```

Abrir `http://localhost:3000/health/ready` y comprobar que indica `ready`. Abrir `http://localhost:3000` para usar la ticketera. El puerto debe coincidir con `PORT` en `.env`.

En otra terminal de la misma carpeta, crear el administrador con `npm run admin:create` siguiendo el apartado 4 de la guía. Elegir una contraseña NUEVA de al menos 12 caracteres, un RUT válido y el correo autorizado. El administrador cambia su contraseña al primer ingreso. No existe una contraseña predeterminada en el repositorio.

| Contraseña | De dónde sale | Dónde se utiliza |
| --- | --- | --- |
| Administrador de MySQL, por ejemplo `root` | Ya existe en el MySQL instalado en ese PC. | Temporalmente para preparar las ampliaciones. |
| Cuenta MySQL de la aplicación | Se elige al crear esa cuenta. | `DB_PASSWORD` en `.env`. |
| Administrador de la ticketera | Se elige al crear el administrador web; mínimo 12 caracteres. | Inicio de sesión en la página. |

Ctrl+C en la terminal que ejecuta `npm start` detiene la página. No elimina la base ni apaga el servicio MySQL.

## 6. Configuración de la clínica

TI debe configurar correo e integraciones autorizadas, HTTPS, cuenta de ejecución, directorios privados, respaldos y arranque automático. Seguir [DESPLIEGUE-CLINICA.md](DESPLIEGUE-CLINICA.md) y comprobar alertas, recuperación de contraseña, restauración y acceso desde un segundo PC.

Instalar una copia en cada PC crea bases independientes; no sincroniza los datos. Para compartir tickets entre los computadores de la clínica, TI debe instalar una instancia central y permitir el acceso por navegador a la dirección de ese servidor. `localhost` siempre se refiere al computador de quien abre el navegador.

La retención de trazas permanece deshabilitada hasta que TI apruebe la política y el almacenamiento de respaldos. Las verificaciones locales no sustituyen la comprobación institucional del correo, la red y el volumen de uso esperado.
