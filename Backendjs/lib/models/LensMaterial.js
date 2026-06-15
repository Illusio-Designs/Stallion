/**
 * CREATE TABLE lens_materials (lens_material_id SERIAL PRIMARY KEY, lens_material
VARCHAR(100) UNIQUE NOT NULL);
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const LensMaterial = sequelize.define('LensMaterial', {
    lens_material_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    lens_material: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'lens_material',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = LensMaterial;