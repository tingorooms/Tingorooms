-- Room Rental & Expense Management System - Database Schema
-- MySQL Database

-- Create Database
CREATE DATABASE IF NOT EXISTS room_rental_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE room_rental_db;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unique_id VARCHAR(20) NOT NULL UNIQUE COMMENT 'Auto-generated ID like P1144R',
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    contact VARCHAR(20) NOT NULL,
    contact_visibility ENUM('Private', 'Public') DEFAULT 'Private' COMMENT 'Privacy setting for contact number',
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    city VARCHAR(100) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin', 'Member', 'Broker') DEFAULT 'Member',
    broker_area VARCHAR(255) NULL COMMENT 'Area covered by broker',
    broker_status ENUM('Pending', 'Approved', 'Hold', 'Rejected', 'Suspended') DEFAULT NULL COMMENT 'For broker approval and suspension control',
    selected_plan_id INT NULL COMMENT 'Plan selected by broker during registration',
    admin_remark TEXT NULL COMMENT 'Admin remark for broker approval',
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(10) NULL,
    otp_expires_at DATETIME NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    ip_address VARCHAR(45) NULL,
    device_info VARCHAR(255) NULL,
    profile_image VARCHAR(500) NULL,
    status ENUM('Active', 'Inactive', 'Suspended') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_unique_id (unique_id),
    INDEX idx_broker_status (broker_status),
    INDEX idx_broker_selected_plan (selected_plan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CONTACT LEADS TABLE
-- ============================================
CREATE TABLE contact_leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    source_page VARCHAR(120) NULL,
    status ENUM('New', 'In Progress', 'Closed', 'Spam') NOT NULL DEFAULT 'New',
    admin_remark TEXT NULL,
    is_spam BOOLEAN NOT NULL DEFAULT FALSE,
    spam_score INT NOT NULL DEFAULT 0,
    spam_reason VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_contact_leads_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_contact_leads_status (status),
    INDEX idx_contact_leads_email (email),
    INDEX idx_contact_leads_spam (is_spam),
    INDEX idx_contact_leads_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ROOMS TABLE
-- ============================================
CREATE TABLE rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id VARCHAR(20) NOT NULL UNIQUE COMMENT 'Auto-generated ID like R0414N',
    user_id INT NOT NULL COMMENT 'Owner who posted the room',
    listing_type ENUM('For Rent', 'Required Roommate', 'For Sell') NOT NULL,
    title VARCHAR(255) NOT NULL,
    room_type ENUM('1RK', '1BHK', '2BHK', '3BHK', '4BHK', 'PG', 'Dormitory', 'Studio', 'Other') NOT NULL,
    house_type ENUM('Flat', 'Apartment', 'House') NOT NULL,
    availability_from DATE NOT NULL,
    rent DECIMAL(12, 2) NULL COMMENT 'For Rent/Roommate',
    deposit DECIMAL(12, 2) NULL COMMENT 'For Rent/Roommate',
    cost DECIMAL(15, 2) NULL COMMENT 'For Sell',
    size_sqft INT NULL COMMENT 'For Sell - size in sqft',
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'Pune',
    area VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    contact VARCHAR(20) NOT NULL,
    contact_visibility ENUM('Private', 'Public') DEFAULT 'Private' COMMENT 'Privacy setting for contact number',
    email VARCHAR(150) NULL,
    preferred_gender ENUM('Male', 'Female', 'Any') NULL COMMENT 'For Rent/Roommate',
    furnishing_type ENUM('Furnished', 'Semi-furnished', 'Unfurnished') NOT NULL,
    facilities JSON NULL COMMENT 'Array of selected facilities',
    note TEXT NULL,
    plan_type VARCHAR(50) NOT NULL,
    plan_amount DECIMAL(10, 2) NULL,
    images JSON NOT NULL COMMENT 'Array of image URLs',
    status ENUM('Pending', 'Approved', 'Hold', 'Rejected', 'Expired') DEFAULT 'Pending',
    admin_remark TEXT NULL,
    views_count INT DEFAULT 0,
    post_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL COMMENT 'Soft delete timestamp - NULL means not deleted',
    expiry_date TIMESTAMP NULL COMMENT 'Auto-expire if no response in 72hrs',
    is_occupied BOOLEAN DEFAULT FALSE,
    occupied_by INT NULL,
    meta_data JSON NULL COMMENT 'Additional metadata',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_listing_type (listing_type),
    INDEX idx_city_area (city, area),
    INDEX idx_post_date (post_date),
    INDEX idx_deleted_at (deleted_at),
    FULLTEXT INDEX idx_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- EXISTING ROOMMATES TABLE
-- ============================================
CREATE TABLE existing_roommates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    INDEX idx_room_id (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ROOMMATE GROUPS TABLE
-- ============================================
CREATE TABLE roommate_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id VARCHAR(10) NOT NULL UNIQUE COMMENT '5 alphanumeric chars',
    group_name VARCHAR(100) NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ROOMMATES TABLE (Group Members)
-- ============================================
CREATE TABLE roommates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL COMMENT 'If registered user',
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    contact VARCHAR(20) NULL,
    city VARCHAR(100) NULL,
    room_id INT NULL COMMENT 'Room this person is renting (if existing_roommate)',
    group_id VARCHAR(10) NULL COMMENT 'Expense group (if group member)',
    group_name VARCHAR(100) NULL,
    linked_user_id INT NULL COMMENT 'Linked to users table if registered',
    invite_token VARCHAR(255) NULL,
    invited_by INT NOT NULL,
    invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP NULL,
    status ENUM('Pending', 'Accepted', 'Declined') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_room_id (room_id),
    INDEX idx_group_id (group_id),
    INDEX idx_email (email),
    INDEX idx_invite_token (invite_token),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- EXPENSES TABLE
-- ============================================
CREATE TABLE expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    cost DECIMAL(12, 2) NOT NULL,
    expense_date DATE NOT NULL,
    paid_by INT NOT NULL COMMENT 'User who paid',
    group_id VARCHAR(10) NOT NULL,
    split_type ENUM('Equal', 'Custom') DEFAULT 'Equal',
    due_date DATE NULL,
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMP NULL,
    notes TEXT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_expense_id (expense_id),
    INDEX idx_group_id (group_id),
    INDEX idx_paid_by (paid_by),
    INDEX idx_expense_date (expense_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- EXPENSE SPLITS TABLE
-- ============================================
CREATE TABLE expense_splits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_id INT NOT NULL,
    roommate_id INT NOT NULL COMMENT 'Reference to roommates table',
    amount DECIMAL(12, 2) NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP NULL,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    INDEX idx_expense_id (expense_id),
    INDEX idx_roommate_id (roommate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CHAT ROOMS TABLE (For Supabase sync)
-- ============================================
CREATE TABLE chat_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id VARCHAR(50) NOT NULL UNIQUE,
    room_listing_id INT NULL COMMENT 'Reference to rooms table if room-related',
    participant_1 INT NOT NULL,
    participant_2 INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_starred BOOLEAN DEFAULT FALSE COMMENT 'User can star up to 5 conversations',
    FOREIGN KEY (room_listing_id) REFERENCES rooms(id) ON DELETE SET NULL,
    FOREIGN KEY (participant_1) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_2) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_room_id (room_id),
    INDEX idx_participants (participant_1, participant_2),
    INDEX idx_room_listing (room_listing_id),
    INDEX idx_is_starred (participant_1, participant_2, is_starred),
    INDEX idx_starred_p1 (participant_1, is_starred),
    INDEX idx_starred_p2 (participant_2, is_starred),
    INDEX idx_last_message (last_message_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MESSAGES TABLE (For Supabase sync)
-- ============================================
CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chat_room_id VARCHAR(50) NOT NULL,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_chat_room (chat_room_id),
    INDEX idx_sender (sender_id),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_unread (chat_room_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('Room_Approved', 'Room_Rejected', 'Room_Expired', 'Broker_Approved', 'Expense_Due', 'Chat_Message', 'Roommate_Invite', 'System') NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    reference_id VARCHAR(50) NULL,
    reference_type VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ADS TABLE
-- ============================================
CREATE TABLE ads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    banner_title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    images_json JSON NULL,
    priority INT NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ads_active_dates (is_active, start_date, end_date),
    INDEX idx_ads_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PLANS TABLE (For room posting plans)
-- ============================================
CREATE TABLE plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    plan_code VARCHAR(50) NOT NULL UNIQUE,
    plan_type ENUM('Regular', 'Broker') DEFAULT 'Regular',
    description TEXT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_days INT NOT NULL,
    features JSON NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_plan_code (plan_code),
    INDEX idx_plan_type (plan_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
ADD CONSTRAINT fk_users_selected_plan
FOREIGN KEY (selected_plan_id) REFERENCES plans(id);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_id INT NOT NULL,
    room_id INT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL,
    starts_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    payment_status ENUM('Pending', 'Completed', 'Rejected', 'Suspended', 'Failed', 'Refunded') DEFAULT 'Pending',
    transaction_id VARCHAR(255) NULL,
    admin_remark TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert default Admin user (password: admin123 - change in production)
INSERT INTO users (unique_id, name, email, contact, gender, pincode, password_hash, role, is_verified, status) 
VALUES ('A00001', 'System Admin', 'admin@gmail.com', '9999999999', 'Male', '411001', '$2b$10$YourHashedPasswordHere', 'Admin', TRUE, 'Active');

-- Insert default plans
INSERT INTO plans (plan_name, plan_code, plan_type, description, price, duration_days, features) VALUES
('Basic', 'BASIC', 'Regular', 'Basic listing for 15 days', 0.00, 15, '["15 days visibility", "Basic support"]'),
('Standard', 'STANDARD', 'Regular', 'Standard listing for 30 days with priority', 199.00, 30, '["30 days visibility", "Priority listing", "Email support"]'),
('Premium', 'PREMIUM', 'Regular', 'Premium listing for 60 days with featured tag', 499.00, 60, '["60 days visibility", "Featured tag", "Priority support", "WhatsApp notifications"]'),
('Gold', 'GOLD', 'Regular', 'Gold listing for 90 days with all features', 999.00, 90, '["90 days visibility", "Featured tag", "Top priority", "24/7 support", "Analytics dashboard"]'),

('Broker Monthly', 'BROKER_MONTHLY', 'Broker', 'Monthly broker subscription with unlimited listings', 999.00, 30,
 '["Unlimited room postings", "Auto-approved listings", "Premium plan for all rooms", "Edit rooms anytime", "Featured listings", "Priority support", "Analytics dashboard"]'),
('Broker Quarterly', 'BROKER_QUARTERLY', 'Broker', 'Quarterly broker subscription with unlimited listings', 2499.00, 90,
 '["Unlimited room postings", "Auto-approved listings", "Premium plan for all rooms", "Edit rooms anytime", "Featured listings", "Priority support", "Analytics dashboard", "10% savings"]'),
('Broker Yearly', 'BROKER_YEARLY', 'Broker', 'Yearly broker subscription with unlimited listings', 8999.00, 365,
 '["Unlimited room postings", "Auto-approved listings", "Premium plan for all rooms", "Edit rooms anytime", "Featured listings", "Priority support", "Analytics dashboard", "25% savings", "Dedicated account manager"]');

-- Insert Maharashtra cities reference data
CREATE TABLE maharashtra_cities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_city_name (city_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO maharashtra_cities (city_name, district) VALUES
('Pune', 'Pune'),
('Mumbai', 'Mumbai'),
('Nagpur', 'Nagpur'),
('Nashik', 'Nashik'),
('Thane', 'Thane'),
('Kalyan', 'Thane'),
('Navi Mumbai', 'Mumbai'),
('Aurangabad', 'Aurangabad'),
('Solapur', 'Solapur'),
('Kolhapur', 'Kolhapur'),
('Sangli', 'Sangli'),
('Satara', 'Satara'),
('Ahmednagar', 'Ahmednagar'),
('Jalgaon', 'Jalgaon'),
('Latur', 'Latur'),
('Chandrapur', 'Chandrapur'),
('Nanded', 'Nanded'),
('Malegaon', 'Nashik'),
('Akola', 'Akola'),
('Dhule', 'Dhule'),
('Jalna', 'Jalna'),
('Bhusawal', 'Jalgaon'),
('Navi Mumbai Panvel', 'Raigad'),
('Panvel', 'Raigad'),
('Ulhasnagar', 'Thane'),
('Vasai-Virar', 'Palghar'),
('Pimpri-Chinchwad', 'Pune'),
('Nigdi', 'Pune'),
('Hinjewadi', 'Pune'),
('Wakad', 'Pune'),
('Baner', 'Pune'),
('Aundh', 'Pune'),
('Kothrud', 'Pune'),
('Kharadi', 'Pune'),
('Viman Nagar', 'Pune'),
('Magarpatta', 'Pune'),
('Hadapsar', 'Pune'),
('Koregaon Park', 'Pune'),
('Camp', 'Pune'),
('Deccan', 'Pune'),
('Shivaji Nagar', 'Pune');

-- ============================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================

-- View for today's registrations
CREATE VIEW vw_today_registrations AS
SELECT * FROM users 
WHERE DATE(registration_date) = CURDATE();

-- View for today's room posts
CREATE VIEW vw_today_rooms AS
SELECT * FROM rooms 
WHERE DATE(post_date) = CURDATE();

-- View for pending brokers
CREATE VIEW vw_pending_brokers AS
SELECT * FROM users 
WHERE role = 'Broker' AND broker_status = 'Pending';

-- View for pending rooms
CREATE VIEW vw_pending_rooms AS
SELECT r.*, u.name as owner_name, u.contact as owner_contact, u.email as owner_email
FROM rooms r
JOIN users u ON r.user_id = u.id
WHERE r.status = 'Pending';

-- View for dashboard statistics
CREATE VIEW vw_dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM rooms) as total_rooms,
    (SELECT COUNT(*) FROM rooms WHERE status = 'Approved') as approved_rooms,
    (SELECT COUNT(*) FROM rooms WHERE status = 'Pending') as pending_rooms,
    (SELECT COUNT(*) FROM rooms WHERE is_occupied = TRUE) as occupied_rooms,
    (SELECT COUNT(*) FROM users WHERE role = 'Member') as total_members,
    (SELECT COUNT(*) FROM users WHERE role = 'Broker' AND broker_status = 'Approved') as approved_brokers,
    (SELECT COUNT(*) FROM users WHERE role = 'Broker' AND broker_status = 'Pending') as pending_brokers,
    (SELECT COUNT(*) FROM users WHERE DATE(registration_date) = CURDATE()) as today_registrations,
    (SELECT COUNT(*) FROM rooms WHERE DATE(post_date) = CURDATE()) as today_rooms;
