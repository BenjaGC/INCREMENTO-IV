-- DDL final del sistema. Solo para una base NUEVA vacía seleccionada previamente.
-- Generado desde estructura base y migraciones de los incrementos I-IV, sin datos privados.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE `administrador` (
  `user_id` int NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `administrador_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `attachment` (
  `attachment_id` int NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `file_size_mb` decimal(10,2) DEFAULT NULL,
  `upload_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_deleted` tinyint NOT NULL DEFAULT '0',
  `upload_by_user_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `purged_at` datetime DEFAULT NULL,
  PRIMARY KEY (`attachment_id`),
  KEY `fk_attachment_ticket1_idx` (`ticket_id`),
  KEY `upload_by_user_id_idx` (`upload_by_user_id`),
  CONSTRAINT `fk_attachment_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_attachment_user` FOREIGN KEY (`upload_by_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `audit_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `action_type` varchar(100) NOT NULL,
  `affected_table` varchar(100) NOT NULL,
  `affected_record_id` int DEFAULT NULL,
  `previous_value` text,
  `new_value` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `browser_info` varchar(255) DEFAULT NULL,
  `action_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  PRIMARY KEY (`log_id`),
  KEY `fk_audit_log_user1_idx` (`user_id`),
  KEY `fk_audit_log_ticket1_idx` (`ticket_id`),
  KEY `inc4_audit_date` (`action_date`,`log_id`),
  CONSTRAINT `fk_audit_log_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_audit_log_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `auto_close_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `category` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  `description` text,
  `default_sla_hours` int NOT NULL DEFAULT '24',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `creation_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `category_name_UNIQUE` (`category_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `category_priority_matrix` (
  `matrix_id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `priority_id` int NOT NULL,
  `preferred_user_id` int DEFAULT NULL,
  PRIMARY KEY (`matrix_id`),
  UNIQUE KEY `uniq_cat_prior` (`category_id`,`priority_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `comment` (
  `comment_id` int NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `comment_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_internal` tinyint NOT NULL DEFAULT '0',
  `user_id` int DEFAULT NULL,
  `ticket_id` int NOT NULL,
  `is_private` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`comment_id`),
  KEY `fk_comment_user1_idx` (`user_id`),
  KEY `fk_comment_ticket1_idx` (`ticket_id`),
  CONSTRAINT `fk_comment_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_comment_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=164 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `email_queue` (
  `queue_id` int NOT NULL AUTO_INCREMENT,
  `destinatario` varchar(255) NOT NULL,
  `asunto` varchar(255) NOT NULL,
  `html_body` longtext NOT NULL,
  `encolado_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `enviado` tinyint(1) NOT NULL DEFAULT '0',
  `enviado_date` datetime DEFAULT NULL,
  PRIMARY KEY (`queue_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `equipment` (
  `equipment_id` int NOT NULL AUTO_INCREMENT,
  `equipment_name` varchar(100) NOT NULL,
  `equipment_type` varchar(50) NOT NULL,
  `model` varchar(100) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `warranty_expiration` date DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`equipment_id`),
  UNIQUE KEY `serial_number_UNIQUE` (`serial_number`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `export_log` (
  `export_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `formato` varchar(10) NOT NULL,
  `exito` tinyint(1) NOT NULL DEFAULT '1',
  `export_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`export_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `external_integration_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `tiempo_respuesta_ms` int DEFAULT NULL,
  `exito` tinyint(1) NOT NULL DEFAULT '0',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `holiday_exception` (
  `holiday_id` int NOT NULL AUTO_INCREMENT,
  `fecha` date NOT NULL,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`holiday_id`),
  UNIQUE KEY `fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_competency` (
  `user_id` int NOT NULL,
  `category_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`category_id`),
  KEY `category_id` (`category_id`),
  CONSTRAINT `inc3_competency_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`),
  CONSTRAINT `inc3_competency_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_config` (
  `id` int NOT NULL,
  `upload_mb` int NOT NULL DEFAULT '10',
  `manual_mb` int NOT NULL DEFAULT '50',
  `cost_threshold` decimal(12,2) NOT NULL DEFAULT '100000.00',
  `saturation` int NOT NULL DEFAULT '3',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_directory_checkpoint` (
  `id` int NOT NULL,
  `synced_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_inbox` (
  `message_id` varchar(255) NOT NULL,
  `ticket_id` int DEFAULT NULL,
  `outcome` varchar(30) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `receipt_to` varchar(150) DEFAULT NULL,
  `receipt_code` varchar(20) DEFAULT NULL,
  `receipt_sent` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`message_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_jobs` (
  `name` varchar(40) NOT NULL,
  `last_success` datetime DEFAULT NULL,
  `last_attempt` datetime DEFAULT NULL,
  `result` json DEFAULT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_location` (
  `id` int NOT NULL AUTO_INCREMENT,
  `piso` varchar(50) NOT NULL,
  `area` varchar(100) NOT NULL,
  `qr_token` char(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `qr_token` (`qr_token`),
  UNIQUE KEY `area_unica` (`piso`,`area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `severity` varchar(20) DEFAULT NULL,
  `message` text,
  `stack` text,
  `context` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `inc4_technical_date` (`created_at`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_survey_answer` (
  `ticket_id` int NOT NULL,
  `version_id` int NOT NULL,
  `user_id` int NOT NULL,
  `answers` json NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_survey_version` (
  `id` int NOT NULL AUTO_INCREMENT,
  `questions` json NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_templates` (
  `channel` varchar(20) NOT NULL,
  `body` text NOT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`channel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc3_travel` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `user_id` int NOT NULL,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `arrived_at` datetime DEFAULT NULL,
  `seconds` int DEFAULT NULL,
  `location_id` int DEFAULT NULL,
  `observed` tinyint NOT NULL DEFAULT '0',
  `justification` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ticket_id` (`ticket_id`),
  CONSTRAINT `inc3_travel_ibfk_1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc4_access_guard` (
  `guard_key` char(64) NOT NULL,
  `scope` enum('account','ip','account_ip') NOT NULL,
  `user_id` int DEFAULT NULL,
  `source_ip` varchar(45) DEFAULT NULL,
  `failures` int NOT NULL DEFAULT '0',
  `last_failure` datetime DEFAULT NULL,
  `blocked_until` datetime DEFAULT NULL,
  `manual_unlock` tinyint NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`guard_key`),
  KEY `inc4_guard_user` (`user_id`),
  KEY `inc4_guard_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc4_retention_policy` (
  `id` int NOT NULL,
  `enabled` tinyint NOT NULL DEFAULT '0',
  `retention_years` int NOT NULL DEFAULT '2',
  `updated_by` int DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc4_retention_run` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` datetime DEFAULT NULL,
  `outcome` varchar(30) NOT NULL DEFAULT 'running',
  `cutoff` datetime DEFAULT NULL,
  `removed_rows` bigint NOT NULL DEFAULT '0',
  `backup_name` varchar(180) DEFAULT NULL,
  `backup_sha256` char(64) DEFAULT NULL,
  `summary` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `inc4_retention_date` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `inc4_security_event` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `event_type` varchar(40) NOT NULL,
  `user_id` int DEFAULT NULL,
  `actor_id` int DEFAULT NULL,
  `source_ip` varchar(45) DEFAULT NULL,
  `detail` varchar(500) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `inc4_security_date` (`created_at`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `insumo_catalogo` (
  `material_id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `costo_unitario_referencia` decimal(10,2) NOT NULL DEFAULT '0.00',
  `stock_actual` int NOT NULL DEFAULT '0',
  `stock_minimo` int NOT NULL DEFAULT '5',
  PRIMARY KEY (`material_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `insumo_entrada` (
  `entrada_id` int NOT NULL AUTO_INCREMENT,
  `material_id` int NOT NULL,
  `cantidad` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`entrada_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `label_print_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `formato` varchar(10) NOT NULL DEFAULT 'print',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `material` (
  `material_id` int NOT NULL AUTO_INCREMENT,
  `material_name` varchar(100) NOT NULL,
  `description` text,
  `stock` int NOT NULL DEFAULT '0',
  `minimum_stock` int NOT NULL DEFAULT '0',
  `unit_measure` varchar(20) NOT NULL DEFAULT 'unidad',
  `unit_cost` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `material_used` (
  `material_used_id` int NOT NULL AUTO_INCREMENT,
  `quantity` int NOT NULL DEFAULT '1',
  `usage_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `comment` varchar(255) DEFAULT NULL,
  `observation` text,
  `registered_by_user_id` int NOT NULL,
  `ticket_id` int NOT NULL,
  `material_id` int NOT NULL,
  PRIMARY KEY (`material_used_id`),
  KEY `fk_material_used_ticket1_idx` (`ticket_id`),
  KEY `fk_material_used_material1_idx` (`material_id`),
  KEY `registered_by_user_id_idx` (`registered_by_user_id`),
  CONSTRAINT `fk_material_used_material1` FOREIGN KEY (`material_id`) REFERENCES `material` (`material_id`),
  CONSTRAINT `fk_material_used_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_registered_by_user_id` FOREIGN KEY (`registered_by_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `notification` (
  `notification_id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `notification_type` varchar(45) NOT NULL,
  `delivery_channel` varchar(45) NOT NULL,
  `is_read` tinyint NOT NULL DEFAULT '0',
  `sent_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id` int NOT NULL,
  PRIMARY KEY (`notification_id`),
  KEY `fk_notification_user1_idx` (`user_id`),
  CONSTRAINT `fk_notification_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `operating_hours` (
  `operating_hours_id` int NOT NULL AUTO_INCREMENT,
  `hora_inicio` time NOT NULL DEFAULT '08:00:00',
  `hora_fin` time NOT NULL DEFAULT '20:00:00',
  PRIMARY KEY (`operating_hours_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `priority` (
  `priority_id` int NOT NULL AUTO_INCREMENT,
  `priority_name` varchar(45) NOT NULL,
  `sla_hours` int NOT NULL DEFAULT '24',
  `color_hex` varchar(7) DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`priority_id`),
  UNIQUE KEY `priority_name_UNIQUE` (`priority_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `priority_change_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `priority_anterior` int DEFAULT NULL,
  `priority_nueva` int DEFAULT NULL,
  `justificacion` varchar(500) NOT NULL,
  `log_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `qr_ticket` (
  `qr_ticket_id` int NOT NULL AUTO_INCREMENT,
  `qr_token` varchar(255) NOT NULL,
  `qr_expiration` datetime NOT NULL,
  `ticket_id` int NOT NULL,
  PRIMARY KEY (`qr_ticket_id`),
  UNIQUE KEY `qr_token_UNIQUE` (`qr_token`),
  UNIQUE KEY `ticket_id_UNIQUE` (`ticket_id`),
  KEY `fk_qr_ticket_ticket1_idx` (`ticket_id`),
  CONSTRAINT `fk_qr_ticket_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `report_dispatch_log` (
  `log_id` int NOT NULL AUTO_INCREMENT,
  `config_id` int DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `exito` tinyint(1) NOT NULL DEFAULT '1',
  `intentos` int NOT NULL DEFAULT '1',
  `detalle` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `role` (
  `role_id` int NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `role_name_UNIQUE` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `scheduled_report` (
  `config_id` int NOT NULL AUTO_INCREMENT,
  `destinatarios` text NOT NULL,
  `periodicidad` varchar(10) NOT NULL DEFAULT 'Semanal',
  `activo` tinyint(1) NOT NULL DEFAULT '0',
  `ultima_ejecucion` datetime DEFAULT NULL,
  PRIMARY KEY (`config_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `security_migration` (
  `name` varchar(80) NOT NULL,
  `applied_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `security_recovery` (
  `guard_key` char(64) NOT NULL,
  `user_id` int DEFAULT NULL,
  `code_hash` char(64) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `window_started` datetime DEFAULT NULL,
  `sends` int NOT NULL DEFAULT '0',
  `last_sent` datetime DEFAULT NULL,
  `verified` tinyint NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`guard_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `session` (
  `session_id` int NOT NULL AUTO_INCREMENT,
  `session_token` varchar(200) NOT NULL,
  `ip_address` varchar(45) NOT NULL,
  `login_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `user_id` int NOT NULL,
  PRIMARY KEY (`session_id`),
  UNIQUE KEY `session_token_UNIQUE` (`session_token`),
  KEY `fk_session_user_idx` (`user_id`),
  CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `solicitante` (
  `user_id` int NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `solicitante_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `status` (
  `status_id` int NOT NULL AUTO_INCREMENT,
  `status_name` varchar(45) NOT NULL,
  `description` text,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `is_closed` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`status_id`),
  UNIQUE KEY `status_name_UNIQUE` (`status_name`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `status_history` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `previous_status_id` int DEFAULT NULL,
  `new_status_id` int NOT NULL,
  `change_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `change_reason` varchar(200) DEFAULT NULL,
  `ticket_id` int NOT NULL,
  `changed_by_user_id` int NOT NULL,
  PRIMARY KEY (`history_id`),
  KEY `fk_status_history_ticket1_idx` (`ticket_id`),
  KEY `changed_by_user_id_idx` (`changed_by_user_id`),
  CONSTRAINT `fk_status_history_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`),
  CONSTRAINT `fk_status_history_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `system_config` (
  `config_id` int NOT NULL AUTO_INCREMENT,
  `modalidad_atencion` varchar(20) NOT NULL DEFAULT 'Presencial',
  `external_endpoint_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`config_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `tecnico` (
  `user_id` int NOT NULL,
  `nivel` enum('BASICO','CRITICO') NOT NULL DEFAULT 'BASICO',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `tecnico_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `ticket` (
  `ticket_id` int NOT NULL AUTO_INCREMENT,
  `ticket_code` varchar(20) NOT NULL,
  `title` varchar(150) NOT NULL,
  `description` text NOT NULL,
  `creation_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `close_date` datetime DEFAULT NULL,
  `assignment_date` datetime DEFAULT NULL,
  `sla_due_date` datetime DEFAULT NULL,
  `reopen_count` int NOT NULL DEFAULT '0',
  `time_spent_minutes` int NOT NULL DEFAULT '0',
  `is_archived` tinyint NOT NULL DEFAULT '0',
  `ticket_origin` enum('web','email','phone','internal') NOT NULL DEFAULT 'web',
  `requester_user_id` int NOT NULL,
  `technician_user_id` int DEFAULT NULL,
  `category_id` int NOT NULL,
  `status_id` int NOT NULL,
  `priority_id` int NOT NULL,
  `equipment_id` int NOT NULL,
  `assigned_user_id` int DEFAULT NULL,
  `notify_creator` tinyint(1) NOT NULL DEFAULT '0',
  `resolution_date` datetime DEFAULT NULL,
  `sla_deadline` datetime DEFAULT NULL,
  `piso_ticket` varchar(50) DEFAULT NULL,
  `habitacion_ticket` varchar(100) DEFAULT NULL,
  `alerta_sla_nivel` int NOT NULL DEFAULT '0',
  `alerta_75_enviada` tinyint(1) NOT NULL DEFAULT '0',
  `auto_cerrado` tinyint(1) NOT NULL DEFAULT '0',
  `pausa_inicio` datetime DEFAULT NULL,
  `survey_version` int DEFAULT NULL,
  `sla_paused_seconds` bigint NOT NULL DEFAULT '0',
  PRIMARY KEY (`ticket_id`),
  UNIQUE KEY `ticket_code_UNIQUE` (`ticket_code`),
  KEY `fk_ticket_category1_idx` (`category_id`),
  KEY `fk_ticket_status1_idx` (`status_id`),
  KEY `fk_ticket_priority1_idx` (`priority_id`),
  KEY `fk_ticket_equipment1_idx` (`equipment_id`),
  KEY `fk_ticket_requester_idx` (`requester_user_id`),
  KEY `fk_ticket_technician_idx` (`technician_user_id`),
  KEY `inc3_archive_search` (`is_archived`,`close_date`,`category_id`),
  FULLTEXT KEY `inc3_archive_text` (`title`,`description`),
  CONSTRAINT `fk_ticket_category1` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`),
  CONSTRAINT `fk_ticket_equipment1` FOREIGN KEY (`equipment_id`) REFERENCES `equipment` (`equipment_id`),
  CONSTRAINT `fk_ticket_priority1` FOREIGN KEY (`priority_id`) REFERENCES `priority` (`priority_id`),
  CONSTRAINT `fk_ticket_requester` FOREIGN KEY (`requester_user_id`) REFERENCES `user` (`user_id`),
  CONSTRAINT `fk_ticket_status1` FOREIGN KEY (`status_id`) REFERENCES `status` (`status_id`),
  CONSTRAINT `fk_ticket_technician` FOREIGN KEY (`technician_user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `ticket_evaluation` (
  `id_ticket_evaluation` int NOT NULL AUTO_INCREMENT,
  `user_rating` tinyint NOT NULL,
  `closing_comment` text,
  `ticket_id` int NOT NULL,
  PRIMARY KEY (`id_ticket_evaluation`),
  UNIQUE KEY `ticket_id_UNIQUE` (`ticket_id`),
  KEY `fk_ticket_evaluation_ticket1_idx` (`ticket_id`),
  CONSTRAINT `fk_ticket_evaluation_ticket1` FOREIGN KEY (`ticket_id`) REFERENCES `ticket` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `ticket_material` (
  `ticket_material_id` int NOT NULL AUTO_INCREMENT,
  `ticket_id` int NOT NULL,
  `material_id` int NOT NULL,
  `cantidad` int NOT NULL,
  `costo_unitario` decimal(10,2) NOT NULL,
  `costo_total` decimal(10,2) NOT NULL,
  `user_id` int DEFAULT NULL,
  `requiere_aprobacion` tinyint(1) NOT NULL DEFAULT '0',
  `aprobado` tinyint(1) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ticket_material_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `first_last_name` varchar(50) NOT NULL,
  `second_last_name` varchar(50) NOT NULL,
  `institutional_email` varchar(150) NOT NULL,
  `rut` varchar(15) NOT NULL,
  `username` varchar(45) NOT NULL,
  `password_hash` varchar(250) NOT NULL,
  `user_status` tinyint DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_login` datetime DEFAULT NULL,
  `phone_number` varchar(12) DEFAULT NULL,
  `session_token` varchar(255) DEFAULT NULL,
  `is_critical_tech` tinyint(1) NOT NULL DEFAULT '0',
  `en_vacaciones` tinyint(1) NOT NULL DEFAULT '0',
  `operational_area` varchar(100) DEFAULT NULL,
  `operational_floor` varchar(50) DEFAULT NULL,
  `job_title` varchar(100) DEFAULT NULL,
  `directory_id` varchar(255) DEFAULT NULL,
  `must_reset_password` tinyint NOT NULL DEFAULT '0',
  `last_seen` datetime DEFAULT NULL,
  `competencies_configured` tinyint NOT NULL DEFAULT '0',
  `tipo_usuario` enum('SOLICITANTE','TECNICO','ADMINISTRADOR') NOT NULL DEFAULT 'SOLICITANTE',
  `session_token_hash` char(64) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `institutional_email_UNIQUE` (`institutional_email`),
  UNIQUE KEY `rut_UNIQUE` (`rut`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  UNIQUE KEY `security_session_hash` (`session_token_hash`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_role` (
  `user_role_id` int NOT NULL AUTO_INCREMENT,
  `assignment_date` datetime NOT NULL,
  `active` tinyint NOT NULL,
  `role_id` int NOT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`user_role_id`),
  UNIQUE KEY `uk_user_role` (`role_id`,`user_id`),
  KEY `fk_user_role_role1_idx` (`role_id`),
  KEY `fk_user_role_user1_idx` (`user_id`),
  CONSTRAINT `fk_user_role_role1` FOREIGN KEY (`role_id`) REFERENCES `role` (`role_id`),
  CONSTRAINT `fk_user_role_user1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DELIMITER $$
CREATE TRIGGER `inc3_attachment_insert` BEFORE INSERT ON `attachment` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=NEW.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_attachment_update` BEFORE UPDATE ON `attachment` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=OLD.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_attachment_new_parent` BEFORE UPDATE ON `attachment` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=NEW.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_attachment_delete` BEFORE DELETE ON `attachment` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=OLD.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_comment_insert` BEFORE INSERT ON `comment` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=NEW.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_comment_update` BEFORE UPDATE ON `comment` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=OLD.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_comment_new_parent` BEFORE UPDATE ON `comment` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=NEW.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_comment_delete` BEFORE DELETE ON `comment` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=OLD.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_ticket_update` BEFORE UPDATE ON `ticket` FOR EACH ROW BEGIN IF OLD.is_archived=1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_ticket_delete` BEFORE DELETE ON `ticket` FOR EACH ROW BEGIN IF OLD.is_archived=1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_ticket_material_insert` BEFORE INSERT ON `ticket_material` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=NEW.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_ticket_material_update` BEFORE UPDATE ON `ticket_material` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=OLD.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_ticket_material_new_parent` BEFORE UPDATE ON `ticket_material` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=NEW.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_ticket_material_delete` BEFORE DELETE ON `ticket_material` FOR EACH ROW BEGIN IF EXISTS(SELECT 1 FROM ticket WHERE ticket_id=OLD.ticket_id AND is_archived=1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ticket archivado: solo lectura'; END IF; END$$
CREATE TRIGGER `inc3_identity_type_insert` BEFORE INSERT ON `user` FOR EACH ROW BEGIN SET NEW.tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=NEW.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN NEW.is_critical_tech=1 OR NEW.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END; END$$
CREATE TRIGGER `inc3_identity_insert` AFTER INSERT ON `user` FOR EACH ROW BEGIN 
 DELETE FROM solicitante WHERE user_id=NEW.user_id AND NEW.tipo_usuario<>'SOLICITANTE';
 DELETE FROM tecnico WHERE user_id=NEW.user_id AND NEW.tipo_usuario<>'TECNICO';
 DELETE FROM administrador WHERE user_id=NEW.user_id AND NEW.tipo_usuario<>'ADMINISTRADOR';
 IF NEW.tipo_usuario='SOLICITANTE' THEN INSERT IGNORE INTO solicitante(user_id) VALUES (NEW.user_id);
 ELSEIF NEW.tipo_usuario='TECNICO' THEN INSERT INTO tecnico(user_id,nivel) VALUES (NEW.user_id,IF(NEW.is_critical_tech=1,'CRITICO','BASICO')) ON DUPLICATE KEY UPDATE nivel=VALUES(nivel);
 ELSE INSERT IGNORE INTO administrador(user_id) VALUES (NEW.user_id); END IF; END$$
CREATE TRIGGER `inc3_identity_type_update` BEFORE UPDATE ON `user` FOR EACH ROW BEGIN SET NEW.tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=NEW.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN NEW.is_critical_tech=1 OR NEW.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END; END$$
CREATE TRIGGER `inc3_identity_update` AFTER UPDATE ON `user` FOR EACH ROW BEGIN 
 DELETE FROM solicitante WHERE user_id=NEW.user_id AND NEW.tipo_usuario<>'SOLICITANTE';
 DELETE FROM tecnico WHERE user_id=NEW.user_id AND NEW.tipo_usuario<>'TECNICO';
 DELETE FROM administrador WHERE user_id=NEW.user_id AND NEW.tipo_usuario<>'ADMINISTRADOR';
 IF NEW.tipo_usuario='SOLICITANTE' THEN INSERT IGNORE INTO solicitante(user_id) VALUES (NEW.user_id);
 ELSEIF NEW.tipo_usuario='TECNICO' THEN INSERT INTO tecnico(user_id,nivel) VALUES (NEW.user_id,IF(NEW.is_critical_tech=1,'CRITICO','BASICO')) ON DUPLICATE KEY UPDATE nivel=VALUES(nivel);
 ELSE INSERT IGNORE INTO administrador(user_id) VALUES (NEW.user_id); END IF; END$$
CREATE TRIGGER `inc3_role_identity_insert` AFTER INSERT ON `user_role` FOR EACH ROW BEGIN UPDATE user u SET tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN u.is_critical_tech=1 OR u.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END WHERE u.user_id=NEW.user_id; END$$
CREATE TRIGGER `inc3_role_identity_update` AFTER UPDATE ON `user_role` FOR EACH ROW BEGIN UPDATE user u SET tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN u.is_critical_tech=1 OR u.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END WHERE u.user_id=NEW.user_id;IF OLD.user_id<>NEW.user_id THEN UPDATE user u SET tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN u.is_critical_tech=1 OR u.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END WHERE u.user_id=OLD.user_id; END IF; END$$
CREATE TRIGGER `inc3_role_identity_delete` AFTER DELETE ON `user_role` FOR EACH ROW BEGIN UPDATE user u SET tipo_usuario=CASE WHEN EXISTS(SELECT 1 FROM user_role r WHERE r.user_id=u.user_id AND r.role_id=1 AND r.active=1) THEN 'ADMINISTRADOR' WHEN u.is_critical_tech=1 OR u.tipo_usuario='TECNICO' THEN 'TECNICO' ELSE 'SOLICITANTE' END WHERE u.user_id=OLD.user_id; END$$
DELIMITER ;
SET FOREIGN_KEY_CHECKS=1;
