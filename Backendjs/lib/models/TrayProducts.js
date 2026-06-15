// CREATE TABLE tray_products(
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     tray_id UUID NOT NULL,
//     product_id UUID NOT NULL,
//     qty INT NOT NULL DEFAULT 1,
//     status VARCHAR(20) DEFAULT 'alloted',
//     assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const TrayProducts = sequelize.define('TrayProducts', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    tray_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tray',
            key: 'tray_id'
        }
    },
    product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'product',
            key: 'product_id'
        }
    },
    qty: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'alloted'
    },
    assigned_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'tray_product',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['tray_id'], name: 'idx_tray_product_tray_id' },
        { fields: ['product_id'], name: 'idx_tray_product_product_id' },
        { fields: ['status'], name: 'idx_tray_product_status' },
        { fields: ['tray_id', 'product_id'], name: 'idx_tray_product_tray_product_unique', unique: true },
        { fields: ['product_id', 'status'], name: 'idx_tray_product_product_status' },
    ],
});

// Define associations
const Tray = require('./Tray');
const Product = require('./Product');

TrayProducts.belongsTo(Tray, {
    foreignKey: 'tray_id',
    targetKey: 'tray_id'
});

TrayProducts.belongsTo(Product, {
    foreignKey: 'product_id',
    targetKey: 'product_id'
});

module.exports = TrayProducts;