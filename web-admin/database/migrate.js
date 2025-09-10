#!/usr/bin/env node

/**
 * Migration script to setup PostgreSQL database and migrate JSON data
 * Usage: node database/migrate.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local first, then .env
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'office_tv_admin',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_HOST?.includes('neon.tech') || process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } : false,
});

async function runSchema() {
  try {
    console.log('🗄️  Creating database schema...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schema);
    console.log('✅ Database schema created successfully');
  } catch (error) {
    console.error('❌ Failed to create schema:', error.message);
    throw error;
  }
}

async function migrateJSONData() {
  try {
    console.log('📦 Migrating JSON data to PostgreSQL...');
    
    const dataDir = path.join(__dirname, '..', 'data');
    
    // Migrate users
    const usersFile = path.join(dataDir, 'users.json');
    if (fs.existsSync(usersFile)) {
      const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
      for (const user of usersData.users || []) {
        await pool.query(`
          INSERT INTO users (id, email, name, password, role, sites, created_at, last_login)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            password = EXCLUDED.password,
            role = EXCLUDED.role,
            sites = EXCLUDED.sites,
            last_login = EXCLUDED.last_login
        `, [
          user.id, user.email, user.name, user.password, user.role, user.sites,
          new Date(user.createdAt), user.lastLogin ? new Date(user.lastLogin) : null
        ]);
      }
      console.log(`  ✅ Migrated ${usersData.users?.length || 0} users`);
    }
    
    // Migrate controllers
    const controllersFile = path.join(dataDir, 'controllers.json');
    if (fs.existsSync(controllersFile)) {
      const controllersData = JSON.parse(fs.readFileSync(controllersFile, 'utf-8'));
      for (const controller of controllersData.controllers || []) {
        await pool.query(`
          INSERT INTO controllers (id, name, local_network, mdns_service, controller_url, 
                                 status, last_sync, version, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            local_network = EXCLUDED.local_network,
            controller_url = EXCLUDED.controller_url,
            status = EXCLUDED.status,
            last_sync = EXCLUDED.last_sync,
            version = EXCLUDED.version
        `, [
          controller.id, controller.name, controller.localNetwork, controller.mdnsService,
          controller.controllerUrl, controller.status,
          controller.lastSync ? new Date(controller.lastSync) : null, controller.version
        ]);
      }
      console.log(`  ✅ Migrated ${controllersData.controllers?.length || 0} controllers`);
    }
    
    // Migrate sites
    const sitesFile = path.join(dataDir, 'sites.json');
    if (fs.existsSync(sitesFile)) {
      const sitesData = JSON.parse(fs.readFileSync(sitesFile, 'utf-8'));
      for (const site of sitesData.sites || []) {
        await pool.query(`
          INSERT INTO sites (id, name, location, timezone, status, controllers, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            location = EXCLUDED.location,
            timezone = EXCLUDED.timezone,
            status = EXCLUDED.status,
            controllers = EXCLUDED.controllers,
            updated_at = EXCLUDED.updated_at
        `, [
          site.id, site.name, site.location, site.timezone, site.status, site.controllers,
          site.createdAt ? new Date(site.createdAt) : new Date(),
          site.updatedAt ? new Date(site.updatedAt) : new Date()
        ]);
      }
      console.log(`  ✅ Migrated ${sitesData.sites?.length || 0} sites`);
    }
    
    // Migrate dashboards if exists
    const dashboardsFile = path.join(dataDir, 'dashboards.json');
    if (fs.existsSync(dashboardsFile)) {
      const dashboardsData = JSON.parse(fs.readFileSync(dashboardsFile, 'utf-8'));
      for (const dashboard of dashboardsData.dashboards || []) {
        await pool.query(`
          INSERT INTO dashboards (id, name, url, site_id, controller_id, status, config, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            url = EXCLUDED.url,
            site_id = EXCLUDED.site_id,
            controller_id = EXCLUDED.controller_id,
            status = EXCLUDED.status,
            config = EXCLUDED.config
        `, [
          dashboard.id, dashboard.name, dashboard.url, dashboard.siteId, 
          dashboard.controllerId, dashboard.status, JSON.stringify(dashboard.config || {})
        ]);
      }
      console.log(`  ✅ Migrated ${dashboardsData.dashboards?.length || 0} dashboards`);
    }
    
    console.log('✅ JSON data migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting database migration...');
    console.log(`📡 Connecting to PostgreSQL at ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`);
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');
    
    // Run schema
    await runSchema();
    
    // Migrate data
    await migrateJSONData();
    
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Set DATABASE_TYPE=postgres in your .env file');
    console.log('2. Configure PostgreSQL connection variables');
    console.log('3. Restart your application');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}