const mysql = require('mysql2/promise');
require('dotenv').config();
const { isProduction } = require('./env');

const dbSslEnabled = process.env.DB_SSL === 'true';
const dbSslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

const dbUrlString = process.env.DB_URL || process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL || process.env.MYSQL_URL;
let dbHost = process.env.DB_HOST || process.env.MYSQL_HOST || process.env.MYSQLHOST || undefined;
let dbPortRaw = process.env.DB_PORT || process.env.MYSQL_PORT || process.env.MYSQLPORT || 3306;
let dbPort = Number(dbPortRaw);
let dbUser = process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQLUSER || undefined;
let dbPassword = process.env.DB_PASSWORD || process.env.DB_PASS || process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || '';
let dbName = process.env.DB_NAME || process.env.MYSQL_DB || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || undefined;

const mysqlUser = process.env.MYSQL_USER || process.env.MYSQLUSER || '';
const mysqlPassword = process.env.MYSQL_PASSWORD || process.env.MYSQLPASSWORD || '';
const mysqlRootPassword = process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQLROOTPASSWORD || '';

if (!Number.isFinite(dbPort) || dbPort <= 0) {
    console.warn(`⚠️  Invalid DB port value '${dbPortRaw}'. Falling back to 3306.`);
    dbPort = 3306;
}

if (
    dbUser &&
    mysqlUser &&
    dbUser === mysqlUser &&
    dbPassword &&
    mysqlRootPassword &&
    dbPassword === mysqlRootPassword &&
    mysqlPassword
) {
    console.warn('⚠️  DB_PASSWORD matches MYSQL_ROOT_PASSWORD while DB_USER matches MYSQL_USER. Using MYSQL_PASSWORD instead to avoid Railway auth mismatch.');
    dbPassword = mysqlPassword;
}

if (dbUrlString) {
    try {
        const dbUrl = new URL(dbUrlString);
        dbHost = dbHost || dbUrl.hostname;
        dbPort = Number(dbUrl.port || dbPort || 3306);
        dbUser = dbUser || decodeURIComponent(dbUrl.username);
        dbPassword = dbPassword || decodeURIComponent(dbUrl.password);
        dbName = dbName || dbUrl.pathname.replace(/^\//, '');

        if (!process.env.DB_HOST || !process.env.DB_PORT || !process.env.DB_USER || !process.env.DB_NAME) {
            console.log('ℹ️  Database config loaded from URL environment variable.');
        }
    } catch (urlError) {
        console.warn('⚠️  Failed to parse database URL. Falling back to DB_HOST/DB_USER/DB_NAME if configured.');
    }
}

if (!dbHost && !dbUrlString && !isProduction) {
    dbHost = '127.0.0.1';
}
if (!dbUser && !dbUrlString && !isProduction) {
    dbUser = 'root';
}
if (!dbName && !dbUrlString && !isProduction) {
    dbName = 'room_rental_db';
}

if (isProduction) {
    const missing = [];
    if (!dbHost) missing.push('DB_HOST/MYSQL_HOST/MYSQLHOST or DB_URL/DATABASE_URL/RAILWAY_DATABASE_URL');
    if (!dbUser) missing.push('DB_USER/MYSQL_USER/MYSQLUSER or DB_URL/DATABASE_URL/RAILWAY_DATABASE_URL');
    if (!dbName) missing.push('DB_NAME/MYSQL_DB/MYSQL_DATABASE/MYSQLDATABASE or DB_URL/DATABASE_URL/RAILWAY_DATABASE_URL');

    if (missing.length > 0) {
        throw new Error(`Missing required production database environment variable(s): ${missing.join(', ')}.`);
    }

    if (dbHost === 'localhost') {
        console.warn('⚠️  DB_HOST is set to localhost in production. Please set DB_HOST to your managed MySQL host to avoid connection failures.');
    }
}

// Create connection pool
const pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000),
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
    const rewrittenSql = String(sql).replace(/\(([^)]+)\)\s*values\s*\(/i, `${updatedColumnsSegment} VALUES (?, `);
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

// Wrap a raw connection so that connection.execute() has the same
// ER_NO_DEFAULT_FOR_FIELD INSERT fallback as executeQuery().
const wrapConnectionWithInsertFallback = (connection) => {
    const safeExecute = async (sql, params = []) => {
        try {
            return await connection.execute(sql, params);
        } catch (error) {
            const missingIdDefault =
                error?.code === 'ER_NO_DEFAULT_FOR_FIELD' &&
                error?.message?.includes("Field 'id'");

            if (!missingIdDefault) throw error;

            const parsed = parseInsertTarget(sql);
            if (!parsed || parsed.columns.includes('id')) throw error;

            const [[maxRow]] = await connection.execute(
                `SELECT COALESCE(MAX(id), 0) AS maxId FROM \`${parsed.tableName}\``
            );
            const nextId = Number(maxRow?.maxId || 0) + 1;

            const updatedCols = `(${['id', ...parsed.columns].map((c) => `\`${c}\``).join(', ')})`;
            const rewritten = String(sql).replace(
                /\(([^)]+)\)\s*values\s*\(/i,
                `${updatedCols} VALUES (?, `
            );
            const rewrittenParams = [nextId, ...(Array.isArray(params) ? params : [])];

            return await connection.execute(rewritten, rewrittenParams);
        }
    };

    // Return a proxy that exposes safeExecute as .execute(), and forwards
    // everything else (query, beginTransaction, commit, rollback, release) as-is.
    return new Proxy(connection, {
        get(target, prop) {
            if (prop === 'execute') return safeExecute;
            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
};

// Transaction helper
const withTransaction = async (callback) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const safeConnection = wrapConnectionWithInsertFallback(connection);
        const result = await callback(safeConnection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const dbConfigSummary = {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    database: dbName,
    usingUrlConfig: Boolean(dbUrlString),
    configSource: dbUrlString ? 'DB_URL/DATABASE_URL/RAILWAY_DATABASE_URL/MYSQL_URL' : 'DB_HOST/DB_USER/DB_NAME'
};

module.exports = {
    pool,
    testConnection,
    executeQuery,
    withTransaction,
    ensureAutoIncrementOnPrimaryIds,
    dbConfigSummary
};
