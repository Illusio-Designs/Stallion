/**
 * CREATE TABLE genders (gender_id SERIAL PRIMARY KEY, gender_name VARCHAR(100)
UNIQUE NOT NULL);
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Gender = sequelize.define('Gender', {
    gender_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    gender_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'gender',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Gender;