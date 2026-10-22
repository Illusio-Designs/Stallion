const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

// One line for every change to a product's stock: what happened, by how much, the numbers
// after it, who did it and which order or tray it was for. Read-only history.
const StockMovement = sequelize.define('StockMovement', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    product_id: { type: DataTypes.UUID, allowNull: false },
    // order, cancel, tray, sheet, manual
    kind: { type: DataTypes.STRING(20), allowNull: false },
    change_warehouse: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    change_tray: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    warehouse_after: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    tray_after: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    user_id: { type: DataTypes.UUID, allowNull: true },
    user_name: { type: DataTypes.STRING(255), allowNull: true },
    reference: { type: DataTypes.STRING(100), allowNull: true },
    note: { type: DataTypes.STRING(255), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
    tableName: 'stock_movements',
    timestamps: false,
    indexes: [
        { fields: ['product_id', 'created_at'], name: 'idx_stock_movements_product_date' },
        { fields: ['kind'], name: 'idx_stock_movements_kind' },
    ],
});

module.exports = StockMovement;
