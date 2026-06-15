/**
 * CREATE TABLE frame_materials (frame_material_id SERIAL PRIMARY KEY, frame_material
VARCHAR(100) UNIQUE NOT NULL);
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const FrameMaterial = sequelize.define('FrameMaterial', {
    frame_material_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    frame_material: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'frame_material',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = FrameMaterial;