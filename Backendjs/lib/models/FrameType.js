/**
 * CREATE TABLE frame_types (frame_type_id SERIAL PRIMARY KEY, frame_type
VARCHAR(100) UNIQUE NOT NULL);
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const FrameType = sequelize.define('FrameType', {
    frame_type_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    frame_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'frame_type',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = FrameType;