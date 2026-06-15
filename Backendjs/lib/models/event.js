
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Event = sequelize.define('Event', {
    event_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    event_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    event_location: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    event_status: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
}, {
    tableName: 'event',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Event;