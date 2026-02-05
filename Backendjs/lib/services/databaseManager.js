const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const Country = require('../models/Country');
const State = require('../models/State');

class DatabaseManager {
    static async initialize() {
        try {
            console.log('🔄 Checking database tables...');
            await sequelize.authenticate();
            console.log('✅ Database connected successfully');
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
                        type: DataTypes.STRING,
                        allowNull: true
                    },
                    table_name: {
                        type: DataTypes.STRING,
                        allowNull: true
                    },
                    record_id: {
                        type: DataTypes.UUID,
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

            // List of tables that are manually managed (should not be auto-synced)
            const manuallyManagedTables = ['users', 'roles', 'user_roles', 'audit_logs'];

            // Define sync order for models with dependencies (parent tables first)
            // Country -> State -> Cities -> Zone
            const modelSyncOrder = ['Country', 'State', 'Cities', 'Zone', 'Party', 'Distributor', 'Salesman',
                'ColorCode', 'FrameColor', 'FrameMaterial', 'FrameType', 'Gender', 'LensColor',
                'LensMaterial', 'Shape', 'Brand', 'Collection', 'Product', 'Tray', 'SalesmanTray',
                'TrayProducts', 'Event', 'Order', 'OrderOperation'];

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

            await Country.initializeDefaultCountries();
            await State.initializeDefaultStates();
            console.log('✨ Database initialization completed');
            return true;
        } catch (error) {
            console.error('❌ Database initialization error:', error);
            throw error;
        }
    }

    static async checkTableExists(tableName) {
        try {
            await sequelize.getQueryInterface().showTable(tableName);
            return true;
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
}

module.exports = DatabaseManager;
