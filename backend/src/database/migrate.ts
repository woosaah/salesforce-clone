import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

interface Migration {
  filename: string;
  sql: string;
}

async function runMigrations() {
  console.log('Starting database migrations...');

  try {
    // Create migrations tracking table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of executed migrations
    const executedResult = await pool.query(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    const executedMigrations = new Set(
      executedResult.rows.map((row: any) => row.filename)
    );

    // Read migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }

    // Prepare migrations to run
    const migrations: Migration[] = [];
    for (const filename of files) {
      if (!executedMigrations.has(filename)) {
        const sql = fs.readFileSync(
          path.join(migrationsDir, filename),
          'utf-8'
        );
        migrations.push({ filename, sql });
      }
    }

    if (migrations.length === 0) {
      console.log('All migrations are up to date');
      return;
    }

    console.log(`Found ${migrations.length} migration(s) to execute`);

    // Execute migrations in transaction
    const client = await pool.connect();
    try {
      for (const migration of migrations) {
        console.log(`Executing migration: ${migration.filename}`);
        await client.query('BEGIN');

        try {
          // Execute migration SQL
          await client.query(migration.sql);

          // Record migration
          await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [migration.filename]
          );

          await client.query('COMMIT');
          console.log(`✓ Migration completed: ${migration.filename}`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`✗ Migration failed: ${migration.filename}`);
          throw error;
        }
      }
    } finally {
      client.release();
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}

export default runMigrations;
