#!/usr/bin/env node
/**
 * Create Admin User in Railway MySQL Database
 * Hashes password with bcrypt before storing
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const adminData = {
  email: 'admin1@gmail.com',
  name: 'Admin User',
  password: 'Admin1432@gmail.com',
  contact: '9876543210',
  gender: 'Other',
  pincode: '100000'
};

const config = {
  host: 'switchyard.proxy.rlwy.net',
  port: 25343,
  user: 'root',
  password: 'BsrIQxIQErfdVZOehBzSHbakLFcCCRui',
  database: 'room_rental_db'
};

// Generate a unique 20-char ID
function generateUniqueId() {
  return 'USER_' + Date.now().toString().slice(-15);
}

async function createAdminUser() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  👤 CREATE ADMIN USER in Railway MySQL                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  const connection = await mysql.createConnection(config);

  try {
    console.log('✅ Connected to Railway MySQL');
    console.log('');

    // Hash the password with bcrypt (12 salt rounds as per codebase)
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(adminData.password, 12);
    console.log('✅ Password hashed');
    console.log('');

    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const [rows] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [adminData.email]
    );

    if (rows.length > 0) {
      console.log('⚠️  User already exists with email:', adminData.email);
      console.log('   User ID:', rows[0].id);
      console.log('');
      console.log('Skipping creation...');
      connection.end();
      return;
    }

    // Insert admin user
    console.log('📝 Creating admin user...');
    const uniqueId = generateUniqueId();
    const [result] = await connection.query(
      `INSERT INTO users (
        unique_id,
        name,
        email,
        contact,
        gender,
        pincode,
        password_hash,
        role,
        status,
        is_verified,
        registration_date,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        uniqueId,
        adminData.name,
        adminData.email,
        adminData.contact,
        adminData.gender,
        adminData.pincode,
        hashedPassword,
        'Admin',
        'Active',
        1
      ]
    );

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('👤 Admin User Details:');
    console.log('   ID:', result.insertId);
    console.log('   Unique ID:', uniqueId);
    console.log('   Name:', adminData.name);
    console.log('   Email:', adminData.email);
    console.log('   Contact:', adminData.contact);
    console.log('   Gender:', adminData.gender);
    console.log('   Pincode:', adminData.pincode);
    console.log('   Role: Admin');
    console.log('   Status: Active');
    console.log('   Verified: Yes');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('✅ ADMIN USER CREATED IN RAILWAY DATABASE!');
    console.log('');
    console.log('Login credentials:');
    console.log(`   Email: ${adminData.email}`);
    console.log(`   Password: ${adminData.password}`);
    console.log('');

    connection.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    connection.end();
    process.exit(1);
  }
}

createAdminUser();
