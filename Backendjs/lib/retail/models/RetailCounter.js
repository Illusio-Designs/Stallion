const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// Named counters. Today it only feeds order numbers (WEB-1001, WEB-1002 ...): the row is locked
// (SELECT ... FOR UPDATE) inside the order transaction, so two orders can never get the same number.
const RetailCounter = sequelize.define('RetailCounter', {
    name: { type: DataTypes.STRING(60), primaryKey: true },
    value: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
}, {
    tableName: 'retail_counters',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = RetailCounter;
