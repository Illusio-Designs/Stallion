const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');
const RetailOrder = require('./RetailOrder');

// One line of an order. Title, model, image and price are copied at order time and never change.
const RetailOrderItem = sequelize.define('RetailOrderItem', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    order_id: { type: DataTypes.UUID, allowNull: false },
    product_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    model_no: { type: DataTypes.STRING(255), allowNull: true },
    image: { type: DataTypes.STRING(500), allowNull: true },
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    line_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
}, {
    tableName: 'retail_order_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { name: 'idx_retail_order_items_order_id', fields: ['order_id'] },
        { name: 'idx_retail_order_items_product_id', fields: ['product_id'] },
    ],
});

// No database foreign keys (retail tables are created by sync in any order); the link is only for joins.
RetailOrder.hasMany(RetailOrderItem, { foreignKey: 'order_id', as: 'items', constraints: false });
RetailOrderItem.belongsTo(RetailOrder, { foreignKey: 'order_id', as: 'order', constraints: false });

module.exports = RetailOrderItem;
