const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// Key/value store settings (store name, banner, shipping rules, tracking ids...).
// `value` is JSON text. is_secret values are never returned by the public API.
const RetailSetting = sequelize.define('RetailSetting', {
    setting_key: { type: DataTypes.STRING(100), primaryKey: true },
    value: { type: DataTypes.TEXT('long'), allowNull: true },
    is_secret: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
    tableName: 'retail_settings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = RetailSetting;
