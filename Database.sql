CREATE DATABASE IF NOT EXISTS Marketing;
USE Marketing;

CREATE TABLE `customer` (
    `customer_id` BIGINT NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(255) DEFAULT NULL,
    `last_name` VARCHAR(50) DEFAULT NULL,
    `mobile_no` VARCHAR(20) DEFAULT NULL,
    `profile_image` VARCHAR(255) DEFAULT NULL,
    `email_id` VARCHAR(100) DEFAULT NULL,
    `password` VARCHAR(50) DEFAULT NULL,
    `address` VARCHAR(500) DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1000 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `contact` (
    `contact_id` BIGINT NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(255) DEFAULT NULL,
    `last_name` VARCHAR(50) DEFAULT NULL,
    `mobile_no` VARCHAR(20) DEFAULT NULL,
    `profile_image` VARCHAR(255) DEFAULT NULL,
    `customer_id` BIGINT DEFAULT NULL,
    `register_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `couponcode` VARCHAR(20),
    `country_code` VARCHAR(5),
    `birthday` DATE,
    `anniversary` DATE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`contact_id`),
    CONSTRAINT `fk_contact`
        FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `contact_group` (
    `group_id` BIGINT NOT NULL AUTO_INCREMENT,
    `group_name` VARCHAR(255) NOT NULL,
    `customer_id` BIGINT,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`group_id`),
    CONSTRAINT `fk_contact_group_shop`
        FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `contact_group_map` (
    `contact_id` BIGINT NOT NULL,
    `group_id` BIGINT NOT NULL,
    `added_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`contact_id`, `group_id`),
    FOREIGN KEY (`contact_id`) REFERENCES `contact`(`contact_id`)
        ON DELETE CASCADE,
    FOREIGN KEY (`group_id`) REFERENCES `contact_group`(`group_id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `broadcasts` (
    `broadcast_id` BIGINT NOT NULL AUTO_INCREMENT,
    `broadcast_name` VARCHAR(255) NOT NULL,
    `customer_list` VARCHAR(255),
    `message_type` VARCHAR(100),
    `schedule` VARCHAR(10),
    `schedule_date` DATETIME NULL,
    `status` VARCHAR(50),
    `type` VARCHAR(50),
    `selected_template` VARCHAR(255), -- Stores selectedTemplate.element_name
    `template_id` VARCHAR(255),
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `sent` INT DEFAULT 0,
    `delivered` INT DEFAULT 0,
    `read` INT DEFAULT 0,
    `clicked` INT DEFAULT 0,
    PRIMARY KEY (`broadcast_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `whatsapp_templates` (
    `id` VARCHAR(50) PRIMARY KEY,
    `external_id` VARCHAR(50),
    `app_id` VARCHAR(50),
    `waba_id` VARCHAR(50),
    `element_name` VARCHAR(100),
    `category` VARCHAR(50),
    `language_code` VARCHAR(10),
    `template_type` VARCHAR(20),
    `status` VARCHAR(20),
    `data` TEXT,
    `container_meta` JSON,
    `created_on` BIGINT,
    `modified_on` BIGINT
);

CREATE TABLE `customer_template_map` (
    `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `customer_id` bigint NOT NULL,
    `template_id` VARCHAR(50) NOT NULL,
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`),  
    FOREIGN KEY (`template_id`) REFERENCES `whatsapp_templates`(`id`)  
);

CREATE TABLE `gupshup_configuration` (
    `id` int NOT NULL AUTO_INCREMENT,
    `customer_id` bigint NOT NULL,
	`gupshup_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_gupshup_configuration_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Table for storing Gupshup configuration for shops';

CREATE TABLE `conversations` (
    `conversation_id` bigint NOT NULL AUTO_INCREMENT,
    `customer_id` bigint NOT NULL,
    `contact_id` bigint NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `last_message_time` timestamp NULL DEFAULT NULL,
    `is_active` tinyint(1) NOT NULL DEFAULT '1',
    PRIMARY KEY (`conversation_id`),
    UNIQUE KEY `shop_guest_unique` (`customer_id`, `contact_id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE,
    FOREIGN KEY (`contact_id`) REFERENCES `contact`(`contact_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `messages` (
    `message_id` bigint NOT NULL AUTO_INCREMENT,
    `conversation_id` bigint NULL,
    `sender_type` ENUM('shop', 'guest', 'system') NOT NULL,
    `sender_id` bigint NOT NULL,
    `message_type` ENUM('text', 'image', 'template', 'location', 'document', 'audio', 'video', 'button') NOT NULL DEFAULT 'text',
    `content` text,
    `element_name` VARCHAR(100),
    `template_data` JSON DEFAULT NULL,
    `media_url` varchar(255) DEFAULT NULL,
    `sent_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `delivered_at` timestamp NULL DEFAULT NULL,
    `read_at` timestamp NULL DEFAULT NULL,
     `received_at` timestamp NULL DEFAULT NULL,
    `status` ENUM('sent', 'delivered', 'read', 'failed', 'received') NOT NULL DEFAULT 'sent',
    `external_message_id` varchar(100) DEFAULT NULL,
    PRIMARY KEY (`message_id`),
    FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`conversation_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
