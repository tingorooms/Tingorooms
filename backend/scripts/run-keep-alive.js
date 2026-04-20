/**
 * Manual Keep-Alive Runner
 *
 * Runs the keep-alive pings manually (same as cron job)
 * Useful for testing or running outside the cron schedule
 */

require('dotenv').config();
const { startKeepAlive } = require('../utils/keepAlive');

// For manual run, we can just call the ping function directly
const { runPings } = require('../utils/keepAlive');

async function main() {
    console.log('🔄 Running manual keep-alive check...');
    await runPings();
    console.log('✅ Manual keep-alive check complete');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Manual keep-alive failed:', err);
    process.exit(1);
});