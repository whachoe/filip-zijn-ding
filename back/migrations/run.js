require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  try {
    console.log('Starting database migrations...');

    // Read migration file
    const migrationPath = path.join(__dirname, '001_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await db.query(sql);

    console.log('✓ Database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
