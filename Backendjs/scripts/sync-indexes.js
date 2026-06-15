#!/usr/bin/env node
/**
 * Run index sync only against the configured database (no table/column migrations).
 * Usage: npm run sync:indexes
 */
require('dotenv').config();

const sequelize = require('../lib/constants/database');
const DatabaseManager = require('../lib/services/databaseManager');

async function main() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');
        await DatabaseManager.syncIndexes();
        console.log('✅ Index sync finished');
        process.exit(0);
    } catch (error) {
        console.error('❌ Index sync failed:', error.message);
        process.exit(1);
    }
}

main();
