const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Brand = sequelize.define('Brand', {
    brand_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    brand_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'brand',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Brand;