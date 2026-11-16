# Base de datos final

## Scripts SQL para revisión e importación manual

- DDL.sql: esquema completo de los incrementos I-IV (tablas, índices, relaciones y triggers).
- DML.sql: catálogos y parámetros iniciales, sin usuarios, tickets ni contraseñas.

Para una base NUEVA vacía: seleccionarla en Workbench, ejecutar DDL.sql y después DML.sql. Estos scripts NO deben ejecutarse sobre una instalación existente.

Importación probada en una segunda base aislada: 53 tablas, 21 triggers y 27 filas iniciales.

La instalación habitual mediante npm run db:init y npm run db:migrate se conserva. Usa una sola modalidad: no repitas db:init después de importar DDL/DML. Crea el administrador siguiendo el manual.

clinica.sql y datos-iniciales.sql son la base histórica usada por db:init. Las ampliaciones idempotentes están en src/increment3-schema.js, src/identity-schema.js, src/increment4/schema.js y src/security-schema.js.
