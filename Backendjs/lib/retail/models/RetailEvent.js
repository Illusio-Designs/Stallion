const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// Funnel event from the storefront: view_item, add_to_cart, begin_checkout, purchase.
const RetailEvent = sequelize.define('RetailEvent', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    session_id: { type: DataTypes.STRING(64), allowNull: false },
    type: { type: DataTypes.STRING(30), allowNull: false },
    product_id: { type: DataTypes.UUID, allowNull: true },
    value: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
}, {
    tableName: 'retail_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { name: 'idx_retail_events_type_created', fields: ['type', 'created_at'] },
        { name: 'idx_retail_events_session_id', fields: ['session_id'] },
        { name: 'idx_retail_events_product_id', fields: ['product_id'] },
    ],
});

module.exports = RetailEvent;
