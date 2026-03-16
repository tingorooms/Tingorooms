const mysql = require('mysql2/promise');
require('dotenv').config();

const dbSslEnabled = process.env.DB_SSL === 'true';
const dbSslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'room_rental_db',
    ssl: dbSslEnabled ? { rejectUnauthorized: dbSslRejectUnauthorized } : undefined,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// Test connection
const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

const parseInsertTarget = (sql) => {
    const normalizedSql = String(sql || '');
    const match = normalizedSql.match(/insert\s+into\s+`?([a-zA-Z0-9_]+)`?\s*\(([^)]+)\)\s*values\s*\(/i);

    if (!match) {
        return null;
    }

    const tableName = match[1];
    const rawColumns = match[2]
        .split(',')
        .map((part) => part.replace(/`/g, '').trim())
        .filter(Boolean);

    if (rawColumns.length === 0) {
        return null;
    }

    return {
        tableName,
        columns: rawColumns,
    };
};

const tryInsertWithExplicitIdFallback = async (sql, params, originalError) => {
    const missingIdDefault =
        originalError &&
        originalError.code === 'ER_NO_DEFAULT_FOR_FIELD' &&
        originalError.message &&
        originalError.message.includes("Field 'id'");

    if (!missingIdDefault) {
        throw originalError;
    }

    const parsedInsert = parseInsertTarget(sql);
    if (!parsedInsert) {
        throw originalError;
    }

    const { tableName, columns } = parsedInsert;
    if (columns.includes('id')) {
        throw originalError;
    }

    const [maxRows] = await pool.execute(`SELECT COALESCE(MAX(id), 0) AS maxId FROM \`${tableName}\``);
    const nextId = Number(maxRows?.[0]?.maxId || 0) + 1;

    const updatedColumnsSegment = `(${['id', ...columns].map((column) => `\`${column}\``).join(', ')})`;
    const rewrittenSql = String(sql).replace(/\(([^)]+)\)\s*values\s*\(/i, `${updatedColumnsSegment} VALUES (`);
    const rewrittenParams = [nextId, ...(Array.isArray(params) ? params : [])];

    const [results] = await pool.execute(rewrittenSql, rewrittenParams);
    return results;
};

// Ensure all primary-key `id` columns use AUTO_INCREMENT.
// This heals imports where dump files dropped AUTO_INCREMENT defaults.
const ensureAutoIncrementOnPrimaryIds = async () => {
    const candidateColumns = await executeQuery(`
        SELECT TABLE_NAME, COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND COLUMN_NAME = 'id'
          AND COLUMN_KEY = 'PRI'
          AND EXTRA NOT LIKE '%auto_increment%'
    `);

    if (!Array.isArray(candidateColumns) || candidateColumns.length === 0) {
        return { updated: [], skipped: [] };
    }

    const updated = [];
    const skipped = [];

    for (const columnInfo of candidateColumns) {
        const tableName = String(columnInfo.TABLE_NAME || '').trim();
        const columnType = String(columnInfo.COLUMN_TYPE || '').trim();

        if (!tableName || !columnType) {
            continue;
        }

        try {
            await executeQuery(
                `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`id\` ${columnType} NOT NULL AUTO_INCREMENT`
            );
            updated.push(tableName);
        } catch (error) {
            skipped.push({
                tableName,
                reason: error.message
            });
            console.warn(`⚠️  Skipped AUTO_INCREMENT fix for ${tableName}.id: ${error.message}`);
        }
    }

    return { updated, skipped };
};

// Execute query helper
const executeQuery = async (sql, params = []) => {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        try {
            const fallbackResults = await tryInsertWithExplicitIdFallback(sql, params, error);
            return fallbackResults;
        } catch (fallbackError) {
            console.error('Query Error:', fallbackError.message);
            throw fallbackError;
        }
    }
};

// Transaction helper
const withTransaction = async (callback) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    pool,
    testConnection,
    executeQuery,
    withTransaction,
    ensureAutoIncrementOnPrimaryIds
};
