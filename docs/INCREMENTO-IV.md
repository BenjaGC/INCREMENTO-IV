# Funciones del Incremento IV

Requisitos recibidos el 11 de octubre de 2026 en `Incremento 4 - Grupo 11 - Ingenieria Software.docx`. Se implementan CU-67, CU-68 y CU-70 sin cambiar las tecnologías, estados ni permisos existentes.

| Caso | Acceso en la ticketera | Implementación |
| --- | --- | --- |
| CU-67 | Administración → Seguridad y conservación de datos → Mantenimiento de trazas | Política explícita de dos años, ejecución semestral, respaldo GZIP verificado antes del borrado, historial y descarga administrativa. |
| CU-68 | Menú de perfil → Apariencia y accesibilidad | Modo claro/oscuro, variables CSS compartidas y preferencia por cuenta en el navegador. |
| CU-70 | Inicio de sesión; Administración → Seguridad de acceso | Cinco fallos consecutivos, bloqueo de cuenta e IP, alerta de correo, auditoría y desbloqueo manual. |

## Retención y respaldo de trazas

La política viene **deshabilitada** para que TI y la jefatura aprueben su uso antes de eliminar datos. El administrador puede habilitarla y ejecutar el mantenimiento con confirmación. El programador interno comprueba cada minuto si han transcurrido seis meses desde un mantenimiento terminado. Solo trabaja mientras el servidor está encendido; los errores se reintentan con separación mínima de una hora.

Se aplica a `audit_log`, `inc3_log` e `inc4_security_event`, únicamente a filas anteriores a la fecha actual menos dos años. No elimina tickets, comentarios, archivos adjuntos, usuarios ni registros recientes. La copia contiene los registros originales con su tabla, y una cabecera de formato `clinica-traces-v1`. Se comprime como `.jsonl.gz`, se sincroniza a disco, se lee completamente y se comparan cantidad y huella de los registros. Solo después se elimina lo respaldado dentro de la misma transacción. Un fallo antes del commit conserva las filas originales.

Los respaldos quedan en `CLINICA_TRACE_BACKUP_DIR`, o en `CLINICA_BACKUP_DIR/trazas`. En desarrollo sin estas variables se utiliza `.local-backup/trazas`. Nunca deben guardarse dentro de `public`; su descarga requiere administrador. TI debe copiar estos respaldos a su almacenamiento protegido y establecer su propia conservación. El respaldo específico de trazas no sustituye `npm run backup` para una recuperación integral de la aplicación.

Si no hay política o no hay filas antiguas, la tarea registra el resultado sin borrar. Un fallo genera una incidencia técnica y un aviso al administrador; si SMTP falla, la conservación de las filas no depende del correo.

El documento recibido tiene una poscondición sobre categorías en CU-67, aunque el resumen y flujo describen retención de auditoría. La implementación sigue el flujo de retención. El equipo debe corregir esa inconsistencia en su informe.

## Preferencia visual

Funciona para solicitante, técnico y administrador. Se guarda con una clave `clinica_theme_<user_id>` en `localStorage`, por navegador y cuenta. No sincroniza colores entre computadores. Si el almacenamiento falla, se aplica solo durante la sesión y se avisa; si los estilos no cargan, se conserva el modo claro con un aviso.

## Bloqueos y recuperación de acceso

Los contadores se almacenan en MySQL y se serializan con transacciones y locks de fila. Reiniciar Node no elimina el bloqueo. Un ingreso correcto antes del límite reinicia los contadores. Cinco fallos bloquean la combinación de cuenta y origen durante 30 minutos; una cuenta administrativa requiere revisión manual para ese origen. Otras cuentas de la misma red no quedan bloqueadas. Entre distintos orígenes se aplica un retraso progresivo breve por cuenta, de hasta 15 segundos, para limitar intentos distribuidos.

En una red compartida, varias personas pueden utilizar la misma IP. TI debe considerar este efecto al configurar el proxy y al revisar bloqueos. `CLINICA_TRUSTED_PROXIES` identifica las direcciones autorizadas, y el proxy debe sobrescribir los encabezados. Ya no se acepta confianza por número de saltos. El navegador no puede elegir su IP mediante un encabezado enviado directamente.

Un administrador con sesión vigente puede revisar y desbloquear una cuenta dejando un motivo de al menos diez caracteres. Si todas las cuentas administrativas están bloqueadas, **TI autorizado en el servidor** puede utilizar:

```powershell
npm run account:unlock -- "RUT-DE-LA-CUENTA" "Identidad comprobada por TI y acceso autorizado"
```

La recuperación queda auditada y no cambia contraseñas, permisos ni roles. Las alertas de correo requieren SMTP configurado; una falla de envío no retira el bloqueo. El texto de error público evita confirmar si el RUT existe o es administrativo.

## Instalación o actualización

1. Seguir `INSTALACION.md` para una base nueva. Para una instalación existente, respaldar la base y los directorios privados antes de actualizar el código.
2. Instalar las dependencias reproducibles con `npm ci`.
3. Ejecutar `npm run db:migrate` con la cuenta temporal autorizada. La migración agrega tablas e índices; no recrea tablas ni borra datos.
4. Retirar las credenciales temporales y ejecutar `npm start` con la cuenta de aplicación.
5. Configurar el directorio de respaldos, SMTP y proxy/HTTPS institucionales. Verificar roles y recepción de alertas antes de ampliar el uso.

Las pruebas y capturas entregadas usan bases aisladas y datos de prueba. No acreditan uso real en la clínica ni certificación ISO/IEC 25010.
