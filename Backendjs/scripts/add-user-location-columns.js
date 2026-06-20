#!/usr/bin/env node
/**
 * One-time migration: add the optional location columns
 * (country_id, state_id, city_id) to the manually-managed `users` table.
 *
 * Idempotent — only adds a column when it's missing, so it's safe to run
 * repeatedly. The same logic also runs automatically on server startup
 * (DatabaseManager.initialize -> ensureUserLocationColumns); this script lets
 * you apply it immediately without a redeploy.
 *
 * Usage: npm run migrate:user-location
 */
require('dotenv').config();

const sequelize = require('../lib/constants/database');
const DatabaseManager = require('../lib/services/databaseManager');

async function main() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');
        await DatabaseManager.ensureUserLocationColumns();
        console.log('✅ users location columns ensured (country_id, state_id, city_id)');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to add user location columns:', error.message);
        process.exit(1);
    }
}

main();
