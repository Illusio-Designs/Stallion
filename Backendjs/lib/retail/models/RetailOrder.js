const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// A web-store order. Customer and address are copied onto the order (a snapshot), so later
// edits to the customer never change an old order. Money columns are rupees (DECIMAL 12,2).
const RetailOrder = sequelize.define('RetailOrder', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    order_number: { type: DataTypes.STRING(20), allowNull: false, unique: true }, // WEB-1001
    customer_id: { type: DataTypes.UUID, allowNull: true },
    customer_name: { type: DataTypes.STRING(120), allowNull: false },
    customer_phone: { type: DataTypes.STRING(15), allowNull: false },
    customer_email: { type: DataTypes.STRING(190), allowNull: true },
    address_line1: { type: DataTypes.STRING(255), allowNull: false },
    address_line2: { type: DataTypes.STRING(255), allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: false },
    state: { type: DataTypes.STRING(100), allowNull: false },
    pincode: { type: DataTypes.STRING(6), allowNull: false },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    shipping_fee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    cod_fee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    payment_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'cod' },       // cod | online (later)
    payment_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' }, // pending | paid | cancelled | refunded
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'pending' },
    shipping_option: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'standard' }, // standard | express
    expected_delivery: { type: DataTypes.DATEONLY, allowNull: true },
    courier: { type: DataTypes.STRING(100), allowNull: true },
    awb: { type: DataTypes.STRING(100), allowNull: true },
    tracking_url: { type: DataTypes.STRING(500), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    session_id: { type: DataTypes.STRING(64), allowNull: true },
    source: { type: DataTypes.STRING(120), allowNull: true }, // utm_source, else the visit's source, else 'direct'
    utm_source: { type: DataTypes.STRING(150), allowNull: true },
    utm_medium: { type: DataTypes.STRING(150), allowNull: true },
    utm_campaign: { type: DataTypes.STRING(150), allowNull: true },
    utm_term: { type: DataTypes.STRING(150), allowNull: true },
    utm_content: { type: DataTypes.STRING(150), allowNull: true },
    consent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    stock_returned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // cancel gives stock back exactly once
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'retail_orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { name: 'idx_retail_orders_phone', fields: ['customer_phone'] },
        { name: 'idx_retail_orders_status', fields: ['status'] },
        { name: 'idx_retail_orders_created_at', fields: ['created_at'] },
        { name: 'idx_retail_orders_session_id', fields: ['session_id'] },
        { name: 'idx_retail_orders_customer_id', fields: ['customer_id'] },
    ],
});

module.exports = RetailOrder;
