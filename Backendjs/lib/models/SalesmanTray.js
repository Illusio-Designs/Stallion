// CREATE TABLE salesman_trays(
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     salesman_id UUID NOT NULL,
//     tray_id UUID NOT NULL,
//     assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const SalesmanTray = sequelize.define('SalesmanTray', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    salesman_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'salesmen',
            key: 'salesman_id'
        }
    },
    tray_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'tray',
            key: 'tray_id'
        }
    },
    assigned_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'salesman_tray',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['salesman_id'], name: 'idx_salesman_tray_salesman_id' },
        { fields: ['tray_id'], name: 'idx_salesman_tray_tray_id' },
    ],
});

// Define associations
const Salesman = require('./Salesman');
const Tray = require('./Tray');

SalesmanTray.belongsTo(Salesman, {
    foreignKey: 'salesman_id',
    targetKey: 'salesman_id'
});

SalesmanTray.belongsTo(Tray, {
    foreignKey: 'tray_id',
    targetKey: 'tray_id'
});

module.exports = SalesmanTray;