/**
 * Local Database Setup Script for Roommates Refactor
 * 
 * This script:
 * 1. Backs up existing data
 * 2. Applies schema changes to roommates table
 * 3. Adds necessary indexes
 * 4. Verifies the changes
 * 
 * Run: node backend/scripts/setup-local-db.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'room_rental_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}`)
};

async function checkConnection(connection) {
  try {
    const result = await connection.query('SELECT 1');
    return true;
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

async function backupData(connection) {
  log.header('📦 Step 1: Backing up existing data');
  
  try {
    // Check if roommates table exists
    const [tables] = await connection.query(
      "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [process.env.DB_NAME || 'room_rental_db', 'roommates']
    );

    if (tables.length === 0) {
      log.warning('roommates table does not exist yet');
      return;
    }

    // Create backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupTable = `roommates_backup_${timestamp.split('T')[0].replace(/-/g, '')}`;
    
    await connection.query(`CREATE TABLE ${backupTable} AS SELECT * FROM roommates`);
    log.success(`Backed up roommates table to ${backupTable}`);

    // Count records
    const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM roommates');
    log.info(`Backup contains ${count} records`);

  } catch (error) {
    if (error.message.includes('already exists')) {
      log.warning('Backup table already exists for today');
    } else {
      throw error;
    }
  }
}

async function applySchemaChanges(connection) {
  log.header('🔄 Step 2: Applying schema changes to roommates table');

  try {
    // Check if room_id column already exists
    const [[columnExists]] = await connection.query(
      `SELECT 1 FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'roommates' AND COLUMN_NAME = 'room_id'`,
      [process.env.DB_NAME || 'room_rental_db']
    );

    if (columnExists) {
      log.warning('room_id column already exists, skipping...');
    } else {
      log.info('Adding room_id column...');
      
      // Add room_id column after city
      await connection.query(`
        ALTER TABLE roommates
        ADD COLUMN room_id INT NULL COMMENT 'Room this person is renting (if existing_roommate)' 
        AFTER city
      `);
      
      log.success('Added room_id column after city');
    }

    // Check if group_id is already nullable
    const [[groupIdInfo]] = await connection.query(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'roommates' AND COLUMN_NAME = 'group_id'`,
      [process.env.DB_NAME || 'room_rental_db']
    );

    if (groupIdInfo && groupIdInfo.IS_NULLABLE === 'NO') {
      log.info('Making group_id nullable...');
      
      // Make group_id nullable
      await connection.query(`
        ALTER TABLE roommates
        MODIFY COLUMN group_id VARCHAR(10) NULL COMMENT 'Expense group (if group member)'
      `);
      
      log.success('Made group_id nullable');
    } else {
      log.warning('group_id is already nullable, skipping...');
    }

  } catch (error) {
    throw new Error(`Failed to apply schema changes: ${error.message}`);
  }
}

async function addIndexes(connection) {
  log.header('⚡ Step 3: Adding database indexes');

  try {
    // Check if room_id index exists
    const [[indexExists]] = await connection.query(
      `SELECT 1 FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'roommates' AND COLUMN_NAME = 'room_id'`,
      [process.env.DB_NAME || 'room_rental_db']
    );

    if (indexExists) {
      log.warning('Index on room_id already exists, skipping...');
    } else {
      log.info('Creating index on room_id...');
      
      await connection.query(`
        ALTER TABLE roommates
        ADD INDEX idx_room_id (room_id)
      `);
      
      log.success('Created index on room_id for faster queries');
    }

    // Verify other key indexes exist
    const [[groupIdIndex]] = await connection.query(
      `SELECT 1 FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'roommates' AND COLUMN_NAME = 'group_id'`,
      [process.env.DB_NAME || 'room_rental_db']
    );

    if (groupIdIndex) {
      log.info('Index on group_id exists ✓');
    }

  } catch (error) {
    throw new Error(`Failed to add indexes: ${error.message}`);
  }
}

async function addForeignKey(connection) {
  log.header('🔗 Step 4: Adding foreign key constraint');

  try {
    // Check if foreign key already exists
    const [constraints] = await connection.query(`
      SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS 
      WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = 'roommates' 
      AND REFERENCED_TABLE_NAME = 'rooms'
    `, [process.env.DB_NAME || 'room_rental_db']);

    if (constraints.length > 0) {
      log.warning('Foreign key constraint already exists, skipping...');
      return;
    }

    log.info('Adding foreign key constraint...');
    
    await connection.query(`
      ALTER TABLE roommates
      ADD CONSTRAINT fk_roommates_room_id 
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    `);

    log.success('Added foreign key constraint: roommates.room_id → rooms.id');

  } catch (error) {
    if (error.message.includes('Duplicate foreign key') || error.message.includes('FK_NAME')) {
      log.warning('Foreign key already exists');
    } else {
      throw error;
    }
  }
}

async function verifyChanges(connection) {
  log.header('✓ Step 5: Verifying schema changes');

  try {
    // Get table structure
    const [columns] = await connection.query('DESCRIBE roommates');
    
    const hasRoomId = columns.some(col => col.Field === 'room_id');
    const hasGroupId = columns.some(col => col.Field === 'group_id');
    const hasCity = columns.some(col => col.Field === 'city');

    if (hasRoomId) {
      log.success('✓ room_id column exists');
    } else {
      throw new Error('room_id column not found!');
    }

    if (hasCity) {
      log.success('✓ city column exists');
    }

    if (hasGroupId) {
      log.success('✓ group_id column exists');
    }

    // Count data
    const [[{ total }]] = await connection.query('SELECT COUNT(*) as total FROM roommates');
    log.info(`Total roommates records: ${total}`);

    // Count room occupants (room_id IS NOT NULL)
    const [[{ roomOccupants }]] = await connection.query(
      'SELECT COUNT(*) as roomOccupants FROM roommates WHERE room_id IS NOT NULL'
    );
    log.info(`Room occupants (room_id set): ${roomOccupants}`);

    // Count group members (group_id IS NOT NULL)
    const [[{ groupMembers }]] = await connection.query(
      'SELECT COUNT(*) as groupMembers FROM roommates WHERE group_id IS NOT NULL'
    );
    log.info(`Group members (group_id set): ${groupMembers}`);

    // Show sample data
    const [samples] = await connection.query(
      'SELECT id, name, city, room_id, group_id FROM roommates LIMIT 3'
    );
    
    if (samples.length > 0) {
      log.info('Sample records:');
      console.table(samples);
    }

  } catch (error) {
    throw new Error(`Verification failed: ${error.message}`);
  }
}

async function main() {
  const connection = await pool.getConnection();
  
  try {
    log.header('🚀 LOCAL DATABASE SETUP - Roommates Refactor');
    log.info(`Database: ${process.env.DB_NAME || 'room_rental_db'}`);
    log.info(`Host: ${process.env.DB_HOST || 'localhost'}`);
    log.info(`Port: ${process.env.DB_PORT || 3306}`);

    // Check connection
    log.info('Testing database connection...');
    await checkConnection(connection);
    log.success('Connected to database');

    // Run setup steps
    await backupData(connection);
    await applySchemaChanges(connection);
    await addIndexes(connection);
    await addForeignKey(connection);
    await verifyChanges(connection);

    log.header('✨ Setup completed successfully!');
    log.info('Next step: Run the migration script');
    log.info('Command: node backend/migrations/001_migrate_existing_roommates_to_roommates.js');

  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await connection.release();
    await pool.end();
  }
}

// Run setup
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
