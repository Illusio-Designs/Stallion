const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const { DB_INDEXES } = require('../constants/dbIndexes');
const Country = require('../models/Country');
const State = require('../models/State');

class DatabaseManager {
    static async initialize() {
        try {
            console.log('🔄 Checking database tables...');
            await sequelize.authenticate();
            console.log('✅ Database connected successfully');

            // Guarantee the state-coverage join tables exist. Done with raw SQL
            // (CREATE TABLE IF NOT EXISTS) up-front so it can't be skipped by a
            // later Sequelize sync error or fail on a FK/collation quirk.
            try {
                await sequelize.query(`CREATE TABLE IF NOT EXISTS salesman_states (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    salesman_id CHAR(36) NOT NULL,
                    state_id CHAR(36) NOT NULL,
                    UNIQUE KEY idx_salesman_states_unique (salesman_id, state_id),
                    KEY idx_salesman_states_salesman_id (salesman_id),
                    KEY idx_salesman_states_state_id (state_id)
                )`);
                await sequelize.query(`CREATE TABLE IF NOT EXISTS distributor_states (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    distributor_id CHAR(36) NOT NULL,
                    state_id CHAR(36) NOT NULL,
                    UNIQUE KEY idx_distributor_states_unique (distributor_id, state_id),
                    KEY idx_distributor_states_distributor_id (distributor_id),
                    KEY idx_distributor_states_state_id (state_id)
                )`);
                console.log('✅ Ensured salesman_states & distributor_states tables');
            } catch (e) {
                console.error('❌ Failed creating state join tables:', e.message);
            }

            // Add the optional users location columns BEFORE any User query below
            // (the admin-seed findOne selects country_id/state_id/city_id, so this
            // MUST run first or init crash-loops with "Unknown column 'country_id'").
            await this.ensureUserLocationColumns();

            // Define table schemas
            const schemas = {
                users: {
                    user_id: {
                        type: DataTypes.UUID,
                        primaryKey: true,
                        defaultValue: DataTypes.UUIDV4
                    },
                    email: {
                        type: DataTypes.STRING(255),
                        allowNull: true,
                        unique: true
                    },
                    phone: {
                        type: DataTypes.STRING(20),
                        allowNull: false,
                        unique: true
                    },
                    full_name: {
                        type: DataTypes.STRING(255),
                        allowNull: false
                    },
                    address: {
                        type: DataTypes.TEXT,
                        allowNull: false,
                        defaultValue: ''
                    },
                    profile_image: {
                        type: DataTypes.STRING(500),
                        allowNull: true
                    },
                    is_active: {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: true
                    },
                    created_at: {
                        type: DataTypes.DATE,
                        allowNull: false,
                        defaultValue: DataTypes.NOW
                    },
                    updated_at: {
                        type: DataTypes.DATE,
                        allowNull: false,
                        defaultValue: DataTypes.NOW
                    },
                    last_login: {
                        type: DataTypes.DATE,
                        allowNull: true
                    },
                    role_id: {
                        type: DataTypes.UUID,
                        allowNull: false,
                        references: {
                            model: 'roles',
                            key: 'role_id'
                        }
                    }
                },
                roles: {
                    role_id: {
                        type: DataTypes.UUID,
                        primaryKey: true,
                        defaultValue: DataTypes.UUIDV4
                    },
                    role_name: {
                        type: DataTypes.STRING(100),
                        allowNull: false,
                        unique: true
                    },
                    description: {
                        type: DataTypes.TEXT,
                        allowNull: true
                    },
                    created_at: {
                        type: DataTypes.DATE,
                        allowNull: false,
                        defaultValue: DataTypes.NOW
                    }, is_office_role: {
                        type: DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false
                    },
                },
                user_roles: {
                    user_role_id: {
                        type: DataTypes.UUID,
                        primaryKey: true,
                        defaultValue: DataTypes.UUIDV4
                    },
                    user_id: {
                        type: DataTypes.UUID,
                        allowNull: false,
                        references: {
                            model: 'users',
                            key: 'user_id'
                        }
                    },
                    role_id: {
                        type: DataTypes.UUID,
                        allowNull: false,
                        references: {
                            model: 'roles',
                            key: 'role_id'
                        }
                    },
                    assigned_at: {
                        type: DataTypes.DATE,
                        allowNull: false,
                        defaultValue: DataTypes.NOW
                    },
                    assigned_by: {
                        type: DataTypes.UUID,
                        allowNull: true,
                        references: {
                            model: 'users',
                            key: 'user_id'
                        }
                    }
                },
                audit_logs: {
                    id: {
                        type: DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true
                    },
                    user_id: {
                        type: DataTypes.UUID,
                        allowNull: true
                    },
                    action: {
                        type: DataTypes.ENUM('create', 'update', 'delete'),
                        allowNull: false
                    },
                    description: {
                        type: DataTypes.STRING(255),
                        allowNull: true
                    },
                    table_name: {
                        type: DataTypes.STRING,
                        allowNull: true
                    },
                    record_id: {
                        type: DataTypes.STRING(36),
                        allowNull: true
                    },
                    old_values: {
                        type: DataTypes.JSON,
                        allowNull: true
                    },
                    new_values: {
                        type: DataTypes.JSON,
                        allowNull: true
                    },
                    ip_address: {
                        type: DataTypes.STRING,
                        allowNull: true
                    },
                    created_at: {
                        type: DataTypes.DATE,
                        allowNull: false,
                        defaultValue: DataTypes.NOW
                    }
                },
            };

            // Default roles
            const defaultRoles = [
                { role_name: 'sales_manager', description: 'Manages sales operations and team', is_office_role: true },
                { role_name: 'expense_manager', description: 'Manages company expenses', is_office_role: true },
                { role_name: 'tray_manager', description: 'Manages tray inventory', is_office_role: true },
                { role_name: 'order_manager', description: 'Manages customer orders', is_office_role: true },
                { role_name: 'reports_manager', description: 'Manages reports', is_office_role: true },
                { role_name: 'product_manager', description: 'Manages product catalog', is_office_role: true },
                { role_name: 'party_manager', description: 'Manages parties', is_office_role: true },
                { role_name: 'distributor_manager', description: 'Manages distributors', is_office_role: true },
                { role_name: 'salesman', description: 'Field salesman mapped to zones', is_office_role: false },
                { role_name: 'admin', description: 'Super admin', is_office_role: true },
                { role_name: 'party', description: 'Party', is_office_role: false },
                { role_name: 'distributor', description: 'Distributor', is_office_role: false },
            ];

            // Define table creation order (respecting foreign key dependencies)
            // roles must be created before users, users before user_roles
            const tableOrder = ['roles', 'users', 'user_roles', 'audit_logs'];

            // First pass: Create tables without foreign keys
            for (const tableName of tableOrder) {
                const schema = schemas[tableName];
                if (!schema) continue;

                const tableExists = await this.checkTableExists(tableName);

                if (!tableExists) {
                    console.log(`📦 Creating table: ${tableName}`);

                    // Create schema without foreign key references for initial creation
                    const schemaWithoutFKs = {};
                    for (const [columnName, columnDef] of Object.entries(schema)) {
                        const { references, ...columnDefWithoutFK } = columnDef;
                        schemaWithoutFKs[columnName] = columnDefWithoutFK;
                    }

                    await sequelize.getQueryInterface().createTable(tableName, schemaWithoutFKs);

                    // Insert default roles if creating roles table
                    if (tableName === 'roles') {
                        try {
                            const Role = require('../models/Role');
                            for (const roleData of defaultRoles) {
                                await Role.findOrCreate({
                                    where: { role_name: roleData.role_name },
                                    defaults: roleData
                                });
                            }
                            console.log('👥 Default roles created');
                        } catch (error) {
                            console.log('⚠️ Error creating default roles:', error.message);
                        }
                    }
                } else {
                    console.log(`✅ Table exists: ${tableName}`);

                    // Check and add missing columns (without foreign keys)
                    const currentColumns = await this.getTableColumns(tableName);
                    for (const [columnName, columnDef] of Object.entries(schema)) {
                        if (!currentColumns.includes(columnName)) {
                            console.log(`📝 Adding column: ${tableName}.${columnName}`);
                            const { references, ...columnDefWithoutFK } = columnDef;
                            await sequelize.getQueryInterface().addColumn(tableName, columnName, columnDefWithoutFK);
                        }
                    }
                }
            }

            // Second pass: Add foreign key constraints after all tables exist
            for (const tableName of tableOrder) {
                const schema = schemas[tableName];
                if (!schema) continue;

                try {
                    // Check for foreign key columns and add constraints if they don't exist
                    for (const [columnName, columnDef] of Object.entries(schema)) {
                        if (columnDef.references) {
                            const tableExists = await this.checkTableExists(tableName);
                            const referencedTable = columnDef.references.model;
                            const referencedKey = columnDef.references.key;

                            if (tableExists && await this.checkTableExists(referencedTable)) {
                                try {
                                    // Check if foreign key already exists
                                    const [foreignKeys] = await sequelize.query(`
                                        SELECT CONSTRAINT_NAME 
                                        FROM information_schema.KEY_COLUMN_USAGE 
                                        WHERE TABLE_SCHEMA = DATABASE()
                                        AND TABLE_NAME = ?
                                        AND COLUMN_NAME = ?
                                        AND REFERENCED_TABLE_NAME IS NOT NULL
                                    `, {
                                        replacements: [tableName, columnName]
                                    });

                                    if (foreignKeys.length === 0) {
                                        console.log(`🔗 Adding foreign key: ${tableName}.${columnName} -> ${referencedTable}.${referencedKey}`);
                                        await sequelize.getQueryInterface().addConstraint(tableName, {
                                            fields: [columnName],
                                            type: 'foreign key',
                                            name: `fk_${tableName}_${columnName}`,
                                            references: {
                                                table: referencedTable,
                                                field: referencedKey
                                            },
                                            onDelete: 'RESTRICT',
                                            onUpdate: 'CASCADE'
                                        });
                                    }
                                } catch (fkError) {
                                    // Foreign key might already exist or there's a constraint issue
                                    if (!fkError.message.includes('Duplicate key name') &&
                                        !fkError.message.includes('already exists') &&
                                        !fkError.message.includes('Duplicate foreign key')) {
                                        console.log(`⚠️ Warning adding foreign key ${tableName}.${columnName}:`, fkError.message);
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Warning processing foreign keys for ${tableName}:`, error.message);
                }
            }

            // Create default admin if not exists
            const User = require('../models/User');
            const Role = require('../models/Role');
            const UserRole = require('../models/UserRole');

            const adminExists = await User.findOne({
                where: {
                    email: 'illusiodesigns@gmail.com'
                }
            });

            if (!adminExists) {
                // Find or create admin role (using sales_manager as default admin role)
                let adminRole = await Role.findOne({
                    where: { role_name: 'sales_manager' }
                });

                if (!adminRole) {
                    adminRole = await Role.create({
                        role_name: 'sales_manager',
                        description: 'Manages sales operations and team'
                    });
                }

                const adminUser = await User.create({
                    full_name: 'Superadmin',
                    email: 'illusiodesigns@gmail.com',
                    phone: '7600046416',
                    address: 'Head Office',
                    is_active: true,
                    role_id: adminRole.role_id
                });

                // Assign role to admin user
                await UserRole.create({
                    user_id: adminUser.user_id,
                    role_id: adminRole.role_id
                });

                console.log('👤 Default admin user created');
            }

            // Load all models that use Sequelize define() to ensure they're registered
            console.log('📦 Loading Sequelize models...');
            require('../models/Country');
            require('../models/State');
            require('../models/Cities');
            require('../models/Zone');
            require('../models/Party');
            require('../models/distributor');
            require('../models/Salesman');
            require('../models/ColorCode');
            require('../models/FrameColor');
            require('../models/FrameMaterial');
            require('../models/FrameType');
            require('../models/Gender');
            require('../models/LensColor');
            require('../models/LensMaterial');
            require('../models/Product');
            require('../models/Shape');
            require('../models/Tray');
            require('../models/SalesmanTray');
            require('../models/TrayProducts');
            require('../models/event');
            require('../models/Order');
            require('../models/SalesmanExpense');
            require('../models/SalesmanTargets');
            require('../models/SalesmanCheckIns');
            require('../models/DistributorZones');
            require('../models/SalesmanStates');
            require('../models/DistributorStates');

            // List of tables that are manually managed (should not be auto-synced)
            const manuallyManagedTables = ['users', 'roles', 'user_roles', 'audit_logs'];

            // Define sync order for models with dependencies (parent tables first)
            // Country -> State -> Cities -> Zone
            const modelSyncOrder = ['Country', 'State', 'Cities', 'Zone', 'Party', 'Distributor', 'Salesman',
                'ColorCode', 'FrameColor', 'FrameMaterial', 'FrameType', 'Gender', 'LensColor',
                'LensMaterial', 'Shape', 'Brand', 'Collection', 'Product', 'Tray', 'SalesmanTray',
                'TrayProducts', 'Event', 'Order', 'OrderOperation', 'SalesmanExpense', 'SalesmanTargets', 'SalesmanCheckIns', 'DistributorZones', 'SalesmanZones', 'SalesmanStates', 'DistributorStates'];

            // Sync all models except the manually managed ones
            console.log('🔄 Syncing Sequelize models (excluding manually managed tables)...');

            // First, get all models that should be synced
            const allModels = Object.keys(sequelize.models).filter(modelName => {
                const model = sequelize.models[modelName];
                const tableName = model.tableName || model.name.toLowerCase() + 's';
                return !manuallyManagedTables.includes(tableName);
            });

            // Sync models in dependency order first
            for (const modelName of modelSyncOrder) {
                if (allModels.includes(modelName) && sequelize.models[modelName]) {
                    const model = sequelize.models[modelName];
                    try {
                        const tableName = model.tableName || model.name.toLowerCase() + 's';
                        const tableExists = await this.checkTableExists(tableName);

                        // Clean up orphaned foreign key records before syncing
                        if (tableExists) {
                            if (modelName === 'TrayProducts') {
                                await this.cleanupOrphanedRecords('tray_product', 'product_id', 'product', 'product_id');
                            } else if (modelName === 'OrderOperation') {
                                await this.cleanupOrphanedRecords('order_operation', 'product_id', 'product', 'product_id');
                            } else if (modelName === 'SalesmanExpense') {
                                await this.repairSalesmanExpenseForeignKey();
                            }
                        }

                        if (!tableExists) {
                            console.log(`📦 Creating table from model: ${tableName}`);
                            await model.sync({ alter: true });
                        } else {
                            await model.sync({ alter: true });
                            console.log(`✅ Table exists: ${tableName}`);
                        }
                    } catch (error) {
                        console.log(`⚠️ Warning syncing model ${modelName}:`, error.message);
                    }
                }
            }

            // Sync any remaining models that weren't in the ordered list
            const remainingModels = allModels.filter(modelName => !modelSyncOrder.includes(modelName));
            for (const modelName of remainingModels) {
                const model = sequelize.models[modelName];
                try {
                    const tableName = model.tableName || model.name.toLowerCase() + 's';
                    const tableExists = await this.checkTableExists(tableName);

                    if (!tableExists) {
                        console.log(`📦 Creating table from model: ${tableName}`);
                        await model.sync({ alter: true });
                    } else {
                        await model.sync({ alter: true });
                        console.log(`✅ Table exists: ${tableName}`);
                    }
                } catch (error) {
                    console.log(`⚠️ Warning syncing model ${modelName}:`, error.message);
                }
            }

            // Idempotent index sync for all tables (safe on existing live databases)
            await this.syncIndexes();

            await Country.initializeDefaultCountries();
            await State.initializeDefaultStates();
            console.log('✨ Database initialization completed');
            return true;
        } catch (error) {
            console.error('❌ Database initialization error:', error);
            throw error;
        }
    }

    // Idempotently add the optional location columns to the manually-managed
    // `users` table (it's excluded from model sync). Only adds a column when it
    // doesn't already exist, so it's safe to run on every startup / live DB.
    static async ensureUserLocationColumns() {
        try {
            const qi = sequelize.getQueryInterface();
            const table = await qi.describeTable('users');
            for (const col of ['country_id', 'state_id', 'city_id']) {
                if (!table[col]) {
                    await qi.addColumn('users', col, { type: DataTypes.UUID, allowNull: true });
                    console.log(`✅ Added column users.${col}`);
                }
            }
        } catch (error) {
            console.log('⚠️ ensureUserLocationColumns warning:', error.message);
        }
    }

    static async checkTableExists(tableName) {
        try {
            const [results] = await sequelize.query(`
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                LIMIT 1
            `, { replacements: [tableName] });

            return results.length > 0;
        } catch (error) {
            return false;
        }
    }

    static async getTableColumns(tableName) {
        const tableInfo = await sequelize.getQueryInterface().describeTable(tableName);
        return Object.keys(tableInfo);
    }

    static async addMissingColumns(tableName, schema) {
        const currentColumns = await this.getTableColumns(tableName);

        for (const [columnName, columnDef] of Object.entries(schema)) {
            if (!currentColumns.includes(columnName)) {
                await sequelize.getQueryInterface().addColumn(tableName, columnName, columnDef);
            }
        }
    }

    /**
     * salesman_expense.salesman_id was incorrectly FK'd to salesmen.user_id.
     * Repair live databases that still have the old constraint.
     */
    static async repairSalesmanExpenseForeignKey() {
        const tableName = 'salesman_expense';
        if (!(await this.checkTableExists(tableName))) {
            return;
        }

        try {
            const [foreignKeys] = await sequelize.query(`
                SELECT CONSTRAINT_NAME, REFERENCED_COLUMN_NAME
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = ?
                  AND COLUMN_NAME = 'salesman_id'
                  AND REFERENCED_TABLE_NAME = 'salesmen'
            `, { replacements: [tableName] });

            const wrongFk = foreignKeys.find((fk) => fk.REFERENCED_COLUMN_NAME === 'user_id');
            if (!wrongFk) {
                return;
            }

            console.log(`🔧 Repairing ${tableName}.salesman_id foreign key (${wrongFk.CONSTRAINT_NAME})`);
            await sequelize.query(`
                ALTER TABLE \`${tableName}\`
                DROP FOREIGN KEY \`${wrongFk.CONSTRAINT_NAME}\`
            `);
            await sequelize.getQueryInterface().addConstraint(tableName, {
                fields: ['salesman_id'],
                type: 'foreign key',
                name: 'fk_salesman_expense_salesman_id',
                references: {
                    table: 'salesmen',
                    field: 'salesman_id',
                },
                onDelete: 'RESTRICT',
                onUpdate: 'CASCADE',
            });
            console.log(`✅ ${tableName}.salesman_id now references salesmen.salesman_id`);
        } catch (error) {
            if (!error.message.includes('Duplicate') && !error.message.includes('already exists')) {
                console.log(`⚠️ Warning repairing ${tableName} foreign key:`, error.message);
            }
        }
    }

    /**
     * Clean up orphaned foreign key records
     * Removes records from child table that reference non-existent records in parent table
     * @param {string} childTable - The table with the foreign key
     * @param {string} childColumn - The foreign key column in child table
     * @param {string} parentTable - The referenced table
     * @param {string} parentColumn - The primary key column in parent table
     */
    static async cleanupOrphanedRecords(childTable, childColumn, parentTable, parentColumn) {
        try {
            const childTableExists = await this.checkTableExists(childTable);
            const parentTableExists = await this.checkTableExists(parentTable);

            if (!childTableExists || !parentTableExists) {
                return;
            }

            // Find and delete orphaned records using proper MySQL syntax with backticks
            const [orphanedRecords] = await sequelize.query(`
                SELECT tp.\`${childColumn}\`
                FROM \`${childTable}\` tp
                LEFT JOIN \`${parentTable}\` p ON tp.\`${childColumn}\` = p.\`${parentColumn}\`
                WHERE p.\`${parentColumn}\` IS NULL
            `);

            if (orphanedRecords && orphanedRecords.length > 0) {
                const orphanedIds = orphanedRecords.map(record => record[childColumn]);
                // Use Sequelize's query with proper array handling for MySQL
                const placeholders = orphanedIds.map(() => '?').join(',');
                await sequelize.query(`
                    DELETE FROM \`${childTable}\`
                    WHERE \`${childColumn}\` IN (${placeholders})
                `, {
                    replacements: orphanedIds
                });
                console.log(`🧹 Cleaned up ${orphanedRecords.length} orphaned records from ${childTable}`);
            }
        } catch (error) {
            // If cleanup fails, log but don't throw - allow sync to continue
            console.log(`⚠️ Warning cleaning up orphaned records in ${childTable}:`, error.message);
        }
    }

    /**
     * Returns existing non-primary indexes grouped by name for a table.
     */
    static async getTableIndexes(tableName) {
        const [rows] = await sequelize.query(`
            SELECT
                INDEX_NAME,
                NON_UNIQUE,
                GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
            GROUP BY INDEX_NAME, NON_UNIQUE
        `, { replacements: [tableName] });

        return rows;
    }

    /**
     * Check whether an index with the same columns and uniqueness already exists.
     */
    static indexColumnsMatch(existingIndex, fields, unique) {
        if (!existingIndex || existingIndex.INDEX_NAME === 'PRIMARY') {
            return false;
        }
        const existingColumns = existingIndex.columns;
        const expectedColumns = fields.join(',');
        const existingIsUnique = existingIndex.NON_UNIQUE === 0;
        return existingColumns === expectedColumns && existingIsUnique === Boolean(unique);
    }

    /**
     * Add missing indexes from lib/constants/dbIndexes.js without failing startup.
     * Skips indexes that already exist (by name or equivalent columns).
     */
    static async syncIndexes(indexDefinitions = DB_INDEXES) {
        console.log('📇 Syncing database indexes...');
        const queryInterface = sequelize.getQueryInterface();
        let added = 0;
        let skipped = 0;
        let warned = 0;

        for (const definition of indexDefinitions) {
            const { table, fields, name, unique = false } = definition;

            if (!table || !fields?.length || !name) {
                console.log(`⚠️ Skipping invalid index definition: ${JSON.stringify(definition)}`);
                warned++;
                continue;
            }

            const tableExists = await this.checkTableExists(table);
            if (!tableExists) {
                skipped++;
                continue;
            }

            let existingIndexes = [];
            try {
                existingIndexes = await this.getTableIndexes(table);
            } catch (error) {
                console.log(`⚠️ Could not read indexes for ${table}:`, error.message);
                warned++;
                continue;
            }

            if (existingIndexes.some((idx) => idx.INDEX_NAME === name)) {
                skipped++;
                continue;
            }

            const equivalent = existingIndexes.find((idx) => this.indexColumnsMatch(idx, fields, unique));
            if (equivalent) {
                console.log(`ℹ️  Index already covered on ${table}: ${equivalent.INDEX_NAME} (${fields.join(', ')})`);
                skipped++;
                continue;
            }

            // Verify columns exist before creating index
            try {
                const columns = await this.getTableColumns(table);
                const missingColumns = fields.filter((field) => !columns.includes(field));
                if (missingColumns.length > 0) {
                    console.log(`⚠️ Skipping index ${name} on ${table}: missing columns ${missingColumns.join(', ')}`);
                    warned++;
                    continue;
                }
            } catch (error) {
                console.log(`⚠️ Could not describe ${table} for index ${name}:`, error.message);
                warned++;
                continue;
            }

            try {
                await queryInterface.addIndex(table, {
                    fields,
                    name,
                    unique,
                });
                console.log(`📇 Added index ${name} on ${table} (${fields.join(', ')})`);
                added++;
            } catch (error) {
                const message = error.message || '';
                const mysqlCode = error.original && error.original.code;

                if (
                    message.includes('Duplicate key name')
                    || message.includes('already exists')
                    || mysqlCode === 'ER_DUP_KEYNAME'
                ) {
                    skipped++;
                    continue;
                }

                if (unique && (mysqlCode === 'ER_DUP_ENTRY' || message.includes('Duplicate entry'))) {
                    console.log(
                        `⚠️ Could not add unique index ${name} on ${table}: duplicate data exists — clean data then re-run sync`
                    );
                    warned++;
                    continue;
                }

                console.log(`⚠️ Warning adding index ${name} on ${table}:`, message);
                warned++;
            }
        }

        console.log(`📇 Index sync complete: ${added} added, ${skipped} skipped, ${warned} warnings`);
    }
}

module.exports = DatabaseManager;
