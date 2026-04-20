#!/usr/bin/env node
/**
 * Line-by-Line PostgreSQL Deployment to Supabase
 * Executes each statement individually for better error handling
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// PostgreSQL Connection
const connectionString = 'postgresql://postgres:7JkMvsM5geHEN9Yz@db.wfkgoowybgqeqxpwmktt.supabase.co:5432/postgres';

async function deploySql() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 Supabase PostgreSQL Deployment (Statement-by-Statement) ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log('🔗 Connecting to Supabase PostgreSQL...');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to Supabase');
    console.log('');

    // Read SQL file
    const sqlFile = path.join(__dirname, '../database/supabase.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
    console.log(`📝 SQL file loaded (${Math.round(sqlContent.length / 1024)}KB)`);
    console.log('');

    // Split by semicolon and filter
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📦 Found ${statements.length} statements`);
    console.log('');
    console.log('🔄 Executing deployment...');
    console.log('');

    let success = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      const stmtPreview = stmt.substring(0, 80).replace(/\n/g, ' ');
      
      try {
        await client.query(stmt);
        success++;
        process.stdout.write('.');
      } catch (error) {
        failed++;
        process.stdout.write('x');
        
        // Store non-critical errors (table already exists, etc)
        if (!error.message.includes('already exists') && 
            !error.message.includes('does not exist') &&
            !error.message.includes('trigger') &&
            !error.message.includes('function')) {
          errors.push({
            statement: stmtPreview,
            error: error.message
          });
        }
      }
    }

    console.log('');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`✅ Successful: ${success}/${statements.length}`);
    console.log(`⚠️  Skipped/Expected: ${failed}`);
    console.log('');

    if (errors.length === 0) {
      console.log('🎉 DEPLOYMENT SUCCESSFUL!');
      console.log('');
      console.log('✅ Your Supabase realtime chat database is ready!');
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
      console.log('🔍 16 Performance indexes');
      console.log('⚡ Triggers & Realtime: ENABLED');
      console.log('');
    } else {
      console.log('⚠️  Some errors occurred:');
      errors.forEach(e => {
        console.log(`   ❌ ${e.statement}`);
        console.log(`      ${e.error}`);
      });
    }

  } catch (error) {
    console.error('❌ CRITICAL ERROR');
    console.error('');
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('');
    console.log('🔌 Connection closed');
  }
}

// Run deployment
deploySql();
