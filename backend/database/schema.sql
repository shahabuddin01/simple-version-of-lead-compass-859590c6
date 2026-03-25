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

-- Backup Logs
CREATE TABLE IF NOT EXISTS backup_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_size_kb INT,
  record_count INT,
  status VARCHAR(50),
  backup_data LONGTEXT
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

-- Client Communications
CREATE TABLE IF NOT EXISTS client_communications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(255),
  company VARCHAR(255),
  linkedin VARCHAR(500),
  facebook VARCHAR(500),
  instagram VARCHAR(500),
  lead_status ENUM('HOT','WARM','COLD','') DEFAULT '',
  lead_collected_date DATE NULL,
  mail_status ENUM('not_send','mail_sent','follow_up_sent','reply_received','no') DEFAULT 'not_send',
  mail_sent_date DATE NULL,
  comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lead_status (lead_status),
  INDEX idx_mail_status (mail_status),
  INDEX idx_company (company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- DEFAULT ADMIN USER
-- Password: Admin@1234 (bcrypt hash)
-- =========================================
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'admin'),
('Manager', 'manager@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'manager'),
('Employee', 'employee@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'employee'),
('Viewer', 'viewer@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'viewer');
