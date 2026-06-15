// CREATE TABLE trays(
//     tray_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     tray_name VARCHAR(100) UNIQUE NOT NULL,
//     tray_status VARCHAR(20) DEFAULT 'available'
// );

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Tray = sequelize.define('Tray', {
    tray_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    tray_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    tray_status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'available'
    }
}, {
    tableName: 'tray',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Tray;