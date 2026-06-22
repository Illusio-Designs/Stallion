const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

/**
 * Standalone admin-managed discount offer (not tied to events).
 * offer_type drives the shape of `config`:
 *   flat    -> { discount_mode:'percent'|'amount', discount_value, min_order_amount? }
 *   product -> { items:[{ product_id, discount_mode, discount_value }] }
 *   bogo    -> { product_ids:[...], buy_qty, get_qty, get_discount_percent? }
 */
const Offer = sequelize.define('Offer', {
    offer_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    offer_type: {
        type: DataTypes.STRING(20), // 'flat' | 'product' | 'bogo'
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    // Active timeline — the offer only works between these dates.
    // null start = active from now, null end = no expiry.
    start_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    config: {
        type: DataTypes.JSON,
        allowNull: false
    },
}, {
    tableName: 'offer',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Offer;
