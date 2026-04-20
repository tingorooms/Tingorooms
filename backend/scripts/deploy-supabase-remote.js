#!/usr/bin/env node
/**
 * Remote Supabase Schema Deployment Script
 * Deploys room_rental_db schema directly to Supabase via API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Supabase Configuration
const config = {
  projectRef: 'wfkgoowyb',
  supabaseUrl: 'https://wfkgoowyb.supabase.co',
  serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma2dvb3d5YmdxZXF4cHdta3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDMxNzc0NSwiZXhwIjoyMDg5ODkzNzQ1fQ.6uT8fBQ3dN6dY6PWvMTEeiGMzHJ4QFvlEUZtWClNCWo'
};

function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${config.supabaseUrl}/rest/v1/rpc/sql`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.serviceKey}`,
        'User-Agent': 'Supabase-Remote-Deploy/1.0'
      }
    };

    const payload = JSON.stringify({ query: sql });
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function deploySql() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 Remote Supabase Schema Deployment                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  console.log(`📍 Project: ${config.projectRef}`);
  console.log(`🔗 URL: ${config.supabaseUrl}`);
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

  try {
    console.log('🔄 Deploying schema to Supabase...');
    console.log('');
    
    const result = await executeSql(sqlContent);
    
    console.log(`📊 Response Status: ${result.status}`);
    console.log('');

    if (result.status === 200 || result.status === 201) {
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
      console.log('🔴 Realtime: ENABLED for live chat updates');
      console.log('');
      console.log('✨ Response:');
      console.log(JSON.stringify(result.body, null, 2));
    } else if (result.status === 207) {
      console.log('⚠️  PARTIAL SUCCESS (207 Multi-Status)');
      console.log('Some statements may have failed. Details:');
      console.log(JSON.stringify(result.body, null, 2));
    } else {
      console.error('❌ DEPLOYMENT FAILED');
      console.error(`Status: ${result.status}`);
      console.error('Response:', JSON.stringify(result.body, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error during deployment:', error.message);
    process.exit(1);
  }
}

// Run deployment
deploySql();
