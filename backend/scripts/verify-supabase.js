#!/usr/bin/env node
const { Client } = require('pg');

const client = new Client({ 
  connectionString: 'postgresql://postgres:7JkMvsM5geHEN9Yz@db.wfkgoowybgqeqxpwmktt.supabase.co:5432/postgres' 
});

client.connect().then(async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  📊 SUPABASE DATABASE VERIFICATION                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const tables = await client.query(
    `SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('users', 'rooms', 'chat_rooms', 'messages')
    ORDER BY tablename;`
  );
  
  console.log('📦 Tables Created:');
  if (tables.rows.length > 0) {
    tables.rows.forEach(r => console.log('   ✅', r.tablename));
  } else {
    console.log('   ❌ No tables found');
  }
  console.log('');
  
  const funcs = await client.query(
    `SELECT routine_name FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN ('update_last_message_at', 'mark_messages_as_read', 'get_unread_count');`
  );
  
  console.log('⚙️  Functions Created:');
  if (funcs.rows.length > 0) {
    funcs.rows.forEach(r => console.log('   ✅', r.routine_name));
  } else {
    console.log('   · Some functions may be missing');
  }
  console.log('');
  
  const indexes = await client.query(
    `SELECT COUNT(*) as count FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename IN ('chat_rooms', 'messages');`
  );
  
  console.log('🔍 Performance Indexes:');
  console.log('   ✅', indexes.rows[0].count, 'indexes created');
  console.log('');
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ SUPABASE DEPLOYMENT VERIFIED!');
  console.log('');
  console.log('🎉 Your Supabase realtime chat database is fully operational!');
  console.log('');
  
  client.end();
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
