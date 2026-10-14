# Ticketera Clínica Aconcagua — Incremento IV

Sistema de soporte informático con tickets, seguimiento SLA, inventario, reportes, manuales y administración. Backend Node.js/Express, base MySQL y frontend HTML/CSS/JavaScript con Alpine.js.

## Descargar e instalar

- [Descargar el paquete revisado del Incremento IV](https://github.com/BenjaGC/INCREMENTO-IV/releases/download/incremento-iv-20261014/Ticketera-Clinica-Aconcagua-Incremento-IV.zip)
- [Ver la entrega descargable y sus huellas SHA-256](https://github.com/BenjaGC/INCREMENTO-IV/releases/tag/incremento-iv-20261014)
- [Manual PDF para presentar e instalar en la clínica](Manual-presentacion-instalacion-clinica.pdf)
- [Manual editable y guion de presentación](MANUAL-PRESENTACION-CLINICA.md)
- [Paso a paso desde GitHub](INSTALACION-DESDE-GITHUB.md)
- [Guía completa de instalación y creación del administrador](INSTALACION.md)

El ZIP contiene la aplicación completa y las guías, preparada para una instalación propia. Cada instalador crea su base vacía, su cuenta MySQL y su administrador. No hay credenciales compartidas ni una contraseña predeterminada.

El código está en la raíz del repositorio; las instrucciones y los resultados están en `docs/`. Los incrementos anteriores permanecen en sus repositorios históricos:

- [Incremento 1](https://github.com/BenjaGC/Incremento-1)
- [Incremento 2](https://github.com/BenjaGC/Incremento-2)
- [Incremento 3](https://github.com/BenjaGC/Incremento-3)

## Estado de la entrega

Código preparado para revisión e instalación en un entorno de prueba. No incluye usuarios, contraseñas, tickets, adjuntos ni credenciales de la instalación local. La publicación de este repositorio no constituye un despliegue en la clínica.

Entrega revisada el **14 de octubre de 2026**. Las siete suites de instalación, seguridad, regresión e interfaz terminaron correctamente en bases aisladas. Se revisó el informe del compañero: sesión HttpOnly sin token en localStorage, hash de sesión en MySQL, recuperación persistente con límites, configuración de producción cerrada, proxies explícitos, permisos centrales y CSP sin unsafe-eval. Se conservan las correcciones anteriores de archivos, entradas y disponibilidad. Consultar la [revisión de seguridad y sus límites](REVISION-SEGURIDAD-20261014.md) y los [resultados finales](RESULTADOS-VERIFICACION-20261014.json). Los servicios institucionales y el servidor de destino aún deben configurarse y comprobarse con TI.

El servidor escucha en `127.0.0.1` por defecto. La plantilla exige producción; para practicar en localhost se elige development expresamente. En producción el autorregistro está cerrado y se exigen HTTPS, datos privados, secreto de recuperación y CLINICA_TRUSTED_PROXIES. TI debe habilitar los hosts y puertos de destinos externos. El manual contiene instrucciones para presentar desde un PC propio y para instalar una instancia central en la clínica, además de respaldo, recuperación y aceptación del piloto.

## Novedades del Incremento IV

- Apariencia clara y oscura, preferencia por cuenta en el navegador y ajustes de legibilidad para escritorio y móvil.
- Bloqueo de cuenta e IP tras cinco intentos fallidos; revisión y desbloqueo administrativo con registro y alertas.
- Conservación de trazas durante dos años y mantenimiento semestral, únicamente cuando TI habilita la política. La eliminación exige un respaldo comprimido y verificado previamente.

Los accesos están integrados en Administración y en el menú de perfil, sin identificadores académicos en la interfaz. Se conservan los módulos y permisos de los incrementos anteriores.

- [Funcionamiento y puesta en operación del Incremento IV](INCREMENTO-IV.md)
- [Mapa del código y mantenimiento para TI](ARQUITECTURA-Y-MANTENIMIENTO.md)

- [Instalar desde cero](INSTALACION.md)
- [Instalación y operación en la clínica](DESPLIEGUE-CLINICA.md)
- [Pruebas entre compañeros y registro de errores](PRUEBAS-DEL-EQUIPO.md)
- [Estado de pruebas y requisitos de uso real](PASO-A-USO-REAL.md)
- [Organización de la entrega académica](INSTRUCCIONES-GITHUB-PARA-EL-EQUIPO.md)

## Inicio rápido

Requisitos: Node.js compatible con `package.json` (validado localmente con Node 24), npm y MySQL 8.4. Trabajar desde la carpeta que contiene este README.

```powershell
npm ci
Copy-Item .env.example .env
```

Crear una base VACÍA y una cuenta MySQL dedicada, completar `.env`, y después:

```powershell
npm run db:init
```

Antes de iniciar, seguir el apartado de migraciones de [INSTALACION.md](INSTALACION.md): configurar temporalmente una cuenta MySQL autorizada y ejecutar `npm run db:migrate`. Retirar esas credenciales temporales y ejecutar `npm start`. Abrir http://localhost:3000. Seguir las instrucciones para crear el primer administrador. No hay una contraseña administrativa predeterminada.

`npm run db:init` se niega a operar si la base ya contiene tablas. Los SQL originales contienen instrucciones de recreación: no importarlos manualmente encima de una instalación existente.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm start` | Arrancar el servidor; MySQL debe estar activo. Ctrl+C detiene ese proceso Node. |
| `npm run dev` | Desarrollo con reinicio al cambiar archivos. |
| `npm run check` | Comprobar sintaxis de código y scripts. |
| `npm run build:csp` | Regenerar las expresiones precompiladas después de cambiar directivas HTML. |
| `npm run db:init` | Instalar estructura base y catálogos en una base vacía. |
| `npm run db:migrate` | Preparar las ampliaciones y los disparadores; consultar credenciales temporales en la guía. |
| `npm run admin:create -- RUT "Nombre" correo` | Crear administrador localmente; requiere CLINICA_ADMIN_PASSWORD temporal. |
| `npm run backup` | Respaldar SQL y archivos; requiere mysqldump y directorio privado de destino. |
| `npm run test:security` | Pruebas de autorización, sesiones y recuperación en base temporal. |
| `npm run test:regression` | Pruebas del Incremento III en base temporal. |
| `npm run test:ui` | Recorrido de interfaz, aceptación, descargas y administración. |
| `npm run test:increment4` | Apariencia, bloqueos, respaldo de trazas y fallos controlados en base temporal. |
| `npm run test:adversarial` | Pruebas locales acotadas de entradas malformadas, permisos, archivos y disponibilidad en base temporal. |
| `npm run verify:delivery` | Ejecutar las siete suites de verificación de forma secuencial. |
| `npm run account:unlock -- RUT "Motivo"` | Desbloqueo por TI desde terminal, con motivo auditado. |

Las pruebas necesitan dependencias de desarrollo, `npx playwright install chromium`, acceso a MySQL con permisos para crear/eliminar bases de prueba y puerto 3200 libre. Ejecutarlas una por una en un entorno separado. Los envíos de correo de estas pruebas son simulados y no certifican recepción SMTP real.

## Estructura

- `src/`: servidor, permisos, modelos, ampliaciones de base y tareas.
- `public/`: interfaz, estilos y bibliotecas del navegador.
- `database/`: esquema inicial sin registros personales y catálogos básicos.
- `scripts/`: instalación, administrador, respaldos y pruebas.
- `docs/`: instrucciones y límites de la entrega.

Las ampliaciones están en `src/increment3-schema.js` y `src/increment4/`; `database/clinica.sql` por sí solo no representa toda la estructura final. Ejecutar las migraciones siguiendo la guía tanto en una instalación nueva como al actualizar una existente.

## Publicación y operación

GitHub guarda el código. Esta aplicación no puede ejecutarse con GitHub Pages: necesita Node.js, MySQL y almacenamiento persistente. Antes del uso real se debe definir el servidor, acceso HTTPS, cuenta responsable, correo institucional, respaldos y restauración.

No subir `.env`, respaldos con usuarios, archivos privados ni contraseñas. Las integraciones externas permanecen sin configurar hasta disponer de servicios y credenciales autorizados.

## Resultados de verificación

Las seis suites de verificación local terminaron correctamente. También se instaló el paquete limpio con una cuenta MySQL dedicada y se comprobó el servidor normal, el acceso administrativo y el cambio obligatorio de contraseña.

- [Resultados de las seis suites](verificacion/RESULTADOS.json)
- [Comprobación del paquete de instalación](verificacion/INSTALACION-PAQUETE.json)
- [Casos verificados del Incremento IV](verificacion/CASOS-INCREMENTO-IV.json)
- [Alcance, correcciones y comprobaciones pendientes en la clínica](VERIFICACION-INCREMENTO-IV.md)

Este repositorio contiene la entrega de software e instalación. Las capturas compartidas con compañeros no forman parte de esta publicación.

Para comprobar también la instalación inicial y el respaldo con archivos: `npm run test:install`. Requiere Python y mysqldump. Para el recorrido de PDF, instalar PyMuPDF con `python -m pip install pymupdf`.
