/**
 * Migration Runner Script
 * 
 * Executes SQL migration files in the correct order
 * Run with: node scripts/run-migrations.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database connection configuration
const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'displayops',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

const migrationsDir = path.join(__dirname, '..', 'migrations');

async function runMigrations() {
  const client = new Client(dbConfig);

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database:', dbConfig.database);

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✅ Migration tracking table ready');

    // Get list of migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort to ensure order

    console.log(`\n📂 Found ${files.length} migration files\n`);

    for (const filename of files) {
      // Check if migration was already executed
      const checkResult = await client.query(
        'SELECT * FROM schema_migrations WHERE filename = $1',
        [filename]
      );

      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Skipping ${filename} (already executed)`);
        continue;
      }

      console.log(`🔄 Running ${filename}...`);
      
      const filePath = path.join(migrationsDir, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        // Execute migration
        await client.query(sql);
        
        // Record migration as executed
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );

        console.log(`✅ Completed ${filename}`);
      } catch (error) {
        console.error(`❌ Failed to execute ${filename}:`);
        console.error(error.message);
        throw error;
      }
    }

    console.log('\n🎉 All migrations completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run migrations
runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

