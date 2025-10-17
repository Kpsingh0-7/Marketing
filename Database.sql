-- DATABASE CREATION
CREATE DATABASE IF NOT EXISTS TestMarketing;
USE TestMarketing;
SET time_zone = '+00:00';
SELECT NOW(), UTC_TIMESTAMP();

--------------------------------------------------------
-- CUSTOMER TABLE
--------------------------------------------------------
CREATE TABLE `customer` (
    `customer_id` BIGINT NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(255) DEFAULT NULL,
    `last_name` VARCHAR(50) DEFAULT NULL,
    `mobile_no` VARCHAR(20) DEFAULT NULL,
    `profile_image` VARCHAR(255) DEFAULT NULL,
    `email_id` VARCHAR(100) UNIQUE,
    `password` VARCHAR(50) DEFAULT NULL,
    `address` VARCHAR(500) DEFAULT NULL,
    `total_credit` DECIMAL(10,2) DEFAULT 0.00,
    `total_credit_consumed` DECIMAL(10,2) DEFAULT 0.00,
    `total_credit_remaining` DECIMAL(10,2) AS (`total_credit` - `total_credit_consumed`) STORED,
    `status` ENUM('active','inactive','suspended') DEFAULT 'suspended',
    `plan` ENUM('trail','basic','pro') DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--------------------------------------------------------
-- CUSTOMER USERS
--------------------------------------------------------
CREATE TABLE `customer_users` (
    `user_id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT NOT NULL,
    `name` VARCHAR(100),
    `email` VARCHAR(100) UNIQUE,
    `mobile_no` VARCHAR(20),
    `password` VARCHAR(100),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------
-- CUSTOMER USER ACCESS
--------------------------------------------------------
CREATE TABLE `customer_user_access` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT NOT NULL,
    `user_id` BIGINT DEFAULT NULL, -- NULL = main customer
    `allowed_routes` JSON NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `customer_users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------
-- CUSTOMER CREDIT USAGE
--------------------------------------------------------
CREATE TABLE `customer_credit_usage` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT NOT NULL,
    `usage_date` DATE NOT NULL,
    `credit_consumed` DECIMAL(10,2) DEFAULT 0.00,
    `credit_remaining` DECIMAL(10,2) DEFAULT 0.00,
    `messages_sent` INT DEFAULT 0,
    `messages_received` INT DEFAULT 0,
    `total_cost` DECIMAL(10,2) DEFAULT 0.00,
    `gupshup_fees` DECIMAL(10,2) DEFAULT 0.00,
    `meta_fees` DECIMAL(10,2) DEFAULT 0.00,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------
-- CONTACT
--------------------------------------------------------
CREATE TABLE `contact` (
    `contact_id` BIGINT NOT NULL AUTO_INCREMENT,
    `first_name` VARCHAR(255) DEFAULT NULL,
    `last_name` VARCHAR(50) DEFAULT NULL,
    `country_code` VARCHAR(10),
    `mobile_no` VARCHAR(20) DEFAULT NULL,
    `profile_image` VARCHAR(255) DEFAULT NULL,
    `customer_id` BIGINT DEFAULT NULL,
    `block` TINYINT(1) DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 0,
    `unread_count` INT DEFAULT 0,
    `couponcode` VARCHAR(20),
    `birthday` DATE,
    `anniversary` DATE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`contact_id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------
-- CONTACT GROUP
--------------------------------------------------------
CREATE TABLE `contact_group` (
    `group_id` BIGINT NOT NULL AUTO_INCREMENT,
    `group_name` VARCHAR(255) NOT NULL,
    `customer_id` BIGINT NOT NULL,
    `total_contacts` INT DEFAULT 0,
    `description` VARCHAR(10000),
    `contacts_json` JSON,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`group_id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------
-- BROADCASTS
--------------------------------------------------------
CREATE TABLE `broadcasts` (
    `broadcast_id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT NOT NULL,
    `broadcast_name` VARCHAR(255) NOT NULL,
    `group_id` BIGINT,
    `message_type` VARCHAR(100),
    `contacts_json` JSON,
    `schedule` VARCHAR(10),
    `schedule_date` DATETIME NULL,
    `status` VARCHAR(50),
    `type` VARCHAR(50),
    `template_data` JSON,
    `selected_template` VARCHAR(255),
    `template_id` VARCHAR(255),
    `sent` INT DEFAULT 0,
    `delivered` INT DEFAULT 0,
    `read` INT DEFAULT 0,
    `clicked` INT DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`broadcast_id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`group_id`) REFERENCES `contact_group`(`group_id`) ON DELETE SET NULL ON UPDATE CASCADE
);

--------------------------------------------------------
-- WHATSAPP TEMPLATES
--------------------------------------------------------
CREATE TABLE `whatsapp_templates` (
    `id` CHAR(36) PRIMARY KEY,
    `customer_id` BIGINT NOT NULL,
    `app_id` CHAR(36),
    `waba_id` CHAR(36),
    `element_name` VARCHAR(100),
    `media_url` VARCHAR(255),
    `category` VARCHAR(50),
    `sub_category` VARCHAR(255),
    `language_code` VARCHAR(10),
    `template_type` VARCHAR(20),
    `status` VARCHAR(20),
    `data` longtext,
    `container_meta` JSON,
    `created_on` BIGINT,
    `modified_on` BIGINT,
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------
-- GUPSHUP CONFIGURATION
--------------------------------------------------------
CREATE TABLE `gupshup_configuration` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT NOT NULL,
    `gupshup_id` VARCHAR(36) NOT NULL,
    `token` VARCHAR(255) NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------
-- MESSAGES
--------------------------------------------------------
CREATE TABLE `messages` (
    `message_id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT NOT NULL,
    `contact_id` BIGINT NOT NULL,
    `sender_type` ENUM('shop','guest','system') NOT NULL,
    `sender_id` BIGINT NOT NULL,
    `message_type` ENUM('text','image','template','location','document','audio','video','button') NOT NULL DEFAULT 'text',
    `content` TEXT,
    `element_name` VARCHAR(100),
    `template_data` JSON DEFAULT NULL,
    `media_url` VARCHAR(255) DEFAULT NULL,
    `sent_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `delivered_at` TIMESTAMP NULL DEFAULT NULL,
    `read_at` TIMESTAMP NULL DEFAULT NULL,
    `received_at` TIMESTAMP NULL DEFAULT NULL,
    `status` ENUM('sent','delivered','read','failed','received') NOT NULL DEFAULT 'sent',
    `external_message_id` VARCHAR(100) DEFAULT NULL,
    PRIMARY KEY (`message_id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (`contact_id`) REFERENCES `contact`(`contact_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

--------------------------------------------------------
-- BROADCAST MESSAGES
--------------------------------------------------------
CREATE TABLE `broadcast_messages` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `broadcast_id` BIGINT NOT NULL,
    `message_id` VARCHAR(250) DEFAULT NULL,
    `recipient_id` BIGINT NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `timestamp` BIGINT DEFAULT NULL,
    `error_message` TEXT,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `broadcast_id_idx` (`broadcast_id`),
    FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`broadcast_id`) ON DELETE CASCADE
);
--------------------------------------------------------
-- PAYMENTS
--------------------------------------------------------
CREATE TABLE `payments` (
    `payment_id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT NOT NULL,
    `order_id` VARCHAR(100),
    `razorpay_payment_id` VARCHAR(100),
    `amount` INT,
    `currency` VARCHAR(10),
    `receipt` VARCHAR(100),
    `status` VARCHAR(50),
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`payment_id`),
    FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE `app_daily_usage_billing` (
  `customer_id` bigint NOT NULL,
  `appId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `appName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `partnerId` int DEFAULT NULL,
  `year` int DEFAULT NULL,
  `month` int DEFAULT NULL,
  `day` int DEFAULT NULL,
  `date_ms` bigint DEFAULT NULL,
  `date` date NOT NULL,
  `currency` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT 'USD',
  `gsCap` decimal(10,3) DEFAULT NULL,
  `gsFees` decimal(10,6) DEFAULT NULL,
  `waFees` decimal(10,6) DEFAULT NULL,
  `totalFees` decimal(10,6) DEFAULT NULL,
  `dailyBill` decimal(10,6) DEFAULT NULL,
  `cumulativeBill` decimal(10,6) DEFAULT NULL,
  `discount` decimal(10,6) DEFAULT NULL,
  `totalMsg` int DEFAULT NULL,
  `incomingMsg` int DEFAULT NULL,
  `outgoingMsg` int DEFAULT NULL,
  `outgoingMediaMsg` int DEFAULT NULL,
  `templateMsg` int DEFAULT NULL,
  `templateMediaMsg` int DEFAULT NULL,
  `marketing` int DEFAULT NULL,
  `mmLiteMarketing` int DEFAULT NULL,
  `service` int DEFAULT NULL,
  `utility` int DEFAULT NULL,
  `freeUtility` int DEFAULT NULL,
  `authentication` int DEFAULT NULL,
  `internationalAuthentication` int DEFAULT NULL,
  `voiceInMetaFeeUsage` decimal(10,6) DEFAULT NULL,
  `voiceOutMetaFeeUsage` decimal(10,6) DEFAULT NULL,
  `cxPricingEnabled` tinyint(1) DEFAULT '0',
  `fep` int DEFAULT NULL,
  `ftc` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`,`appId`,`date`),
  CONSTRAINT `fk_customer` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;



CREATE TABLE `wabainfo` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `accountStatus` enum('ACTIVE','BANNED') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT 'ACTIVE',
  `dockerStatus` enum('CONNECTED','DISCONNECTED','FLAGGED','PENDING','RESTRICTED','UNKNOWN') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT 'UNKNOWN',
  `messagingLimit` enum('TIER_50','TIER_250','TIER_1K','TIER_10K','TIER_100K','TIER_NOT_SET','TIER_UNLIMITED') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT 'TIER_NOT_SET',
  `mmLiteStatus` enum('INELIGIBLE','ELIGIBLE','ONBOARDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT 'INELIGIBLE',
  `ownershipType` enum('CLIENT_OWNED','ON_BEHALF_OF','SELF') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT 'CLIENT_OWNED',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `phoneQuality` enum('GREEN','YELLOW','RED','UNKNOWN') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT 'UNKNOWN',
  `throughput` enum('HIGH','STANDARD','NOT_APPLICABLE') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT 'NOT_APPLICABLE',
  `verifiedName` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `wabaId` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `canSendMessage` enum('AVAILABLE','LIMITED','BLOCKED') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT 'LIMITED',
  `timezone` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `errors` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `additionalInfo` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `profile` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `about` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `profileEmail` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `desc` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `vertical` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `website1` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `website2` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `wabaId` (`wabaId`),
  KEY `customer_id` (`customer_id`),
  CONSTRAINT `wabainfo_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customer` (`customer_id`),
  CONSTRAINT `wabainfo_chk_1` CHECK (json_valid(`errors`)),
  CONSTRAINT `wabainfo_chk_2` CHECK (json_valid(`additionalInfo`))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;