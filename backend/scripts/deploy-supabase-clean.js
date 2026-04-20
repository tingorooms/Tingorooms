#!/usr/bin/env node
/**
 * Supabase Deployment - Clean Full Deployment
 * Ensures all tables and functions are in the PUBLIC schema
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const connectionString = 'postgresql://postgres:7JkMvsM5geHEN9Yz@db.wfkgoowybgqeqxpwmktt.supabase.co:5432/postgres';

// Individual SQL statements for each object
const deploymentStatements = [
  // Set schema
  `SET search_path = public;`,

  // Drop existing (if any)
  `DROP TRIGGER IF EXISTS trigger_update_last_message ON messages CASCADE;`,
  `DROP FUNCTION IF EXISTS update_last_message_at() CASCADE;`,
  `DROP FUNCTION IF EXISTS mark_messages_as_read(text, bigint) CASCADE;`,
  `DROP FUNCTION IF EXISTS get_unread_count(bigint) CASCADE;`,
  `DROP TABLE IF EXISTS messages CASCADE;`,
  `DROP TABLE IF EXISTS chat_rooms CASCADE;`,
  `DROP TABLE IF EXISTS rooms CASCADE;`,
  `DROP TABLE IF EXISTS users CASCADE;`,

  // Create users table
  `CREATE TABLE IF NOT EXISTS users (
    id bigint PRIMARY KEY,
    name text NOT NULL,
    profile_image text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );`,

  // Create rooms table
  `CREATE TABLE IF NOT EXISTS rooms (
    id bigint PRIMARY KEY,
    room_id text NOT NULL,
    title text NOT NULL,
    images jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );`,

  // Create chat_rooms table
  `CREATE TABLE IF NOT EXISTS chat_rooms (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id text NOT NULL UNIQUE,
    room_listing_id bigint NULL REFERENCES rooms(id) ON DELETE SET NULL,
    participant_1 bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_2 bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    last_message_at timestamptz,
    is_active boolean DEFAULT true,
    is_starred boolean DEFAULT false,
    CONSTRAINT unique_chat_per_listing UNIQUE (room_listing_id, participant_1, participant_2)
  );`,

  // Create messages table
  `CREATE TABLE IF NOT EXISTS messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chat_room_id text NOT NULL REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
    sender_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message text NOT NULL,
    message_type varchar(20) DEFAULT 'text',
    read_at timestamptz,
    created_at timestamptz DEFAULT now()
  );`,

  // Create function: update_last_message_at
  `CREATE OR REPLACE FUNCTION update_last_message_at()
  RETURNS TRIGGER AS $$
  BEGIN
    UPDATE chat_rooms SET last_message_at = now() WHERE room_id = NEW.chat_room_id;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;`,

  // Create function: mark_messages_as_read
  `CREATE OR REPLACE FUNCTION mark_messages_as_read(p_chat_room_id text, p_reader_id bigint)
  RETURNS void AS $$
  BEGIN
    UPDATE messages 
    SET read_at = now()
    WHERE chat_room_id = p_chat_room_id 
    AND sender_id != p_reader_id 
    AND read_at IS NULL;
  END;
  $$ LANGUAGE plpgsql;`,

  // Create function: get_unread_count
  `CREATE OR REPLACE FUNCTION get_unread_count(p_user_id bigint)
  RETURNS bigint AS $$
  BEGIN
    RETURN (
      SELECT COUNT(*) FROM messages
      WHERE chat_room_id IN (
        SELECT room_id FROM chat_rooms 
        WHERE (participant_1 = p_user_id OR participant_2 = p_user_id)
      )
      AND sender_id != p_user_id
      AND read_at IS NULL
    );
  END;
  $$ LANGUAGE plpgsql;`,

  // Create trigger
  `CREATE TRIGGER trigger_update_last_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_last_message_at();`,

  // Create indexes
  `CREATE INDEX IF NOT EXISTS idx_chat_rooms_participants ON chat_rooms(participant_1, participant_2);`,
  `CREATE INDEX IF NOT EXISTS idx_chat_rooms_room_id ON chat_rooms(room_id);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_chat_room ON messages(chat_room_id);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at);`,
  `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`,

  // Enable realtime
  `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`,
  `ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;`
];

async function deploy() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🚀 SUPABASE CLEAN DEPLOYMENT (PUBLIC SCHEMA)             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to Supabase PostgreSQL');
    console.log('');
    console.log(`📋 Running ${deploymentStatements.length} statements...`);
    console.log('');

    let success = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < deploymentStatements.length; i++) {
      const stmt = deploymentStatements[i];
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ') + (stmt.length > 60 ? '...' : '');
      
      try {
        await client.query(stmt);
        success++;
        process.stdout.write('✓');
      } catch (error) {
        failed++;
        process.stdout.write('✗');
        errors.push({
          statement: preview,
          error: error.message
        });
      }
      
      // Line break every 50 characters
      if ((i + 1) % 50 === 0) {
        console.log('');
      }
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`✅ Success: ${success} statements`);
    console.log(`❌ Failed: ${failed} statements`);
    console.log('');

    if (errors.length > 0) {
      console.log('📋 Errors:');
      errors.forEach(err => {
        console.log(`   Statement: ${err.statement}`);
        console.log(`   Error: ${err.error}`);
        console.log('');
      });
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('');
    console.log('Check the results above and verify all tables were created.');
    console.log('');

    client.end();
  } catch (err) {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
  }
}

deploy();
