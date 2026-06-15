/**
 * CREATE TABLE color_codes (color_code_id SERIAL PRIMARY KEY, color_code
VARCHAR(100) UNIQUE NOT NULL);
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const ColorCode = sequelize.define('ColorCode', {
    color_code_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    color_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'color_code',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ColorCode;