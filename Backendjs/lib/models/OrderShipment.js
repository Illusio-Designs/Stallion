const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

// One row per parcel sent for an order (an order can ship in several parts, each
// with its own courier and tracking number). Rows are never deleted.
const OrderShipment = sequelize.define('OrderShipment', {
    shipment_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    order_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    courier_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    tracking_number: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    qty: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    shipped_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    created_by: {
        type: DataTypes.UUID,
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
    tableName: 'order_shipments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['order_id'], name: 'idx_order_shipments_order_id' },
    ],
});

module.exports = OrderShipment;
