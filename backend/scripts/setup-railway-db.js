/**
 * Railway Database Setup Script
 *
 * This script imports the local.sql schema into Railway MySQL database
 * using the provided credentials.
 *
 * Run: node backend/scripts/setup-railway-db.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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

// Railway database credentials (using public URL for local setup)
const dbConfig = {
  host: 'interchange.proxy.rlwy.net',
  port: 34015,
  user: 'root',
  password: 'iNBRaRmvSumvFKDIwXmqUnsJycLckJuM',
  database: 'railway',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
  connectTimeout: 60000,
  multipleStatements: true
};

async function testConnection() {
  log.header('Testing Railway Database Connection');

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    log.success('Connected to Railway database successfully');

    // Test query
    const [rows] = await connection.execute('SELECT VERSION() as version, DATABASE() as current_db');
    log.info(`MySQL Version: ${rows[0].version}`);
    log.info(`Current Database: ${rows[0].current_db}`);

    return connection;
  } catch (error) {
    log.error(`Database connection failed: ${error.message}`);
    throw error;
  }
}

async function readAndModifySQL() {
  log.header('Reading and Modifying SQL Schema');

  const sqlPath = path.join(__dirname, '..', 'database', 'local.sql');

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${sqlPath}`);
  }

  let sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // Replace database creation and USE statements
  sqlContent = sqlContent.replace(
    /CREATE DATABASE IF NOT EXISTS room_rental_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\s*USE room_rental_db;/g,
    '-- Database already exists (railway), using it directly\n'
  );

  // Remove any remaining USE statements
  sqlContent = sqlContent.replace(/USE room_rental_db;/g, '-- Using railway database');

  log.success('SQL file read and modified successfully');
  log.info(`SQL content length: ${sqlContent.length} characters`);

  return sqlContent;
}

async function executeSQL(connection, sqlContent) {
  log.header('Executing SQL Schema');

  try {
    // Execute the entire SQL content as multiple statements
    // Since multipleStatements is enabled, this should work
    await connection.query(sqlContent);
    log.success('SQL schema executed successfully');
    return { executedCount: 1, errorCount: 0 };
  } catch (error) {
    log.error(`SQL execution failed: ${error.message}`);

    // If it fails, try to get more details about what went wrong
    log.error('Full error details:');
    console.error(error);

    return { executedCount: 0, errorCount: 1 };
  }
}

async function verifyTables(connection) {
  log.header('Verifying Database Tables');

  try {
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE '%'"
    );

    if (tables.length === 0) {
      log.warning('No tables found in database');
      return false;
    }

    log.success(`Found ${tables.length} tables:`);
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`  ${index + 1}. ${tableName}`);
    });

    // Check for key tables
    const expectedTables = ['users', 'rooms', 'contact_leads', 'messages'];
    const existingTables = tables.map(table => Object.values(table)[0]);

    const missingTables = expectedTables.filter(table =>
      !existingTables.includes(table)
    );

    if (missingTables.length > 0) {
      log.warning(`Missing expected tables: ${missingTables.join(', ')}`);
      return false;
    }

    log.success('All expected tables are present');
    return true;

  } catch (error) {
    log.error(`Table verification failed: ${error.message}`);
    return false;
  }
}

async function main() {
  let connection;

  try {
    log.header('🚀 Railway Database Setup Starting');

    // Test connection
    connection = await testConnection();

    // Read and modify SQL
    const sqlContent = await readAndModifySQL();

    // Execute SQL
    const result = await executeSQL(connection, sqlContent);

    // Verify tables
    const tablesOk = await verifyTables(connection);

    log.header('🎉 Setup Complete');

    if (result.errorCount === 0 && tablesOk) {
      log.success('Railway database setup completed successfully!');
      log.info('You can now configure your Railway backend environment variables:');
      console.log(`
DB_HOST=mysql.railway.internal
DB_PORT=3306
DB_USER=root
DB_PASSWORD=iNBRaRmvSumvFKDIwXmqUnsJycLckJuM
DB_NAME=railway
      `);
    } else {
      log.warning('Setup completed with some issues. Please check the logs above.');
    }

  } catch (error) {
    log.error(`Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      log.info('Database connection closed');
    }
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch(error => {
    log.error(`Script execution failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };