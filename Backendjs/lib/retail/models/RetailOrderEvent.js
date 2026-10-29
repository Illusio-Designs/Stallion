const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');
const RetailOrder = require('./RetailOrder');

// Status history of an order (timeline). The first row is written together with the order.
// `note` is shown to the customer on the tracking page, so keep it customer-safe.
const RetailOrderEvent = sequelize.define('RetailOrderEvent', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    order_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false },
    kind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'status' }, // status (shown to the customer) | shipping | note (admin only)
    note: { type: DataTypes.STRING(500), allowNull: true },
    actor_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'system' }, // customer | admin | system
    actor_id: { type: DataTypes.UUID, allowNull: true },
    actor_name: { type: DataTypes.STRING(120), allowNull: true },
}, {
    tableName: 'retail_order_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { name: 'idx_retail_order_events_order_created', fields: ['order_id', 'created_at'] },
    ],
});

RetailOrder.hasMany(RetailOrderEvent, { foreignKey: 'order_id', as: 'events', constraints: false });
RetailOrderEvent.belongsTo(RetailOrder, { foreignKey: 'order_id', as: 'order', constraints: false });

module.exports = RetailOrderEvent;
