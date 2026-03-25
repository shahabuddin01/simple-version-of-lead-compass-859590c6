-- NH Production House CRM — MySQL Schema
-- Run this in phpMyAdmin after creating your database

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- Users & Auth
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','employee','viewer') DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(255),
  company VARCHAR(255),
  industry VARCHAR(255),
  status ENUM('NEW','CONTACTED','QUALIFIED','CONVERTED','LOST') DEFAULT 'NEW',
  is_active BOOLEAN DEFAULT true,
  work_email VARCHAR(255),
  work_email_verified BOOLEAN DEFAULT false,
  work_email_verified_at TIMESTAMP NULL,
  work_email_verification_status VARCHAR(50),
  work_esp VARCHAR(100),
  personal_email_1 VARCHAR(255),
  personal_email_1_verified BOOLEAN DEFAULT false,
  personal_email_1_verified_at TIMESTAMP NULL,
  personal_email_1_verification_status VARCHAR(50),
  personal_email_1_esp VARCHAR(100),
  personal_email_2 VARCHAR(255),
  personal_email_2_verified BOOLEAN DEFAULT false,
  personal_email_2_verified_at TIMESTAMP NULL,
  personal_email_2_verification_status VARCHAR(50),
  personal_email_2_esp VARCHAR(100),
  work_phone VARCHAR(50),
  personal_phone_1 VARCHAR(50),
  personal_phone_2 VARCHAR(50),
  notes TEXT,
  tags TEXT,
  list_source VARCHAR(255),
  linkedin VARCHAR(255),
  facebook VARCHAR(255),
  instagram VARCHAR(255),
  company_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_industry (industry),
  INDEX idx_company (company),
  INDEX idx_active (is_active),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Email Verification Cache
CREATE TABLE IF NOT EXISTS email_verification_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_address VARCHAR(255) UNIQUE NOT NULL,
  verification_status VARCHAR(50),
  esp VARCHAR(100),
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_email (email_address),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- API Credentials
CREATE TABLE IF NOT EXISTS api_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(255),
  api_key VARCHAR(255) UNIQUE NOT NULL,
  scope ENUM('full','read_only','read_update_status') DEFAULT 'read_only',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  INDEX idx_key (api_key),
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- API Allowed Origins
CREATE TABLE IF NOT EXISTS api_allowed_origins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(255),
  origin_url VARCHAR(500) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- API Request Logs
CREATE TABLE IF NOT EXISTS api_request_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  api_key_label VARCHAR(255),
  status_code INT,
  ip_address VARCHAR(45),
  response_time_ms INT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_requested (requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backup Logs
CREATE TABLE IF NOT EXISTS backup_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_size_kb INT,
  record_count INT,
  status VARCHAR(50),
  backup_data LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SMTP Settings
CREATE TABLE IF NOT EXISTS smtp_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host VARCHAR(255),
  port INT DEFAULT 587,
  encryption ENUM('tls','ssl','none') DEFAULT 'tls',
  username VARCHAR(255),
  password VARCHAR(255),
  sender_name VARCHAR(255),
  sender_email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Security Settings
CREATE TABLE IF NOT EXISTS security_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Security Blocked IPs
CREATE TABLE IF NOT EXISTS security_blocked_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  reason VARCHAR(255),
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_permanent BOOLEAN DEFAULT false,
  INDEX idx_ip (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Security Login Attempts
CREATE TABLE IF NOT EXISTS security_login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_attempted VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  was_successful BOOLEAN DEFAULT false,
  blocked BOOLEAN DEFAULT false,
  INDEX idx_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Security Activity Log
CREATE TABLE IF NOT EXISTS security_activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  user_email VARCHAR(255),
  action VARCHAR(255),
  resource VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_user (user_id),
  INDEX idx_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Webhooks
CREATE TABLE IF NOT EXISTS api_webhooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  events TEXT NOT NULL,
  secret_key VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Webhook Logs
CREATE TABLE IF NOT EXISTS api_webhook_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  webhook_id INT NOT NULL,
  event VARCHAR(100),
  payload TEXT,
  response_status INT,
  response_body TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (webhook_id) REFERENCES api_webhooks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SMS Queue (jobs waiting to be sent by mobile app)
CREATE TABLE IF NOT EXISTS sms_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lead_id INT,
  lead_name VARCHAR(255),
  phone_number VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  sim_preference ENUM('SIM1','SIM2','ANY') DEFAULT 'ANY',
  status ENUM('PENDING','PICKED','SENT','FAILED','CANCELLED') DEFAULT 'PENDING',
  priority INT DEFAULT 1,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  device_id VARCHAR(100),
  picked_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  failed_at TIMESTAMP NULL,
  failure_reason TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SMS Delivery Reports
CREATE TABLE IF NOT EXISTS sms_delivery_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sms_queue_id INT NOT NULL,
  device_id VARCHAR(100),
  sim_used ENUM('SIM1','SIM2'),
  phone_number VARCHAR(50),
  delivery_status ENUM('DELIVERED','FAILED','PENDING') DEFAULT 'PENDING',
  error_code VARCHAR(50),
  error_message TEXT,
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sms_queue_id) REFERENCES sms_queue(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Registered Mobile Devices
CREATE TABLE IF NOT EXISTS sms_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  sim1_number VARCHAR(50),
  sim2_number VARCHAR(50),
  sim1_carrier VARCHAR(100),
  sim2_carrier VARCHAR(100),
  is_active TINYINT(1) DEFAULT 1,
  last_ping_at TIMESTAMP NULL,
  app_version VARCHAR(20),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SMS Templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  variables TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SMS Settings
CREATE TABLE IF NOT EXISTS sms_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO sms_settings (setting_key, setting_value) VALUES
  ('default_sim', 'ANY'),
  ('max_sms_per_minute', '10'),
  ('retry_delay_minutes', '5'),
  ('poll_interval_seconds', '30');

-- =========================================
-- DEFAULT ADMIN USER
-- Password: Admin@1234 (bcrypt hash)
-- =========================================
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'admin'),
('Manager', 'manager@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'manager'),
('Employee', 'employee@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'employee'),
('Viewer', 'viewer@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'viewer');
