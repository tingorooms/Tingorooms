/**
 * Migration: Move existing_roommates data to roommates table with room_id
 * 
 * This migration:
 * 1. Copies all existing_roommates records to roommates table with room_id set
 * 2. Maintains data integrity by preserving names and cities
 * 3. Can be run safely and is idempotent
 * 
 * Run: node backend/migrations/001_migrate_existing_roommates_to_roommates.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function migrate() {
  const connection = await pool.getConnection();
  try {
    console.log('🔄 Starting migration: existing_roommates → roommates...');

    // Check if existing_roommates table exists
    const tableCheck = await connection.query(
      "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [process.env.DB_NAME, 'existing_roommates']
    );

    if (tableCheck[0].length === 0) {
      console.log('✅ existing_roommates table does not exist - migration already completed or table never existed');
      return;
    }

    // Count existing records
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as count FROM existing_roommates'
    );
    const recordCount = countResult[0].count;
    console.log(`📊 Found ${recordCount} records in existing_roommates table`);

    // Migrate data - insert into roommates table
    await connection.query(
      `INSERT INTO roommates (room_id, name, email, city, invited_by, group_id, status, created_at)
       SELECT 
         er.room_id,
         er.name,
         CONCAT(LOWER(REPLACE(er.name, ' ', '_')), '_', FLOOR(RAND() * 1000000), '@room-occupant.local') as email,
         er.city,
         (SELECT user_id FROM rooms WHERE id = er.room_id LIMIT 1) as invited_by,
         NULL as group_id,
         'Accepted' as status,
         NOW() as created_at
       FROM existing_roommates er
       WHERE NOT EXISTS (
         SELECT 1 FROM roommates rm 
         WHERE rm.room_id = er.room_id 
         AND LOWER(rm.name) = LOWER(er.name) 
         AND LOWER(COALESCE(rm.city, '')) = LOWER(COALESCE(er.city, ''))
       )
       ON DUPLICATE KEY UPDATE updated_at = NOW();`
    );

    console.log('✅ Successfully migrated data to roommates table');

    // Verify migration
    const [verifyResult] = await connection.query(
      'SELECT COUNT(*) as count FROM roommates WHERE room_id IS NOT NULL'
    );
    const roommateCount = verifyResult[0].count;
    console.log(`✅ Verification: ${roommateCount} room occupants now in roommates table`);

    // Optional: Archive old table (comment out to keep it)
    // await connection.query('RENAME TABLE existing_roommates TO existing_roommates_archived');
    // console.log('📦 Archived existing_roommates → existing_roommates_archived');

    console.log('\n✨ Migration completed successfully!');
    console.log('📝 Note: You can remove the existing_roommates table after verifying the migration');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.release();
    await pool.end();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
