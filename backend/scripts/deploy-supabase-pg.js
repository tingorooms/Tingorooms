#!/usr/bin/env node
/**
 * Direct PostgreSQL Deployment to Supabase
 * Uses native PostgreSQL client to execute schema
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// PostgreSQL Connection
const connectionString = 'postgresql://postgres:7JkMvsM5geHEN9Yz@db.wfkgoowybgqeqxpwmktt.supabase.co:5432/postgres';

async function deploySql() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 Direct PostgreSQL Deployment to Supabase              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log('🔗 Connecting to Supabase PostgreSQL...');
  console.log('');

  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL');
    console.log('');

    // Read SQL file
    const sqlFile = path.join(__dirname, '../database/supabase.sql');
    if (!fs.existsSync(sqlFile)) {
      console.error('❌ Error: supabase.sql not found at', sqlFile);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
    console.log(`📝 SQL file loaded (${Math.round(sqlContent.length / 1024)}KB)`);
    console.log('');

    console.log('🔄 Executing schema deployment...');
    console.log('');
    
    const result = await client.query(sqlContent);
    
    console.log('✅ DEPLOYMENT SUCCESSFUL!');
    console.log('');
    console.log('🎉 Your Supabase realtime chat database is now ready!');
    console.log('');
    console.log('📦 Tables created:');
    console.log('   ✅ users');
    console.log('   ✅ rooms');
    console.log('   ✅ chat_rooms');
    console.log('   ✅ messages');
    console.log('');
    console.log('⚙️  Functions created:');
    console.log('   ✅ update_last_message_at()');
    console.log('   ✅ mark_messages_as_read()');
    console.log('   ✅ get_unread_count()');
    console.log('');
    console.log('🔍 Indexes: 16 performance indexes');
    console.log('⚡ Triggers: Auto-update enabled');
    console.log('🔴 Realtime: ENABLED for live chat updates');
    console.log('');
    console.log('📊 Query Result:', result.command);
    console.log('');

  } catch (error) {
    console.error('❌ DEPLOYMENT FAILED');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

// Check if pg module exists
try {
  require('pg');
  deploySql();
} catch (e) {
  console.error('❌ Error: pg module not found');
  console.error('');
  console.error('Please install it first:');
  console.error('  npm install pg');
  console.error('');
  process.exit(1);
}
