/**CREATE TABLE lens_colors (lens_color_id SERIAL PRIMARY KEY, lens_color VARCHAR(100)
UNIQUE NOT NULL); */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const LensColor = sequelize.define('LensColor', {
    lens_color_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    lens_color: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'lens_color',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = LensColor;