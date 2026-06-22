
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Order = sequelize.define('Order', {
    order_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    order_number: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    order_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    order_type: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    party_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'parties',
            key: 'party_id'
        }
    },
    distributor_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'distributors',
            key: 'distributor_id'
        }
    },
    salesman_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'salesmen',
            key: 'salesman_id'
        }
    },
    event_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'event',
            key: 'event_id'
        }
    },
    order_status: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    order_total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    order_items: {
        type: DataTypes.JSON,
        allowNull: false
    },
    order_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    courier_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    courier_tracking_number: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    partial_dispatch_qty: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
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
    }
}, {
    tableName: 'order',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['party_id'], name: 'idx_order_party_id' },
        { fields: ['distributor_id'], name: 'idx_order_distributor_id' },
        { fields: ['salesman_id'], name: 'idx_order_salesman_id' },
        { fields: ['order_status'], name: 'idx_order_status' },
        { fields: ['order_date'], name: 'idx_order_order_date' },
        { fields: ['event_id'], name: 'idx_order_event_id' },
        { fields: ['order_number'], name: 'idx_order_order_number' },
        { fields: ['salesman_id', 'order_date'], name: 'idx_order_salesman_date' },
        { fields: ['party_id', 'order_status'], name: 'idx_order_party_status' },
    ],
});

const Party = require('./Party');

Order.belongsTo(Party, {
    foreignKey: 'party_id',
    targetKey: 'party_id',
    as: 'party',
});

module.exports = Order;