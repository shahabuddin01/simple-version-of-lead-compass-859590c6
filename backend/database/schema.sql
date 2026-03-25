-- NH Production House CRM — Complete MySQL Schema
-- Import via phpMyAdmin after creating your database

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- =========================================
-- CORE AUTH
-- =========================================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','employee','viewer') DEFAULT 'viewer',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user (user_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- LEADS
-- =========================================

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(255),
  company VARCHAR(255),
  industry VARCHAR(255),
  status ENUM('NEW','CONTACTED','QUALIFIED','CONVERTED','LOST','IN_PROGRESS') DEFAULT 'NEW',
  is_active TINYINT(1) DEFAULT 1,
  work_email VARCHAR(255),
  work_email_verified TINYINT(1) DEFAULT 0,
  work_email_verified_at TIMESTAMP NULL,
  work_email_verification_status VARCHAR(50),
  work_esp VARCHAR(100),
  personal_email_1 VARCHAR(255),
  personal_email_1_verified TINYINT(1) DEFAULT 0,
  personal_email_1_verified_at TIMESTAMP NULL,
  personal_email_1_verification_status VARCHAR(50),
  personal_email_1_esp VARCHAR(100),
  personal_email_2 VARCHAR(255),
  personal_email_2_verified TINYINT(1) DEFAULT 0,
  personal_email_2_verified_at TIMESTAMP NULL,
  personal_email_2_verification_status VARCHAR(50),
  personal_email_2_esp VARCHAR(100),
  work_phone VARCHAR(50),
  personal_phone_1 VARCHAR(50),
  personal_phone_2 VARCHAR(50),
  linkedin VARCHAR(500),
  facebook VARCHAR(500),
  instagram VARCHAR(500),
  company_email VARCHAR(255),
  notes TEXT,
  tags TEXT,
  list_source VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company (company),
  INDEX idx_industry (industry),
  INDEX idx_status (status),
  INDEX idx_active (is_active),
  INDEX idx_work_email (work_email),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- EMAIL VERIFICATION CACHE
-- =========================================

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

-- =========================================
-- API CREDENTIALS
-- =========================================

CREATE TABLE IF NOT EXISTS api_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  scope ENUM('full','read_only','read_update_status') DEFAULT 'read_only',
  is_active TINYINT(1) DEFAULT 1,
  expires_at TIMESTAMP NULL,
  last_used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_request_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  api_key_label VARCHAR(255),
  status_code INT,
  ip_address VARCHAR(45),
  response_time_ms INT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_requested_at (requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- BACKUPS
-- =========================================

CREATE TABLE IF NOT EXISTS backup_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_size_kb INT,
  record_count INT,
  status VARCHAR(50),
  backup_data LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- SMTP SETTINGS
-- =========================================

CREATE TABLE IF NOT EXISTS smtp_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host VARCHAR(255),
  port INT DEFAULT 587,
  encryption ENUM('tls','ssl','none') DEFAULT 'tls',
  username VARCHAR(255),
  password VARCHAR(255),
  sender_name VARCHAR(255) DEFAULT 'NH Production House',
  sender_email VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- SECURITY
-- =========================================

CREATE TABLE IF NOT EXISTS security_blocked_ips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  reason VARCHAR(255),
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_permanent TINYINT(1) DEFAULT 0,
  UNIQUE KEY unique_ip (ip_address),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS security_login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_attempted VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  was_successful TINYINT(1) DEFAULT 0,
  INDEX idx_ip (ip_address),
  INDEX idx_attempted_at (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS security_activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  user_email VARCHAR(255),
  action VARCHAR(255),
  resource VARCHAR(255),
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS security_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- CLIENT COMMUNICATION
-- =========================================

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
-- WORKFORCE
-- =========================================

CREATE TABLE IF NOT EXISTS workforce (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(100),
  department VARCHAR(100),
  salary DECIMAL(10,2),
  join_date DATE,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS time_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  check_in TIMESTAMP NULL,
  check_out TIMESTAMP NULL,
  hours_worked DECIMAL(5,2),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================================
-- DEFAULT DATA
-- =========================================

INSERT IGNORE INTO security_settings (setting_key, setting_value) VALUES
  ('auto_block_enabled', '1'),
  ('max_failed_attempts', '5'),
  ('block_window_minutes', '15'),
  ('block_duration_hours', '24'),
  ('session_timeout_minutes', '60'),
  ('cache_enabled', '1'),
  ('cache_duration_days', '14');

-- Default admin user (password: Admin@1234)
INSERT IGNORE INTO users (name, email, password, role) VALUES
  ('Admin', 'admin@nhproductionhouse.com', '$2y$10$8K1p/a0dL1LXMIgoEDFrwO.SANlpYx9Cvp4x8lGOJqUzJrL2YXEOW', 'admin');
