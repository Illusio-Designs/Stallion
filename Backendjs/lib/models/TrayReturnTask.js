const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

// One row per tray part of an order: the salesman holding that tray must courier the frames back
// to the office. Status goes booked -> in_transit -> received (or cancelled with the order).
// Rows are never deleted.
const TrayReturnTask = sequelize.define('TrayReturnTask', {
    task_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    order_id: { type: DataTypes.UUID, allowNull: false },
    product_id: { type: DataTypes.UUID, allowNull: true },
    tray_id: { type: DataTypes.UUID, allowNull: true },
    salesman_id: { type: DataTypes.UUID, allowNull: true },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'booked' },
    courier_name: { type: DataTypes.STRING(255), allowNull: true },
    tracking_number: { type: DataTypes.STRING(255), allowNull: true },
    in_transit_at: { type: DataTypes.DATE, allowNull: true },
    received_at: { type: DataTypes.DATE, allowNull: true },
    received_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
    tableName: 'tray_return_tasks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['order_id'], name: 'idx_tray_return_tasks_order_id' },
        { fields: ['salesman_id', 'status'], name: 'idx_tray_return_tasks_salesman_status' },
    ],
});

module.exports = TrayReturnTask;
