/**
 * CREATE TABLE frame_colors (frame_color_id SERIAL PRIMARY KEY, frame_color
VARCHAR(100) UNIQUE NOT NULL);
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const FrameColor = sequelize.define('FrameColor', {
    frame_color_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    frame_color: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'frame_color',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = FrameColor;