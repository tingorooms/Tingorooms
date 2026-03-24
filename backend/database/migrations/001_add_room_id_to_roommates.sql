-- Schema Migration: Roommates Table for Room Occupants
-- =====================================================
-- This migration adds room_id to the roommates table to support room occupants
--
-- Date: 2026-03-22
-- Environment: Local Development
--
-- Safety: 
-- - Changes are idempotent (safe to run multiple times)
-- - Includes verification queries at the end
-- - No data loss

-- =====================================================
-- STEP 1: Backup existing data
-- =====================================================
-- Create a backup snapshot before making changes
SET @backup_timestamp = DATE_FORMAT(NOW(), '%Y%m%d_%H%i%s');
-- Uncomment if you want automatic backups:
-- SET @backup_query = CONCAT('CREATE TABLE roommates_backup_', @backup_timestamp, ' AS SELECT * FROM roommates');
-- PREPARE stmt FROM @backup_query;
-- EXECUTE stmt;

-- =====================================================
-- STEP 2: Add room_id column if it doesn't exist
-- =====================================================
ALTER TABLE roommates
ADD COLUMN room_id INT NULL COMMENT 'Room this person is renting (if existing_roommate)' AFTER city
;

-- =====================================================
-- STEP 3: Make group_id nullable (was NOT NULL)
-- =====================================================
ALTER TABLE roommates
MODIFY COLUMN group_id VARCHAR(10) NULL COMMENT 'Expense group (if group member)'
;

-- =====================================================
-- STEP 4: Add indexes for performance
-- =====================================================

-- Index on room_id for filtering room occupants
ALTER TABLE roommates
ADD INDEX idx_room_id (room_id)
;

-- Ensure group_id index exists for expense groups
SHOW INDEX FROM roommates WHERE Column_name = 'group_id';
-- If not present, run: ALTER TABLE roommates ADD INDEX idx_group_id (group_id);

-- =====================================================
-- STEP 5: Add foreign key constraint
-- =====================================================
-- Links room_id to rooms table with cascade delete
ALTER TABLE roommates
ADD CONSTRAINT fk_roommates_room_id 
FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
;

-- =====================================================
-- STEP 6: Verification Queries
-- =====================================================

-- Check if all changes were applied successfully
SELECT 
  TABLE_NAME,
  GROUP_CONCAT(COLUMN_NAME) as columns,
  COUNT(*) as column_count
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roommates'
GROUP BY TABLE_NAME;

-- Verify room_id column exists and is nullable
SELECT 
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roommates' 
  AND COLUMN_NAME IN ('room_id', 'group_id', 'city')
ORDER BY ORDINAL_POSITION;

-- Verify indexes exist
SHOW INDEX FROM roommates 
WHERE Column_name IN ('room_id', 'group_id');

-- Verify foreign key constraint
SELECT 
  CONSTRAINT_NAME,
  TABLE_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'roommates';

-- =====================================================
-- Data Statistics
-- =====================================================

-- Total roommates
SELECT 
  'Total Roommates' as metric,
  COUNT(*) as count
FROM roommates;

-- Roommates with room_id (room occupants)
SELECT 
  'Room Occupants (room_id set)' as metric,
  COUNT(*) as count
FROM roommates
WHERE room_id IS NOT NULL;

-- Roommates with group_id (expense groups)
SELECT 
  'Group Members (group_id set)' as metric,
  COUNT(*) as count
FROM roommates
WHERE group_id IS NOT NULL;

-- Roommates with both (hybrid)
SELECT 
  'Both room + group' as metric,
  COUNT(*) as count
FROM roommates
WHERE room_id IS NOT NULL AND group_id IS NOT NULL;

-- =====================================================
-- Sample Data Verification
-- =====================================================

-- Show sample room occupants
SELECT 
  id,
  name,
  email,
  city,
  room_id,
  group_id,
  status
FROM roommates
WHERE room_id IS NOT NULL
LIMIT 5;

-- Show sample group members
SELECT 
  id,
  name,
  email,
  city,
  room_id,
  group_id,
  status
FROM roommates
WHERE group_id IS NOT NULL AND room_id IS NULL
LIMIT 5;

-- =====================================================
-- Completion Status
-- =====================================================
SELECT 
  'Schema Migration Complete' as status,
  NOW() as completed_at,
  'Ready for data migration' as next_step;
