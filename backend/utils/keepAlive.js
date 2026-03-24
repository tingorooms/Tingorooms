/**
 * Keep-Alive Service
 *
 * Prevents Planetscale and Supabase free-tier projects from pausing
 * due to inactivity. Both services pause after ~7 days with no traffic.
 *
 * This module sends a lightweight ping to each service every 5 days.
 * It runs entirely inside the backend process — no extra infra needed.
 */

const cron = require('node-cron');
const { testConnection } = require('../config/database');

// Ping the MySQL/Planetscale database
const pingDatabase = async () => {
    try {
        const ok = await testConnection();
        if (ok) {
            console.log('[KeepAlive] Database ping OK');
        } else {
            console.warn('[KeepAlive] Database ping returned false — check DB connection');
        }
    } catch (err) {
        console.error('[KeepAlive] Database ping error:', err.message);
    }
};

// Ping Supabase with a minimal query to keep project active
const pingSupabase = async () => {
    try {
        // Lazy-require so this fails gracefully if Supabase is not configured
        const { getSupabaseAdmin } = require('../config/supabase');
        const supabase = getSupabaseAdmin();

        // Minimal read — does not return data, just keeps the project alive
        const { error } = await supabase
            .from('messages')
            .select('id')
            .limit(1);

        if (error) {
            // Not a fatal error — table may be empty or auth differs
            console.warn('[KeepAlive] Supabase ping warning:', error.message);
        } else {
            console.log('[KeepAlive] Supabase ping OK');
        }
    } catch (err) {
        if (err.message === 'Supabase admin not initialized') {
            // Supabase is not configured in this environment — skip silently
            return;
        }
        console.error('[KeepAlive] Supabase ping error:', err.message);
    }
};

// Run both pings together
const runPings = async () => {
    console.log('[KeepAlive] Running keep-alive pings...');
    await pingDatabase();
    await pingSupabase();
};

/**
 * Start the keep-alive scheduler.
 * Should be called once after the server starts.
 *
 * Schedule: once per day at 03:15 UTC
 * Cron pattern: "15 3 * * *"
 * This is well within the 7-day inactivity window of both services.
 */
const startKeepAlive = () => {
     // Daily schedule can be overridden by KEEP_ALIVE_CRON if needed
     const cronPattern = process.env.KEEP_ALIVE_CRON || '15 3 * * *';
     cron.schedule(cronPattern, runPings);

    // Run a connectivity check 20 seconds after startup to catch
    // misconfigured env variables early in the logs
    setTimeout(runPings, 20000);

    console.log(`✅ Keep-alive scheduler started (DB + Supabase ping via cron: ${cronPattern})`);
};

module.exports = { startKeepAlive };
