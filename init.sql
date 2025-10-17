-- Create database if not exists
CREATE DATABASE IF NOT EXISTS traffic_management;
USE traffic_management;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NULL,
    role ENUM('citizen', 'lgu_staff', 'traffic_enforcer', 'admin') NOT NULL DEFAULT 'citizen',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
);

-- Create demo users
INSERT IGNORE INTO users (email, username, hashed_password, full_name, role, is_active) VALUES
('admin@example.com', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3wdDEBt2jC', 'System Administrator', 'admin', true),
('staff@example.com', 'staff', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3wdDEBt2jC', 'LGU Staff Member', 'lgu_staff', true),
('enforcer@example.com', 'enforcer', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3wdDEBt2jC', 'Traffic Enforcer', 'traffic_enforcer', true),
('citizen@example.com', 'citizen', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3wdDEBt2jC', 'John Citizen', 'citizen', true);

-- Note: All demo passwords are hashed versions of: 'password123'
