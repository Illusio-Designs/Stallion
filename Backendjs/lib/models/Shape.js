/**
 * CREATE TABLE shapes (shape_id SERIAL PRIMARY KEY, shape_name VARCHAR(100)
UNIQUE NOT NULL);
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Shape = sequelize.define('Shape', {
    shape_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    shape_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'shape',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Shape;