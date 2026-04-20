#!/usr/bin/env node
/**
 * Supabase Schema Deployment Script
 * Deploys room_rental_db schema to Supabase PostgreSQL
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Supabase Configuration
const config = {
  projectRef: 'wfkgoowyb',
  supabaseUrl: 'https://wfkgoowyb.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma2dvb3d5YmdxZXF4cHdta3R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc3NDUsImV4cCI6MjA4OTg5Mzc0NX0.G_xLQ2yvDTB0TomliNI1zh0qjgBJqzwCNk_ZfRSjMRM',
  serviceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indma2dvb3d5YmdxZXF4cHdta3R0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDMxNzc0NSwiZXhwIjoyMDg5ODkzNzQ1fQ.6uT8fBQ3dN6dY6PWvMTEeiGMzHJ4QFvlEUZtWClNCWo'
};

function makeRequest(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.supabaseUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Supabase-Deployment-Script/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function deploySql() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🚀 Supabase Schema Deployment Script                   ║');
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

  // Split SQL into individual statements
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📦 Found ${statements.length} SQL statements to execute`);
  console.log('');
  console.log('⚠️  NOTE: Manual deployment is recommended via Supabase Dashboard');
  console.log('');
  console.log('📋 SQL Content for Manual Deployment:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(sqlContent);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔗 Open Supabase SQL Editor:');
  console.log(`   👉 ${config.supabaseUrl}/dashboard/sql/new`);
  console.log('');
  console.log('1. Paste the SQL content above');
  console.log('2. Click "RUN" button');
  console.log('3. Wait for "Success" message');
  console.log('');
  console.log('✅ After deployment, your Supabase chat database will be ready!');
}

// Run deployment
deploySql().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
