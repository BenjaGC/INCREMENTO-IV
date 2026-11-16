-- DML inicial: catálogos y parámetros de una instalación nueva, SIN usuarios ni tickets.
-- Aplicar después de DDL.sql, solo en una base NUEVA vacía.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

INSERT INTO `category` (`category_id`,`category_name`,`description`,`default_sla_hours`,`is_active`,`creation_date`) VALUES (1,'Computador/Hardware',NULL,24,1,'2026-11-15 23:08:51.000');
INSERT INTO `category` (`category_id`,`category_name`,`description`,`default_sla_hours`,`is_active`,`creation_date`) VALUES (2,'Impresora',NULL,24,1,'2026-11-15 23:08:51.000');
INSERT INTO `category` (`category_id`,`category_name`,`description`,`default_sla_hours`,`is_active`,`creation_date`) VALUES (3,'Teléfono IP',NULL,24,1,'2026-11-15 23:08:51.000');
INSERT INTO `category` (`category_id`,`category_name`,`description`,`default_sla_hours`,`is_active`,`creation_date`) VALUES (4,'Sistema/Software',NULL,24,1,'2026-11-15 23:08:51.000');
INSERT INTO `category` (`category_id`,`category_name`,`description`,`default_sla_hours`,`is_active`,`creation_date`) VALUES (5,'Red/Internet',NULL,24,1,'2026-11-15 23:08:51.000');
INSERT INTO `category` (`category_id`,`category_name`,`description`,`default_sla_hours`,`is_active`,`creation_date`) VALUES (6,'Sistema Externo (ej. IMER)',NULL,24,1,'2026-11-15 23:08:51.000');
INSERT INTO `inc3_config` (`id`,`upload_mb`,`manual_mb`,`cost_threshold`,`saturation`) VALUES (1,10,50,'100000.00',3);
INSERT INTO `inc3_jobs` (`name`,`last_success`,`last_attempt`,`result`) VALUES ('archive',NULL,NULL,NULL);
INSERT INTO `inc3_jobs` (`name`,`last_success`,`last_attempt`,`result`) VALUES ('directory',NULL,NULL,NULL);
INSERT INTO `inc3_jobs` (`name`,`last_success`,`last_attempt`,`result`) VALUES ('mail',NULL,NULL,NULL);
INSERT INTO `inc3_jobs` (`name`,`last_success`,`last_attempt`,`result`) VALUES ('maintenance',NULL,NULL,NULL);
INSERT INTO `inc3_survey_version` (`id`,`questions`,`created_at`) VALUES (1,'[\"¿Cómo evalúa la atención recibida?\",\"¿La solución resolvió su problema?\"]','2026-11-15 23:08:52.000');
INSERT INTO `inc4_retention_policy` (`id`,`enabled`,`retention_years`,`updated_by`,`updated_at`) VALUES (1,0,2,NULL,'2026-11-15 23:08:53.000');
INSERT INTO `operating_hours` (`operating_hours_id`,`hora_inicio`,`hora_fin`) VALUES (1,'08:00:00','20:00:00');
INSERT INTO `priority` (`priority_id`,`priority_name`,`sla_hours`,`color_hex`,`is_active`) VALUES (1,'Normal',24,'#3498db',1);
INSERT INTO `priority` (`priority_id`,`priority_name`,`sla_hours`,`color_hex`,`is_active`) VALUES (2,'Urgente',4,'#e74c3c',1);
INSERT INTO `role` (`role_id`,`role_name`,`description`) VALUES (1,'Admin',NULL);
INSERT INTO `role` (`role_id`,`role_name`,`description`) VALUES (2,'Usuario',NULL);
INSERT INTO `scheduled_report` (`config_id`,`destinatarios`,`periodicidad`,`activo`,`ultima_ejecucion`) VALUES (1,'','Semanal',0,NULL);
INSERT INTO `security_migration` (`name`,`applied_at`) VALUES ('account-ip-guards','2026-11-15 23:08:53.000');
INSERT INTO `status` (`status_id`,`status_name`,`description`,`is_active`,`is_closed`) VALUES (1,'En curso',NULL,1,0);
INSERT INTO `status` (`status_id`,`status_name`,`description`,`is_active`,`is_closed`) VALUES (2,'En espera',NULL,1,0);
INSERT INTO `status` (`status_id`,`status_name`,`description`,`is_active`,`is_closed`) VALUES (3,'Cancelado',NULL,1,1);
INSERT INTO `status` (`status_id`,`status_name`,`description`,`is_active`,`is_closed`) VALUES (4,'Resuelto',NULL,1,1);
INSERT INTO `status` (`status_id`,`status_name`,`description`,`is_active`,`is_closed`) VALUES (5,'Pendiente',NULL,1,0);
INSERT INTO `status` (`status_id`,`status_name`,`description`,`is_active`,`is_closed`) VALUES (6,'Cerrado',NULL,1,1);
INSERT INTO `system_config` (`config_id`,`modalidad_atencion`,`external_endpoint_url`) VALUES (1,'Presencial',NULL);

SET FOREIGN_KEY_CHECKS=1;
