#!/usr/bin/env node
const { Client } = require('pg');

const client = new Client({ 
  connectionString: 'postgresql://postgres:7JkMvsM5geHEN9Yz@db.wfkgoowybgqeqxpwmktt.supabase.co:5432/postgres' 
});

client.connect().then(async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 SUPABASE RAW INVENTORY CHECK                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Check all tables
  const allTables = await client.query(
    `SELECT table_schema, table_name FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'extensions', 'pg_toast')
    ORDER BY table_schema, table_name;`
  );
  
  console.log('📋 All Tables in Database:');
  if (allTables.rows.length > 0) {
    const schemas = {};
    allTables.rows.forEach(row => {
      if (!schemas[row.table_schema]) schemas[row.table_schema] = [];
      schemas[row.table_schema].push(row.table_name);
    });
    Object.entries(schemas).forEach(([schema, tables]) => {
      console.log(`\n   Schema: ${schema}`);
      tables.forEach(t => console.log(`   - ${t}`));
    });
  } else {
    console.log('   ❌ No custom tables found');
  }
  console.log('');
  
  // Check all functions
  const allFuncs = await client.query(
    `SELECT routine_schema, routine_name, routine_type 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    ORDER BY routine_name;`
  );
  
  console.log('🔧 All Functions in public schema:');
  if (allFuncs.rows.length > 0) {
    allFuncs.rows.forEach(r => console.log(`   - ${r.routine_name} (${r.routine_type})`));
  } else {
    console.log('   · No custom functions found');
  }
  console.log('');
  
  // Check all indexes
  const allIndexes = await client.query(
    `SELECT schemaname, indexname, tablename 
    FROM pg_indexes 
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;`
  );
  
  console.log('📑 All Indexes in public schema:');
  if (allIndexes.rows.length > 0) {
    const byTable = {};
    allIndexes.rows.forEach(row => {
      if (!byTable[row.tablename]) byTable[row.tablename] = [];
      byTable[row.tablename].push(row.indexname);
    });
    Object.entries(byTable).forEach(([table, indexes]) => {
      console.log(`\n   ${table}: (${indexes.length} indexes)`);
      indexes.forEach(i => console.log(`   - ${i}`));
    });
  } else {
    console.log('   · No custom indexes found');
  }
  console.log('');
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  client.end();
}).catch(err => {
  console.error('Connection Error:', err.message);
  console.error('Full error:', err);
  process.exit(1);
});
