const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// One row per phone number (10 digits). Created or refreshed whenever that phone places an order.
const RetailCustomer = sequelize.define('RetailCustomer', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    phone: { type: DataTypes.STRING(15), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(190), allowNull: true },
    marketing_consent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    order_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_spent: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    first_order_at: { type: DataTypes.DATE, allowNull: true },
    last_order_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'retail_customers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { name: 'idx_retail_customers_email', fields: ['email'] },
        { name: 'idx_retail_customers_created_at', fields: ['created_at'] },
    ],
});

module.exports = RetailCustomer;
