require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  try {
    console.log('Starting database migrations...');

    const migrationFiles = fs
      .readdirSync(__dirname)
      .filter((file) => /^\d+_.*\.sql$/.test(file))
      .sort();

    if (migrationFiles.length === 0) {
      console.log('No migration files found.');
      process.exit(0);
    }

    for (const file of migrationFiles) {
      const migrationPath = path.join(__dirname, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log(`Running ${file}...`);
      await db.query(sql);
    }

    console.log('✓ Database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
