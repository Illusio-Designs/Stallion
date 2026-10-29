// Loads every model file in this folder so Sequelize registers it (and the startup sync creates the tables).
// Retail tables are all prefixed retail_ and never join to wholesale tables.
const fs = require('fs');
const path = require('path');

const loaded = {};
fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.js') && f !== 'index.js')
    .sort()
    .forEach((f) => {
        const m = require(path.join(__dirname, f));
        loaded[path.basename(f, '.js')] = m;
    });

module.exports = loaded;
